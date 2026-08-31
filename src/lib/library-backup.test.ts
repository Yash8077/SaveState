import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  backupFilename,
  backupToCsv,
  clampBackupEntries,
  makeBackup,
  parseBackupPayload,
} from "./library-backup.ts";
import type { GameEntry } from "./types.ts";

const entry = {
  id: 1,
  catalogId: "steam_1245620",
  title: "ELDEN RING",
  coverUrl: "https://example.com/c.jpg",
  headerUrl: null,
  summary: "A dark fantasy.",
  releaseDate: "2022-02-25",
  platforms: ["Windows"],
  genres: ["RPG"],
  metacritic: 96,
  developers: ["FromSoftware"],
  publishers: ["Bandai"],
  screenshots: [],
  status: "beaten",
  score: 9,
  hours: 18,
  favorite: true,
  notes: "Great.",
  startedAt: "2022-03-01",
  finishedAt: "2022-04-01",
  createdAt: "2022-03-01T00:00:00.000Z",
  updatedAt: "2022-04-01T00:00:00.000Z",
} as GameEntry;

describe("library backup", () => {
  it("round-trips JSON and CSV", () => {
    const backup = makeBackup([entry], new Date("2026-08-31T00:00:00Z"));
    const again = parseBackupPayload(backup);
    assert.equal(again.length, 1);
    assert.equal(again[0]?.catalogId, "steam_1245620");
    assert.equal(again[0]?.status, "beaten");
    assert.equal(again[0]?.hours, 18);
    const csv = backupToCsv(backup);
    const fromCsv = parseBackupPayload(csv);
    assert.equal(fromCsv[0]?.title, "ELDEN RING");
    assert.equal(fromCsv[0]?.favorite, true);
    assert.equal(backupFilename("json", new Date("2026-08-31T12:00:00")), "savestate-library-31-08-2026.json");
  });

  it("caps and de-dupes imports", () => {
    const many = Array.from({ length: 3 }, () => ({
      catalogId: "steam_1",
      title: "Same",
    }));
    const parsed = parseBackupPayload({ app: "SaveState", entries: many });
    assert.equal(clampBackupEntries(parsed).length, 1);
  });
});
