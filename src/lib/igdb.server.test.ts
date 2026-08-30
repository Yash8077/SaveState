import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CARD_FIELDS,
  DETAIL_FIELDS,
  SEARCH_FIELDS,
  igdbCatalogId,
  relatedRails,
  toGame,
  withWikidataFallback,
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
    assert.match(DETAIL_FIELDS, /similar_games\./);
    assert.match(DETAIL_FIELDS, /collection\.id/);
    assert.match(DETAIL_FIELDS, /collections\.id/);
    assert.match(DETAIL_FIELDS, /collections\.name/);
    assert.match(DETAIL_FIELDS, /parent_game\./);
    assert.doesNotMatch(CARD_FIELDS, /summary/);
    assert.doesNotMatch(CARD_FIELDS, /involved_companies/);
    assert.ok(DETAIL_FIELDS.startsWith(CARD_FIELDS));
  });
});

describe("related rails", () => {
  it("splits a collection into prequel / sequel by release date", () => {
    const rails = relatedRails({
      id: 2,
      name: "Middle",
      first_release_date: 100,
      collection: {
        name: "The Saga",
        games: [
          { id: 3, name: "Sequel", first_release_date: 200, cover: { image_id: "c" } },
          { id: 2, name: "Middle", first_release_date: 100, cover: { image_id: "b" } },
          { id: 1, name: "Prequel", first_release_date: 50, cover: { image_id: "a" } },
        ],
      },
      similar_games: [{ id: 9, name: "Like it", cover: { image_id: "s" } }],
      parent_game: { id: 1, name: "Prequel", cover: { image_id: "a" } },
    });
    assert.deepEqual(
      rails.map((r) => r.id),
      ["prequel", "sequel", "similar"],
    );
    assert.deepEqual(
      rails.find((r) => r.id === "prequel")?.games.map((g) => g.title),
      ["Prequel"],
    );
    assert.deepEqual(
      rails.find((r) => r.id === "sequel")?.games.map((g) => g.title),
      ["Sequel"],
    );
  });

  it("labels earlier and later collection games when there is no parent", () => {
    const rails = relatedRails({
      id: 2,
      name: "Middle",
      first_release_date: 100,
      collection: {
        name: "The Saga",
        games: [
          { id: 1, name: "Prequel", first_release_date: 50, cover: { image_id: "a" } },
          { id: 2, name: "Middle", first_release_date: 100, cover: { image_id: "b" } },
          { id: 3, name: "Sequel", first_release_date: 200, cover: { image_id: "c" } },
        ],
      },
    });
    assert.deepEqual(
      rails.map((r) => r.id),
      ["prequel", "sequel"],
    );
    assert.deepEqual(
      rails.find((r) => r.id === "prequel")?.games.map((g) => g.title),
      ["Prequel"],
    );
    assert.deepEqual(
      rails.find((r) => r.id === "sequel")?.games.map((g) => g.title),
      ["Sequel"],
    );
  });

  it("uses collections[] when the legacy collection field is empty", () => {
    const rails = relatedRails({
      id: 1942,
      name: "The Witcher 3",
      first_release_date: 1431993600,
      collections: [
        {
          name: "The Witcher",
          games: [
            {
              id: 80,
              name: "The Witcher",
              first_release_date: 1190073600,
              cover: { image_id: "w1" },
              category: 0,
            },
            {
              id: 81,
              name: "The Witcher 2",
              first_release_date: 1305590400,
              cover: { image_id: "w2" },
              category: 0,
            },
            {
              id: 1942,
              name: "The Witcher 3",
              first_release_date: 1431993600,
              cover: { image_id: "w3" },
              category: 0,
            },
          ],
        },
      ],
      similar_games: [{ id: 9, name: "Like it", cover: { image_id: "s" } }],
    });
    assert.equal(rails.find((r) => r.id === "prequel")?.title, "Prequel");
    assert.deepEqual(
      rails.find((r) => r.id === "prequel")?.games.map((g) => g.title),
      ["The Witcher", "The Witcher 2"],
    );
    assert.equal(rails.find((r) => r.id === "similar")?.title, "Similar games");
  });

  it("does not treat id-only collection members as titled related games", () => {
    const rails = relatedRails({
      id: 1942,
      name: "The Witcher 3",
      first_release_date: 1431993600,
      collections: [{ id: 12, games: [{ id: 80 }, { id: 81 }] }],
    });
    assert.equal(rails.find((r) => r.id === "prequel"), undefined);
  });
});

