import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  artFromSteamAssets,
  paintSteamArt,
  steamAssetUrl,
} from "./steam-assets.server.ts";
import { isLandscapeArt } from "./utils.ts";
import type { CatalogGame } from "./types.ts";

describe("Steam store assets", () => {
  it("builds portrait library_capsule URLs from GetItems payloads", () => {
    const art = artFromSteamAssets({
      asset_url_format: "steam/apps/4001890/${FILENAME}?t=1",
      library_capsule: "abc/library_capsule.jpg",
      library_capsule_2x: "abc/library_capsule_2x.jpg",
      library_hero_2x: "def/library_hero_2x.jpg",
      main_capsule_2x: "ghi/capsule_616x353_2x.jpg",
    });
    assert.match(art.coverUrl ?? "", /library_capsule_2x\.jpg/);
    assert.match(art.headerUrl ?? "", /library_hero_2x\.jpg/);
    assert.equal(isLandscapeArt(art.coverUrl), false);
    assert.equal(isLandscapeArt(art.headerUrl), true);
    assert.equal(
      steamAssetUrl("steam/apps/1/${FILENAME}", "header.jpg"),
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/header.jpg",
    );
  });

  it("paints a catalog row with store portraits", () => {
    const game: CatalogGame = {
      id: "steam_1",
      steamId: 1,
      title: "How to Fish",
      coverUrl: "https://example/library_600x900.jpg",
      headerUrl: "https://example/header.jpg",
      capsuleUrl: null,
      platforms: [],
      metacritic: null,
    };
    const painted = paintSteamArt(
      game,
      new Map([
        [
          1,
          {
            coverUrl: "https://cdn/library_capsule_2x.jpg",
            headerUrl: "https://cdn/library_hero.jpg",
            capsuleUrl: "https://cdn/capsule.jpg",
          },
        ],
      ]),
    );
    assert.equal(painted.coverUrl, "https://cdn/library_capsule_2x.jpg");
  });
});
