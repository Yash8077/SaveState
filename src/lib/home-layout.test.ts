import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_DISCOVER_SECTIONS,
  DEFAULT_HOME_SECTIONS,
  isCatalogSection,
  loadHeroAutoplay,
  mergeDiscoverLayout,
  mergeHomeLayout,
  migrateLegacyLayout,
  moveHomeSection,
  parseHomeLayout,
  reorderHomeSection,
  saveHeroAutoplay,
  toggleHomeSection,
} from "./home-layout.ts";

describe("home layout", () => {
  it("keeps home personal and discover catalog separate", () => {
    const home = mergeHomeLayout([
      { id: "playstation", enabled: true },
      { id: "playing", enabled: false },
    ]);
    assert.equal(home[0]?.id, "playstation");
    assert.equal(home.find((row) => row.id === "playing")?.enabled, false);
    assert.ok(home.some((row) => row.id === "wishlist"));
    assert.ok(home.some((row) => row.id === "recommended"));
    assert.equal(home.some((row) => row.id === "popular"), false);

    const discover = mergeDiscoverLayout([{ id: "specials", enabled: false }]);
    assert.ok(discover.some((row) => row.id === "hero"));
    assert.equal(discover.find((row) => row.id === "specials")?.enabled, false);
    assert.ok(discover.some((row) => row.id === "playstation"));
  });

  it("maps a saved Trending row onto Popular on Discover", () => {
    const merged = mergeDiscoverLayout([{ id: "top_sellers", enabled: true }]);
    assert.equal(merged.find((row) => row.id === "popular")?.enabled, true);
    assert.equal(merged.some((row) => row.id === "top_sellers"), false);
  });

  it("migrates the old combined list", () => {
    const { home, discover } = migrateLegacyLayout([
      { id: "hero", enabled: false },
      { id: "playing", enabled: true },
      { id: "popular", enabled: false },
      { id: "playstation", enabled: true },
    ]);
    assert.equal(home.find((row) => row.id === "playing")?.enabled, true);
    assert.equal(discover.find((row) => row.id === "hero")?.enabled, false);
    assert.equal(discover.find((row) => row.id === "popular")?.enabled, false);
    assert.equal(discover.find((row) => row.id === "playstation")?.enabled, true);
  });

  it("moves and toggles sections", () => {
    const moved = moveHomeSection(DEFAULT_DISCOVER_SECTIONS, "playstation", -1);
    const ps = moved.findIndex((row) => row.id === "playstation");
    const sale = moved.findIndex((row) => row.id === "specials");
    assert.equal(ps, sale - 1);
    const hidden = toggleHomeSection(moved, "hero", false);
    assert.equal(hidden.find((row) => row.id === "hero")?.enabled, false);
  });

  it("reorders by index and ignores junk", () => {
    const reordered = reorderHomeSection(DEFAULT_HOME_SECTIONS, 0, 3);
    assert.equal(reordered[3]?.id, "stats");
    assert.deepEqual(parseHomeLayout("nope"), DEFAULT_HOME_SECTIONS);
    assert.equal(isCatalogSection("playstation"), true);
    assert.equal(isCatalogSection("playing"), false);
  });

  it("defaults carousel autoplay on", () => {
    assert.equal(loadHeroAutoplay(), true);
    saveHeroAutoplay(false);
  });
});