describe("withWikidataFallback", () => {
  const card = (id: number, title: string) => ({
    id: `igdb_${id}`,
    steamId: null,
    title,
    coverUrl: null,
    headerUrl: null,
    capsuleUrl: null,
    platforms: [],
    metacritic: null,
  });

  it("does not call Wikidata when collection split already produced prequels", async () => {
    let called = 0;
    const game = {
      id: 2,
      name: "Middle",
      first_release_date: 100,
      collection: {
        name: "The Saga",
        games: [
          { id: 1, name: "Prequel", first_release_date: 50, cover: { image_id: "a" } },
          { id: 2, name: "Middle", first_release_date: 100, cover: { image_id: "b" } },
          { id: 3, name: "Sequel", first_release_date: 200, cover: { image_id: "c" } },
        ],
      },
    };
    const rails = relatedRails(game);
    const out = await withWikidataFallback(game, rails, {
      relations: async () => {
        called += 1;
        return { prequelIgdbId: 9, sequelIgdbId: 10 };
      },
      cards: async () => {
        called += 1;
        return { byId: new Map(), bySlug: new Map() };
      },
    });
    assert.equal(called, 0);
    assert.deepEqual(
      out.map((r) => r.id),
      rails.map((r) => r.id),
    );
  });

  it("fills prequel and sequel rails from Wikidata when both buckets are empty", async () => {
    let relationCalls = 0;
    const game = {
      id: 10,
      name: "Standalone",
      similar_games: [{ id: 99, name: "Like it", cover: { image_id: "s" } }],
    };
    const rails = relatedRails(game);
    assert.equal(
      rails.some((r) => r.id === "prequel" || r.id === "sequel"),
      false,
    );
    const out = await withWikidataFallback(game, rails, {
      relations: async (id) => {
        relationCalls += 1;
        assert.equal(id, 10);
        return { prequelIgdbId: 1, sequelIgdbId: 2 };
      },
      cards: async ({ ids }) => {
        assert.deepEqual([...ids].sort(), [1, 2]);
        return {
          byId: new Map([
            [1, card(1, "Before")],
            [2, card(2, "After")],
          ]),
          bySlug: new Map(),
        };
      },
    });
    assert.equal(relationCalls, 1);
    assert.deepEqual(
      out.map((r) => [r.id, r.games.map((g) => g.title)]),
      [
        ["prequel", ["Before"]],
        ["sequel", ["After"]],
        ["similar", ["Like it"]],
      ],
    );
  });

  it("resolves Wikidata slugs when numeric IGDB ids are missing", async () => {
    const game = { id: 10, name: "Standalone", slug: "standalone" };
    const rails = relatedRails(game);
    const out = await withWikidataFallback(game, rails, {
      relations: async (id, slug) => {
        assert.equal(id, 10);
        assert.equal(slug, "standalone");
        return {
          prequelIgdbId: null,
          sequelIgdbId: null,
          prequelSlug: "portal",
          sequelSlug: "portal-2",
        };
      },
      cards: async ({ slugs }) => {
        assert.deepEqual([...slugs].sort(), ["portal", "portal-2"]);
        return {
          byId: new Map(),
          bySlug: new Map([
            ["portal", card(71, "Portal")],
            ["portal-2", card(72, "Portal 2")],
          ]),
        };
      },
    });
    assert.deepEqual(
      out.map((r) => [r.id, r.games.map((g) => g.title)]),
      [
        ["prequel", ["Portal"]],
        ["sequel", ["Portal 2"]],
      ],
    );
  });

  it("swallows Wikidata failures and keeps the original rails", async () => {
    const game = { id: 10, name: "Standalone" };
    const rails = relatedRails(game);
    const out = await withWikidataFallback(game, rails, {
      relations: async () => {
        throw new Error("wikidata down");
      },
      cards: async () => ({ byId: new Map(), bySlug: new Map() }),
    });
    assert.deepEqual(out, rails);
  });
});
