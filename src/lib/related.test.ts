import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  flattenRelated,
  needsPrequelSequelFallback,
  prependPrequelSequel,
  relationBadge,
} from "./related.ts";
import { seedRelated } from "./catalog-seed.ts";
import type { CatalogGame, FeaturedRail } from "./types.ts";

function game(id: string, title: string): CatalogGame {
  return {
    id,
    steamId: null,
    title,
    coverUrl: null,
    headerUrl: null,
    capsuleUrl: null,
    platforms: [],
    metacritic: null,
  };
}

describe("flattenRelated", () => {
  it("keeps one rail of cards with relation badges", () => {
    const rails: FeaturedRail[] = [
      { id: "prequel", title: "Prequel", games: [game("a", "One")] },
      { id: "sequel", title: "Sequel", games: [game("b", "Two")] },
      { id: "similar", title: "Similar games", games: [game("c", "Like")] },
    ];
    const cards = flattenRelated(rails);
    assert.deepEqual(
      cards.map((c) => [c.id, c.relation]),
      [
        ["a", "Prequel"],
        ["b", "Sequel"],
        ["c", "Similar"],
      ],
    );
  });

  it("keeps the first relation when a game appears twice", () => {
    const rails: FeaturedRail[] = [
      { id: "prequel", title: "Prequel", games: [game("a", "One")] },
      { id: "franchise", title: "Franchise", games: [game("a", "One")] },
    ];
    const cards = flattenRelated(rails);
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.relation, "Prequel");
  });

  it("falls back to the rail title for unknown ids", () => {
    assert.equal(relationBadge("side", "Side story"), "Side story");
    assert.equal(relationBadge("dlc", "DLC & expansions"), "DLC");
  });

  it("splits sequel/DLC cards from related/similar cards", () => {
    const rails: FeaturedRail[] = [
      { id: "prequel", title: "Prequel", games: [game("a", "One")] },
      { id: "sequel", title: "Sequel", games: [game("b", "Two")] },
      { id: "dlc", title: "DLC & expansions", games: [game("d", "Pack")] },
      { id: "similar", title: "Similar games", games: [game("c", "Like")] },
      { id: "franchise", title: "Franchise", games: [game("e", "Spin")] },
    ];
    assert.deepEqual(
      flattenRelated(rails, ["dlc", "prequel", "sequel"]).map((c) => [
        c.id,
        c.relation,
      ]),
      [
        ["a", "Prequel"],
        ["b", "Sequel"],
        ["d", "DLC"],
      ],
    );
    assert.deepEqual(
      flattenRelated(rails, ["series", "original", "franchise", "remakes", "similar"]).map(
        (c) => [c.id, c.relation],
      ),
      [
        ["c", "Similar"],
        ["e", "Franchise"],
      ],
    );
  });
});

describe("needsPrequelSequelFallback", () => {
  it("is true when both prequel and sequel rails are missing", () => {
    const rails: FeaturedRail[] = [
      { id: "similar", title: "Similar games", games: [game("c", "Like")] },
    ];
    assert.equal(needsPrequelSequelFallback(rails), true);
    assert.equal(needsPrequelSequelFallback([]), true);
  });

  it("is true when the rails exist but have no games", () => {
    const rails: FeaturedRail[] = [
      { id: "prequel", title: "Prequel", games: [] },
      { id: "sequel", title: "Sequel", games: [] },
    ];
    assert.equal(needsPrequelSequelFallback(rails), true);
  });

  it("is false when a collection already produced a prequel, even without a sequel", () => {
    const rails: FeaturedRail[] = [
      { id: "prequel", title: "Prequel", games: [game("a", "One")] },
      { id: "similar", title: "Similar games", games: [game("c", "Like")] },
    ];
    assert.equal(needsPrequelSequelFallback(rails), false);
  });

  it("is false when a sequel rail already has games", () => {
    const rails: FeaturedRail[] = [
      { id: "sequel", title: "Sequel", games: [game("b", "Two")] },
    ];
    assert.equal(needsPrequelSequelFallback(rails), false);
  });
});

describe("prependPrequelSequel", () => {
  it("puts Wikidata cards in front and drops them from later rails", () => {
    const rails: FeaturedRail[] = [
      { id: "similar", title: "Similar games", games: [game("igdb_1", "Before"), game("c", "Like")] },
    ];
    const out = prependPrequelSequel(rails, game("igdb_1", "Before"), game("igdb_2", "After"));
    assert.deepEqual(
      out.map((r) => [r.id, r.games.map((g) => g.id)]),
      [
        ["prequel", ["igdb_1"]],
        ["sequel", ["igdb_2"]],
        ["similar", ["c"]],
      ],
    );
  });
});

describe("seedRelated", () => {
  it("splits the Dark Souls / Elden Ring chain into prequel and sequel", () => {
    const rails = seedRelated("steam_1245620");
    assert.deepEqual(
      rails.map((r) => r.id),
      ["prequel", "sequel"],
    );
    assert.ok(rails[0]?.games.some((g) => g.title.includes("DARK SOULS")));
    assert.ok(rails[1]?.games.some((g) => g.title.includes("NIGHTREIGN")));
  });
});
