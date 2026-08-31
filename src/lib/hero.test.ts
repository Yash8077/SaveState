import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heroSlides } from "./hero.ts";
import type { CatalogGame, FeaturedRail } from "./types.ts";

function game(id: string, title: string): CatalogGame {
  return {
    id,
    steamId: null,
    title,
    coverUrl: `cover-${id}`,
    headerUrl: `header-${id}`,
    capsuleUrl: null,
    platforms: [],
    metacritic: null,
  };
}

describe("heroSlides", () => {
  it("puts continue-playing titles first, then featured", () => {
    const rails: FeaturedRail[] = [
      { id: "popular", title: "Popular", games: [game("p1", "P1"), game("p2", "P2")] },
    ];
    const slides = heroSlides(
      [
        {
          catalogId: "mine",
          title: "Mine",
          coverUrl: "c",
          headerUrl: "h",
        },
      ],
      rails,
      3,
    );
    assert.deepEqual(
      slides.map((g) => g.id),
      ["mine", "p1", "p2"],
    );
  });

  it("dedupes a playing title that is also featured", () => {
    const rails: FeaturedRail[] = [
      { id: "popular", title: "Popular", games: [game("a", "A"), game("b", "B")] },
    ];
    const slides = heroSlides(
      [{ catalogId: "a", title: "A", coverUrl: "c", headerUrl: "h" }],
      rails,
      8,
    );
    assert.deepEqual(
      slides.map((g) => g.id),
      ["a", "b"],
    );
  });

  it("fills from Popular before other rails so the carousel stays current", () => {
    const slides = heroSlides(
      [],
      [
        { id: "new_releases", title: "New", games: [game("new", "New")] },
        { id: "popular", title: "Popular", games: [game("hot", "Hot")] },
      ],
      2,
    );
    assert.deepEqual(
      slides.map((g) => g.id),
      ["hot", "new"],
    );
  });
});
