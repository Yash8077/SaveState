import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collapseEditions,
  dedupeGames,
  mergeComingSoon,
  parseSteamSearchHtml,
  rankRailGames,
  refreshFeaturedWith,
  runSearchWith,
  steamReleaseKind,
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

describe("runSearch merges IGDB and Steam", () => {
  it("prefers IGDB when the same title is in both catalogs", async () => {
    const result = await runSearchWith("elden", {
      igdbReady: () => true,
      searchIgdb: async () => [game("igdb_1", "Elden Ring")],
      searchSteam: async () => [game("steam_1245620", "ELDEN RING")],
    });
    assert.deepEqual(
      result.map((g) => g.id),
      ["igdb_1"],
    );
    assert.equal(result[0]?.steamId, 1245620);
  });

  it("keeps Steam prefix hits that IGDB missed", async () => {
    const result = await runSearchWith("eld", {
      igdbReady: () => true,
      searchIgdb: async () => [],
      searchSteam: async () => [game("steam_1245620", "ELDEN RING")],
    });
    assert.deepEqual(
      result.map((g) => g.id),
      ["steam_1245620"],
    );
  });

  it("still returns Steam when IGDB throws", async () => {
    const result = await runSearchWith("elden", {
      igdbReady: () => true,
      searchIgdb: async () => {
        throw new Error("igdb down");
      },
      searchSteam: async () => [game("steam_1245620", "ELDEN RING")],
    });
    assert.deepEqual(
      result.map((g) => g.id),
      ["steam_1245620"],
    );
  });

  it("still returns IGDB when Steam throws", async () => {
    const result = await runSearchWith("portal", {
      igdbReady: () => true,
      searchIgdb: async () => [game("igdb_9", "Portal 2")],
      searchSteam: async () => {
        throw new Error("steam down");
      },
    });
    assert.deepEqual(
      result.map((g) => g.id),
      ["igdb_9"],
    );
  });

  it("falls back to Steam when IGDB is not configured", async () => {
    const result = await runSearchWith("portal", {
      ...emptySources,
      igdbReady: () => false,
      searchSteam: async () => [game("steam_620", "Portal 2")],
    });
    assert.deepEqual(
      result.map((g) => g.id),
      ["steam_620"],
    );
  });

  it("ranks prefix matches first", async () => {
    const result = await runSearchWith("elden", {
      igdbReady: () => true,
      searchIgdb: async () => [
        game("igdb_2", "Shadow of the Erdtree"),
        game("igdb_1", "Elden Ring"),
      ],
      searchSteam: async () => [],
    });
    assert.equal(result[0]?.id, "igdb_1");
  });

  it("dedupes repeated catalog ids from a source", async () => {
    const dup = game("steam_620", "Portal 2");
    const result = await runSearchWith("portal", {
      igdbReady: () => false,
      searchIgdb: async () => [],
      searchSteam: async () => [dup, { ...dup }, game("steam_400", "Portal")],
    });
    assert.deepEqual(
      result.map((g) => g.id),
      ["steam_400", "steam_620"],
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

describe("refreshFeatured uses Steam plus a PlayStation rail", () => {
  it("keeps Steam rails and does not fetch IGDB trending", async () => {
    let igdbFeaturedStarted = false;
    const rails = await refreshFeaturedWith({
      igdbReady: () => true,
      fetchSteamFeatured: async () => [
        {
          id: "top_sellers",
          title: "Trending",
          games: [game("steam_1", "How to Fish")],
        },
      ],
      fetchPlaystationRail: async () => {
        igdbFeaturedStarted = true;
        return {
          id: "playstation",
          title: "PlayStation",
          games: [game("igdb_167", "Astro Bot")],
        };
      },
    });
    assert.equal(igdbFeaturedStarted, true);
    assert.deepEqual(
      rails.map((r) => r.id),
      ["top_sellers", "playstation"],
    );
    assert.equal(rails[0]?.games[0]?.id, "steam_1");
  });

  it("keeps Steam rails when the PlayStation rail fails", async () => {
    const rails = await refreshFeaturedWith({
      igdbReady: () => true,
      fetchSteamFeatured: async () => [
        {
          id: "specials",
          title: "On sale",
          games: [game("steam_2", "On Sale")],
        },
      ],
      fetchPlaystationRail: async () => {
        throw new Error("igdb down");
      },
    });
    assert.deepEqual(
      rails.map((r) => r.id),
      ["specials"],
    );
  });

  it("returns only PlayStation when Steam is down and IGDB is ready", async () => {
    const rails = await refreshFeaturedWith({
      igdbReady: () => true,
      fetchSteamFeatured: async () => {
        throw new Error("steam down");
      },
      fetchPlaystationRail: async () => ({
        id: "playstation",
        title: "PlayStation",
        games: [game("igdb_167", "Astro Bot")],
      }),
    });
    assert.deepEqual(
      rails.map((r) => r.id),
      ["playstation"],
    );
  });

  it("still loads a PlayStation rail when IGDB is not configured", async () => {
    let playstationStarted = false;
    const rails = await refreshFeaturedWith({
      igdbReady: () => false,
      fetchSteamFeatured: async () => [
        {
          id: "specials",
          title: "On sale",
          games: [game("steam_2", "On Sale")],
        },
      ],
      fetchPlaystationRail: async () => {
        playstationStarted = true;
        return {
          id: "playstation",
          title: "PlayStation",
          games: [game("steam_1593500", "God of War")],
        };
      },
    });
    assert.equal(playstationStarted, true);
    assert.deepEqual(
      rails.map((r) => r.id),
      ["specials", "playstation"],
    );
  });
});

describe("rankRailGames", () => {
  it("sorts by popularity and drops unknown titles when enough known games exist", () => {
    const scores = new Map<string, number>([
      ["steam_1", 900],
      ["steam_2", 40],
      ["steam_3", 400],
      ["steam_4", 12],
      ["steam_5", 70],
      ["steam_6", 800],
    ]);
    const out = rankRailGames(
      [
        game("steam_9", "No name indie"),
        game("steam_1", "Elden Ring"),
        game("steam_2", "Small title"),
        game("steam_3", "GTA"),
        game("steam_4", "Niche"),
        game("steam_5", "Hades"),
        game("steam_6", "Witcher"),
      ],
      scores,
      { dropUnknown: true, limit: 12 },
    );
    assert.deepEqual(
      out.map((g) => g.id),
      ["steam_1", "steam_6", "steam_3", "steam_5", "steam_2", "steam_4"],
    );
  });

  it("keeps original order when no popularity scores are available", () => {
    const out = rankRailGames(
      [game("steam_2", "B"), game("steam_1", "A")],
      new Map(),
      { dropUnknown: true, limit: 12 },
    );
    assert.deepEqual(
      out.map((g) => g.id),
      ["steam_2", "steam_1"],
    );
  });
});

describe("mergeComingSoon", () => {
  it("puts anticipated IGDB titles in with Steam coming soon", () => {
    const out = mergeComingSoon(
      [game("steam_1", "Obscure Demo")],
      [game("igdb_9", "Grand Theft Auto VI")],
    );
    assert.deepEqual(
      out.map((g) => g.title),
      ["Grand Theft Auto VI", "Obscure Demo"],
    );
  });
});

describe("Steam search ranking", () => {
  it("parses ranked search rows and skips bundles", () => {
    const html = `
<a href="https://store.steampowered.com/app/1245620/ELDEN_RING/" class="search_result_row ds_collapse_flag" data-ds-appid="1245620">
  <div class="search_capsule"><img src="https://cdn.example/apps/1245620/capsule_231x87.jpg" ></div>
  <span class="title">ELDEN RING</span>
  <div class="search_released responsive_secondrow">Feb 24, 2022</div>
</a>
<a href="https://store.steampowered.com/bundle/99/Fake/" class="search_result_row ds_collapse_flag" data-ds-bundleid="99">
  <span class="title">Bundle Junk</span>
</a>
<a href="https://store.steampowered.com/app/4001890/How_to_Fish/" class="search_result_row ds_collapse_flag" data-ds-appid="4001890">
  <div class="search_capsule"><img src="https://cdn.example/apps/4001890/8f65bb2b78d37a9147aa79c970a51610e6955bf1/capsule_231x87.jpg?t=1" ></div>
  <span class="title">How to Fish</span>
  <div class="search_released responsive_secondrow">To be announced</div>
</a>`;
    const hits = parseSteamSearchHtml(html);
    assert.deepEqual(
      hits.map((hit) => hit.title),
      ["ELDEN RING", "How to Fish"],
    );
    assert.equal(hits[0]?.capsule, "https://cdn.example/apps/1245620/capsule_231x87.jpg");
    assert.match(hits[1]?.capsule ?? "", /8f65bb2b78d37a9147aa79c970a51610e6955bf1/);
    assert.equal(steamReleaseKind("To be announced"), "upcoming");
    assert.equal(steamReleaseKind("Feb 24, 2022"), "old");
    assert.equal(steamReleaseKind("Aug 20, 2026", new Date("2026-08-30")), "recent");
  });
});
