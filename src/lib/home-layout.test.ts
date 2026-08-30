import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_HOME_SECTIONS,
  isCatalogSection,
  loadHeroAutoplay,
  mergeHomeLayout,
  moveHomeSection,
  parseHomeLayout,
  reorderHomeSection,
  saveHeroAutoplay,
  toggleHomeSection,
} from "./home-layout.ts";

describe("home layout", () => {
  it("fills missing default sections after a partial save", () => {
    const merged = mergeHomeLayout(
      [
        { id: "playstation", enabled: true },
        { id: "playing", enabled: false },
      ],
      ["mystery"],
    );
    assert.equal(merged[0]?.id, "playstation");
    assert.equal(merged.find((row) => row.id === "playing")?.enabled, false);
    assert.ok(merged.some((row) => row.id === "popular"));
    assert.equal(merged.some((row) => row.id === "top_sellers"), false);
    assert.equal(merged.at(-1)?.id, "mystery");
  });

  it("maps a saved Trending row onto Popular", () => {
    const merged = mergeHomeLayout([{ id: "top_sellers", enabled: true }]);
    assert.equal(merged.find((row) => row.id === "popular")?.enabled, true);
    assert.equal(merged.some((row) => row.id === "top_sellers"), false);
  });

  it("moves and toggles sections", () => {
    const moved = moveHomeSection(DEFAULT_HOME_SECTIONS, "playstation", -1);
    const ps = moved.findIndex((row) => row.id === "playstation");
    const sale = moved.findIndex((row) => row.id === "specials");
    assert.equal(ps, sale - 1);
    const hidden = toggleHomeSection(moved, "hero", false);
    assert.equal(hidden.find((row) => row.id === "hero")?.enabled, false);
  });

  it("reorders by index and ignores junk", () => {
    const reordered = reorderHomeSection(DEFAULT_HOME_SECTIONS, 0, 3);
    assert.equal(reordered[3]?.id, "hero");
    assert.deepEqual(parseHomeLayout("nope"), DEFAULT_HOME_SECTIONS);
    assert.equal(isCatalogSection("playstation"), true);
    assert.equal(isCatalogSection("playing"), false);
  });

  it("defaults carousel autoplay on", () => {
    assert.equal(loadHeroAutoplay(), true);
    saveHeroAutoplay(false);
  });
});
