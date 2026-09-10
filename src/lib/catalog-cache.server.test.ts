import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  CATALOG_DETAILS_TTL_MS,
  CATALOG_RELATED_TTL_MS,
  catalogCacheKey,
  isCatalogCacheFresh,
  parseCatalogCachePayload,
  readCatalogCache,
  writeCatalogCache,
} from "./catalog-cache.server.ts";
import type { CatalogDetails, FeaturedRail } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

type QuerySql = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
};

function wrap(pg: PGlite): QuerySql {
  return {
    query: async <T>(text: string, params: unknown[] = []) => {
      const result = await pg.query<T>(text, params);
      return result.rows;
    },
  };
}

const details: CatalogDetails = {
  id: "igdb_1942",
  steamId: 292030,
  title: "The Witcher 3",
  coverUrl: "https://example.com/cover.jpg",
  headerUrl: "https://example.com/header.jpg",
  capsuleUrl: null,
  platforms: ["Windows"],
  metacritic: 93,
  summary: "A story-driven open world RPG.",
  releaseDate: "2015-05-19",
  comingSoon: false,
  genres: ["RPG"],
  developers: ["CD Projekt RED"],
  publishers: ["CD Projekt"],
  screenshots: ["https://example.com/s1.jpg"],
  website: null,
  related: [],
  relatedPending: true,
};

const rails: FeaturedRail[] = [
  {
    id: "prequel",
    title: "Prequel",
    games: [
      {
        id: "igdb_80",
        steamId: null,
        title: "The Witcher 2",
        coverUrl: "https://example.com/w2.jpg",
        headerUrl: null,
        capsuleUrl: null,
        platforms: [],
        metacritic: null,
      },
    ],
  },
];

describe("catalog cache TTL", () => {
  it("treats a 23-hour-old details row as fresh and a 25-hour-old row as stale", () => {
    const now = Date.now();
    assert.equal(
      isCatalogCacheFresh(now - 23 * 60 * 60 * 1000, now, CATALOG_DETAILS_TTL_MS),
      true,
    );
    assert.equal(
      isCatalogCacheFresh(now - 25 * 60 * 60 * 1000, now, CATALOG_DETAILS_TTL_MS),
      false,
    );
  });

  it("treats a 6-day-old related row as fresh and an 8-day-old row as stale", () => {
    const now = Date.now();
    assert.equal(
      isCatalogCacheFresh(now - 6 * 24 * 60 * 60 * 1000, now, CATALOG_RELATED_TTL_MS),
      true,
    );
    assert.equal(
      isCatalogCacheFresh(now - 8 * 24 * 60 * 60 * 1000, now, CATALOG_RELATED_TTL_MS),
      false,
    );
  });
});

describe("catalog cache payload", () => {
  it("parses JSON strings and objects", () => {
    assert.deepEqual(parseCatalogCachePayload(details), details);
    assert.deepEqual(parseCatalogCachePayload(JSON.stringify(details)), details);
    assert.equal(parseCatalogCachePayload("not-json"), null);
    assert.equal(parseCatalogCachePayload(null), null);
  });

  it("namespaces keys by kind and cache version", () => {
    assert.equal(
      catalogCacheKey("rel-20", "details", "igdb_1942"),
      "details:rel-20:igdb_1942",
    );
    assert.equal(
      catalogCacheKey("rel-20", "related", "igdb_1942"),
      "related:rel-20:igdb_1942",
    );
  });
});

describe("catalog cache postgres roundtrip", () => {
  let sql: QuerySql;

  before(async () => {
    const pg = new PGlite();
    await pg.waitReady;
    await pg.exec(
      readFileSync(join(root, "migrations", "0019_catalog_cache.sql"), "utf8"),
    );
    sql = wrap(pg);
  });

  it("stores details and related and reports freshness", async () => {
    await writeCatalogCache({
      kind: "details",
      ver: "rel-20",
      catalogId: "igdb_1942",
      payload: details,
      sql,
    });
    await writeCatalogCache({
      kind: "related",
      ver: "rel-20",
      catalogId: "igdb_1942",
      payload: rails,
      sql,
    });

    const core = await readCatalogCache<CatalogDetails>({
      kind: "details",
      ver: "rel-20",
      catalogId: "igdb_1942",
      ttlMs: CATALOG_DETAILS_TTL_MS,
      sql,
    });
    assert.equal(core?.fresh, true);
    assert.equal(core?.data.title, "The Witcher 3");
    assert.equal(core?.data.relatedPending, true);

    const related = await readCatalogCache<FeaturedRail[]>({
      kind: "related",
      ver: "rel-20",
      catalogId: "igdb_1942",
      ttlMs: CATALOG_RELATED_TTL_MS,
      sql,
    });
    assert.equal(related?.fresh, true);
    assert.equal(related?.data[0]?.games[0]?.title, "The Witcher 2");

    const stale = await readCatalogCache<CatalogDetails>({
      kind: "details",
      ver: "rel-20",
      catalogId: "igdb_1942",
      ttlMs: CATALOG_DETAILS_TTL_MS,
      now: Date.now() + CATALOG_DETAILS_TTL_MS + 1000,
      sql,
    });
    assert.equal(stale?.fresh, false);
    assert.equal(stale?.data.title, "The Witcher 3");
  });

  it("skips writing null payloads", async () => {
    await writeCatalogCache({
      kind: "details",
      ver: "rel-20",
      catalogId: "igdb_missing",
      payload: null,
      sql,
    });
    const miss = await readCatalogCache<CatalogDetails>({
      kind: "details",
      ver: "rel-20",
      catalogId: "igdb_missing",
      ttlMs: CATALOG_DETAILS_TTL_MS,
      sql,
    });
    assert.equal(miss, null);
  });
});
