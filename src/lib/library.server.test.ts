import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  addCustomGameRow,
  addToLibraryRow,
  listLibraryPage,
  removeEntryRow,
  updateEntryRow,
} from "./library.server.ts";
import type { LibrarySnapshot } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

type QuerySql = Parameters<typeof listLibraryPage>[0];

function wrap(pg: PGlite): QuerySql {
  const run = async <T>(text: string, params: unknown[] = []) => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  };
  const sql = (async () => {
    throw new Error("tagged template not used in these tests");
  }) as unknown as QuerySql;
  sql.query = run;
  return sql;
}

const snapshot: LibrarySnapshot = {
  title: "ELDEN RING",
  coverUrl: "https://example.com/cover.jpg",
  headerUrl: "https://example.com/header.jpg",
  summary: "A dark fantasy.",
  releaseDate: "25 Feb 2022",
  platforms: ["Windows", "PlayStation"],
  genres: ["RPG", "Action"],
  metacritic: 96,
  developers: ["FromSoftware"],
  publishers: ["Bandai Namco"],
  screenshots: ["https://example.com/s1.jpg"],
};

describe("library CRUD against PGLite", () => {
  let sql: QuerySql;

  before(async () => {
    const pg = new PGlite();
    await pg.waitReady;
    for (const name of [
      "0002_game_entries.sql",
      "0003_game_entries_jsonb.sql",
      "0004_igdb_token_cache.sql",
    ]) {
      await pg.exec(readFileSync(join(root, "migrations", name), "utf8"));
    }
    sql = wrap(pg);
  });

  it("inserts jsonb arrays and reads them back as arrays", async () => {
    const entry = await addToLibraryRow(sql, "user-a", {
      catalogId: "steam_1245620",
      status: "playing",
      snapshot,
    });
    assert.equal(entry.catalogId, "steam_1245620");
    assert.equal(entry.status, "playing");
    assert.deepEqual(entry.platforms, ["Windows", "PlayStation"]);
    assert.deepEqual(entry.genres, ["RPG", "Action"]);
    assert.deepEqual(entry.developers, ["FromSoftware"]);
    assert.deepEqual(entry.publishers, ["Bandai Namco"]);
    assert.deepEqual(entry.screenshots, ["https://example.com/s1.jpg"]);
  });

  it("upserts on (user_id, catalog_id) without duplicating the row", async () => {
    const updated = await addToLibraryRow(sql, "user-a", {
      catalogId: "steam_1245620",
      status: "playing",
      snapshot: { ...snapshot, title: "ELDEN RING (updated)", genres: ["RPG"] },
    });
    assert.equal(updated.title, "ELDEN RING (updated)");
    assert.deepEqual(updated.genres, ["RPG"]);
    const page = await listLibraryPage(sql, "user-a", { limit: 50 });
    assert.equal(
      page.items.filter((e) => e.catalogId === "steam_1245620").length,
      1,
    );
  });

  it("scopes rows per user", async () => {
    await addToLibraryRow(sql, "user-b", {
      catalogId: "steam_1245620",
      snapshot: { ...snapshot, title: "B's copy" },
    });
    const a = await listLibraryPage(sql, "user-a", { limit: 50 });
    const b = await listLibraryPage(sql, "user-b", { limit: 50 });
    assert.ok(a.items.every((e) => e.title !== "B's copy"));
    assert.equal(b.items[0]?.title, "B's copy");
    assert.equal(b.items[0]?.status, "playing");
  });

  it("saves start and end dates on first add", async () => {
    const entry = await addToLibraryRow(sql, "user-dates", {
      catalogId: "igdb_1942",
      status: "playing",
      snapshot,
      startedAt: "2024-03-01",
      finishedAt: "2024-03-20",
      score: 9,
      favorite: true,
    });
    assert.equal(entry.startedAt, "2024-03-01");
    assert.equal(entry.finishedAt, "2024-03-20");
    assert.equal(entry.score, 9);
    assert.equal(entry.favorite, true);
  });

  it("updates, paginates with (updated_at, id) cursors, and deletes", async () => {
    const custom = await addCustomGameRow(sql, "user-a", {
      title: "Custom Quest",
      status: "backlog",
      notes: "homebrew",
    });
    const patched = await updateEntryRow(sql, "user-a", {
      id: custom.id,
      status: "beaten",
      score: 8,
      hours: 12,
      favorite: true,
      notes: "done",
    });
    assert.equal(patched.status, "beaten");
    assert.equal(patched.score, 8);
    assert.equal(patched.hours, 12);
    assert.equal(patched.favorite, true);
    assert.equal(patched.notes, "done");

    const dated = await updateEntryRow(sql, "user-a", {
      id: custom.id,
      startedAt: "2024-01-15T00:00:00.000Z",
      finishedAt: "2024-02-01",
    });
    assert.equal(dated.startedAt, "2024-01-15");
    assert.equal(dated.finishedAt, "2024-02-01");

    await addCustomGameRow(sql, "user-a", { title: "Third" });

    const first = await listLibraryPage(sql, "user-a", { limit: 2 });
    assert.equal(first.items.length, 2);
    assert.ok(first.nextCursor);

    const second = await listLibraryPage(sql, "user-a", {
      cursor: first.nextCursor,
      limit: 2,
    });
    assert.ok(second.items.length >= 1);
    const overlap = first.items.filter((a) =>
      second.items.some((b) => b.id === a.id),
    );
    assert.equal(overlap.length, 0);

    await removeEntryRow(sql, "user-a", custom.id);
    await assert.rejects(
      () => removeEntryRow(sql, "user-a", custom.id),
      /Game not found/,
    );
    await assert.rejects(
      () => updateEntryRow(sql, "user-b", { id: first.items[0]!.id, score: 1 }),
      /Game not found/,
    );
  });
});
