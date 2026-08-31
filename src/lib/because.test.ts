import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isUpcomingRelease,
  pickBecauseSeeds,
  rankSimilarIds,
  sortWishlist,
  type BecauseSeed,
} from "./because.ts";

function seed(partial: Partial<BecauseSeed> & { catalogId: string }): BecauseSeed {
  return {
    title: partial.title ?? partial.catalogId,
    favorite: false,
    status: "backlog",
    score: null,
    updatedAt: "2026-01-01",
    ...partial,
  };
}

describe("because you played", () => {
  it("keeps beaten and favorites, drops backlog and custom", () => {
    const picked = pickBecauseSeeds([
      seed({ catalogId: "steam_1", status: "beaten", title: "A" }),
      seed({ catalogId: "igdb_2", favorite: true, title: "B" }),
      seed({ catalogId: "steam_3", status: "backlog", title: "C" }),
      seed({ catalogId: "custom_x", status: "beaten", title: "D" }),
      seed({ catalogId: "steam_4", status: "playing", score: 9, title: "E" }),
    ]);
    assert.deepEqual(
      picked.map((row) => row.catalogId),
      ["steam_1", "igdb_2", "steam_4"],
    );
  });

  it("ranks overlap and excludes seeds", () => {
    const votes = new Map([
      [10, 3],
      [11, 1],
      [12, 3],
      [1, 9],
    ]);
    assert.deepEqual(rankSimilarIds(votes, new Set([1]), 2), [10, 12]);
  });

  it("puts unreleased wishlist first", () => {
    const sorted = sortWishlist([
      { title: "Zebra", releaseDate: "2020-01-01" },
      { title: "Alpha", releaseDate: "2099-01-01" },
      { title: "Mid", releaseDate: "Coming soon" },
    ]);
    assert.deepEqual(
      sorted.map((row) => row.title),
      ["Alpha", "Mid", "Zebra"],
    );
    assert.equal(isUpcomingRelease("tba"), true);
    assert.equal(isUpcomingRelease("2020-01-01"), false);
  });
});
