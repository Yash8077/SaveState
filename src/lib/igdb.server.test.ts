import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CARD_FIELDS,
  DETAIL_FIELDS,
  SEARCH_FIELDS,
  igdbCatalogId,
  toGame,
} from "./igdb.server.ts";

describe("toGame mapping", () => {
  it("returns null without an id or name", () => {
    assert.equal(toGame({ name: "Missing id" }), null);
    assert.equal(toGame({ id: 1 }), null);
  });

  it("builds cover URLs and rounded ratings from IGDB fields", () => {
    const game = toGame({
      id: 1942,
      name: "The Witcher 3",
      aggregated_rating: 93.4,
      cover: { image_id: "abc123" },
      screenshots: [{ image_id: "shot1" }],
      platforms: [
        { name: "PC (Microsoft Windows)", abbreviation: "PC" },
        { name: "PlayStation 5", abbreviation: "PS5" },
        { name: "PC (Microsoft Windows)", abbreviation: "PC" },
      ],
    });
    assert.ok(game);
    assert.equal(game.id, igdbCatalogId(1942));
    assert.equal(game.title, "The Witcher 3");
    assert.equal(game.steamId, null);
    assert.equal(game.metacritic, 93);
    assert.equal(
      game.coverUrl,
      "https://images.igdb.com/igdb/image/upload/t_cover_big/abc123.jpg",
    );
    assert.equal(
      game.headerUrl,
      "https://images.igdb.com/igdb/image/upload/t_screenshot_med/shot1.jpg",
    );
    assert.deepEqual(game.platforms, ["PC", "PS5"]);
  });

  it("honors an alternate cover size and skips rating when missing", () => {
    const game = toGame(
      {
        id: 12,
        name: "Hades",
        cover: { image_id: "hades" },
      },
      "cover_small",
    );
    assert.ok(game);
    assert.equal(game.metacritic, null);
    assert.equal(
      game.coverUrl,
      "https://images.igdb.com/igdb/image/upload/t_cover_small/hades.jpg",
    );
    assert.equal(game.headerUrl, game.coverUrl);
  });
});

describe("IGDB field selection", () => {
  it("keeps search payloads slim", () => {
    assert.match(SEARCH_FIELDS, /name/);
    assert.match(SEARCH_FIELDS, /cover\.image_id/);
    assert.doesNotMatch(SEARCH_FIELDS, /summary/);
    assert.doesNotMatch(SEARCH_FIELDS, /involved_companies/);
  });

  it("includes card fields used for rails and extra fields only on details", () => {
    for (const field of [
      "name",
      "cover.image_id",
      "first_release_date",
      "aggregated_rating",
    ]) {
      assert.ok(CARD_FIELDS.includes(field), field);
      assert.ok(DETAIL_FIELDS.includes(field), field);
    }
    assert.match(DETAIL_FIELDS, /summary/);
    assert.match(DETAIL_FIELDS, /genres\.name/);
    assert.match(DETAIL_FIELDS, /platforms\.name/);
    assert.match(DETAIL_FIELDS, /screenshots\.image_id/);
    assert.doesNotMatch(CARD_FIELDS, /summary/);
    assert.doesNotMatch(CARD_FIELDS, /involved_companies/);
    assert.ok(DETAIL_FIELDS.startsWith(CARD_FIELDS));
  });
});
