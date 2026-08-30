import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collapseEditions,
  dedupeGames,
  refreshFeaturedWith,
  runSearchWith,
} from "./catalog.server.ts";
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

const emptySources = {
  igdbReady: () => true,
  searchIgdb: async () => [] as CatalogGame[],
  searchSteam: async () => [] as CatalogGame[],
};

describe("runSearch uses one provider", () => {
  it("does not call Steam when IGDB is selected", async () => {
    let steamStarted = false;
    const result = await runSearchWith(
      "elden",
      {
        igdbReady: () => true,
        searchIgdb: async () => [game("igdb_1", "Elden Ring")],
        searchSteam: async () => {
          steamStarted = true;
          return [game("steam_1245620", "ELDEN RING")];
        },
      },
      "igdb",
    );
    assert.equal(steamStarted, false);
    assert.deepEqual(
      result.map((g) => g.id),
      ["igdb_1"],
    );
  });

  it("does not call IGDB when Steam is selected", async () => {
    let igdbStarted = false;
    const result = await runSearchWith(
      "elden",
      {
        igdbReady: () => true,
        searchIgdb: async () => {
          igdbStarted = true;
          return [game("igdb_1", "Elden Ring")];
        },
        searchSteam: async () => [game("steam_1245620", "ELDEN RING")],
      },
      "steam",
    );
    assert.equal(igdbStarted, false);
    assert.deepEqual(
      result.map((g) => g.id),
      ["steam_1245620"],
    );
  });

  it("returns empty when the selected provider fails, without using the other", async () => {
    const result = await runSearchWith(
      "elden",
      {
        igdbReady: () => true,
        searchIgdb: async () => {
          throw new Error("igdb down");
        },
        searchSteam: async () => [game("steam_1245620", "ELDEN RING")],
      },
      "igdb",
    );
    assert.deepEqual(result, []);
  });

  it("returns empty when IGDB is selected but not configured", async () => {
    const result = await runSearchWith("portal", {
      ...emptySources,
      igdbReady: () => false,
      searchSteam: async () => [game("steam_620", "Portal 2")],
    }, "igdb");
    assert.deepEqual(result, []);
  });

  it("dedupes repeated catalog ids from a source", async () => {
    const dup = game("steam_620", "Portal 2");
    const result = await runSearchWith(
      "portal",
      {
        igdbReady: () => false,
        searchIgdb: async () => [],
        searchSteam: async () => [dup, { ...dup }, game("steam_400", "Portal")],
      },
      "steam",
    );
    assert.deepEqual(
      result.map((g) => g.id),
      ["steam_620", "steam_400"],
    );
  });

  it("collapses same-name parent/child rows, keeping the main game", () => {
    const main = {
      ...game("igdb_1", "Ghost of Yotei"),
      gameType: 0,
    };
    const deluxe = {
      ...game("igdb_2", "Ghost of Yotei"),
      parentGameId: "igdb_1",
      gameType: 3,
    };
    const out = dedupeGames([deluxe, main, deluxe]);
    assert.deepEqual(
      out.map((g) => g.id),
      ["igdb_1"],
    );
  });
});

describe("collapseEditions", () => {
  it("drops DLC and subtitle editions when the base game is present", () => {
    const out = collapseEditions([
      game("steam_1091500", "Cyberpunk 2077"),
      game("steam_2138330", "Cyberpunk 2077: Phantom Liberty"),
      game("steam_1", "CybeRage"),
      game("steam_2", "CybeRage: Red Line"),
      game("steam_3", "CybeRage: Green Line"),
      game("steam_4", "Bomb Rush Cyberfunk"),
    ]);
    assert.deepEqual(
      out.map((g) => g.title),
      ["Cyberpunk 2077", "CybeRage", "Bomb Rush Cyberfunk"],
    );
  });

  it("keeps numbered sequels", () => {
    const out = collapseEditions([
      game("steam_400", "Portal"),
      game("steam_620", "Portal 2"),
    ]);
    assert.deepEqual(
      out.map((g) => g.title),
      ["Portal", "Portal 2"],
    );
  });
});

describe("refreshFeatured uses one provider", () => {
  it("keeps IGDB rails and does not fetch Steam", async () => {
    let steamStarted = false;
    const live: FeaturedRail[] = [
      {
        id: "trending",
        title: "Trending",
        games: [game("igdb_99", "Hades")],
      },
    ];
    const rails = await refreshFeaturedWith(
      {
        igdbReady: () => true,
        fetchIgdbFeatured: async () => live,
        fetchSteamFeatured: async () => {
          steamStarted = true;
          return [
            {
              id: "top_sellers",
              title: "Top Sellers",
              games: [game("steam_1", "How to Fish")],
            },
          ];
        },
      },
      "igdb",
    );
    assert.equal(steamStarted, false);
    assert.equal(rails[0]?.id, "trending");
    assert.equal(rails[0]?.games[0]?.id, "igdb_99");
  });

  it("returns empty rails when IGDB fails instead of mixing Steam", async () => {
    const rails = await refreshFeaturedWith(
      {
        igdbReady: () => true,
        fetchIgdbFeatured: async () => {
          throw new Error("igdb down");
        },
        fetchSteamFeatured: async () => [
          {
            id: "top_sellers",
            title: "Top Sellers",
            games: [game("steam_1", "How to Fish")],
          },
        ],
      },
      "igdb",
    );
    assert.deepEqual(rails, []);
  });

  it("returns Steam rails only when Steam is selected", async () => {
    const rails = await refreshFeaturedWith(
      {
        igdbReady: () => true,
        fetchIgdbFeatured: async () => [
          {
            id: "trending",
            title: "Trending",
            games: [game("igdb_99", "Hades")],
          },
        ],
        fetchSteamFeatured: async () => [
          {
            id: "specials",
            title: "On sale",
            games: [game("steam_2", "On Sale")],
          },
        ],
      },
      "steam",
    );
    assert.deepEqual(
      rails.map((r) => r.id),
      ["specials"],
    );
    assert.ok(!rails.some((r) => r.games[0]?.id.startsWith("igdb_")));
  });
});
