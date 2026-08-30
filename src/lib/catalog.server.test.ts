import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  refreshFeaturedWith,
  runSearchWith,
} from "./catalog.server.ts";
import { FEATURED_SEED, searchSeed } from "./catalog-seed.ts";
import type { CatalogGame, FeaturedRail } from "./types.ts";

function game(id: string, title: string): CatalogGame {
  return {
    id,
    steamId: id.startsWith("steam_") ? Number(id.slice(6)) : null,
    title,
    coverUrl: null,
    headerUrl: null,
    capsuleUrl: null,
    platforms: [],
    metacritic: null,
  };
}

describe("runSearch merge and fallback", () => {
  it("prefers IGDB when it returns games, even if Steam also resolves", async () => {
    let steamStarted = false;
    const igdbGame = game("igdb_1", "Elden Ring");
    const result = await runSearchWith("elden", {
      igdbReady: () => true,
      searchIgdb: async () => [igdbGame, igdbGame],
      searchSteam: async () => {
        steamStarted = true;
        return [game("steam_1245620", "ELDEN RING")];
      },
      searchSeed,
    });
    assert.equal(steamStarted, true);
    assert.deepEqual(
      result.map((g) => g.id),
      ["igdb_1"],
    );
  });

  it("starts Steam without waiting for a slow IGDB miss, then uses Steam", async () => {
    let steamStarted = false;
    let resolveIgdb!: (value: CatalogGame[]) => void;
    const igdbP = new Promise<CatalogGame[]>((resolve) => {
      resolveIgdb = resolve;
    });
    const pending = runSearchWith("elden", {
      igdbReady: () => true,
      searchIgdb: () => igdbP,
      searchSteam: async () => {
        steamStarted = true;
        return [game("steam_1245620", "ELDEN RING")];
      },
      searchSeed,
    });
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(steamStarted, true);
    resolveIgdb([]);
    const result = await pending;
    assert.equal(result[0]?.id, "steam_1245620");
  });

  it("falls back to seed data when IGDB and Steam both fail", async () => {
    const result = await runSearchWith("elden", {
      igdbReady: () => true,
      searchIgdb: async () => {
        throw new Error("igdb down");
      },
      searchSteam: async () => {
        throw new Error("steam down");
      },
      searchSeed,
    });
    assert.ok(result.length > 0);
    assert.ok(result.some((g) => /elden/i.test(g.title)));
    assert.equal(new Set(result.map((g) => g.id)).size, result.length);
  });

  it("uses Steam when IGDB is not configured", async () => {
    const result = await runSearchWith("portal", {
      igdbReady: () => false,
      searchIgdb: async () => {
        throw new Error("should not be called");
      },
      searchSteam: async () => [game("steam_620", "Portal 2")],
      searchSeed,
    });
    assert.deepEqual(
      result.map((g) => g.id),
      ["steam_620"],
    );
  });

  it("dedupes repeated catalog ids from a source", async () => {
    const dup = game("steam_620", "Portal 2");
    const result = await runSearchWith("portal", {
      igdbReady: () => false,
      searchIgdb: async () => [],
      searchSteam: async () => [dup, { ...dup }, game("steam_400", "Portal")],
      searchSeed,
    });
    assert.deepEqual(
      result.map((g) => g.id),
      ["steam_620", "steam_400"],
    );
  });
});

describe("refreshFeatured merge and fallback", () => {
  it("keeps IGDB rails when they arrive", async () => {
    const live: FeaturedRail[] = [
      {
        id: "trending",
        title: "Trending",
        games: [game("igdb_99", "Hades")],
      },
    ];
    const rails = await refreshFeaturedWith({
      igdbReady: () => true,
      fetchIgdbFeatured: async () => live,
      fetchSteamFeatured: async () => [
        {
          id: "top_sellers",
          title: "Top Sellers",
          games: [game("steam_1", "How to Fish")],
        },
      ],
    });
    assert.equal(rails[0]?.id, "trending");
    assert.equal(rails[0]?.games[0]?.id, "igdb_99");
  });

  it("falls back to seed data when both sources fail", async () => {
    const rails = await refreshFeaturedWith({
      igdbReady: () => true,
      fetchIgdbFeatured: async () => {
        throw new Error("igdb down");
      },
      fetchSteamFeatured: async () => {
        throw new Error("steam down");
      },
    });
    assert.deepEqual(
      rails.map((r) => r.id),
      FEATURED_SEED.map((r) => r.id),
    );
    assert.ok(rails[0]?.games.length);
  });

  it("prepends curated Popular onto Steam featured rails", async () => {
    const rails = await refreshFeaturedWith({
      igdbReady: () => false,
      fetchIgdbFeatured: async () => [],
      fetchSteamFeatured: async () => [
        {
          id: "top_sellers",
          title: "Top Sellers",
          games: [game("steam_1", "How to Fish")],
        },
        {
          id: "specials",
          title: "Specials",
          games: [game("steam_2", "On Sale")],
        },
      ],
    });
    assert.equal(rails[0]?.id, "popular");
    assert.ok(rails.some((r) => r.id === "specials"));
    assert.ok(!rails.some((r) => r.id === "top_sellers"));
  });
});
