import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tintForCatalog, tunedAccent } from "./tints.ts";

describe("tints", () => {
  it("returns a known seed for Elden Ring", () => {
    assert.equal(tintForCatalog("steam_1245620"), "#8a7040");
  });

  it("is stable for unknown ids", () => {
    assert.equal(tintForCatalog("custom_1"), tintForCatalog("custom_1"));
    assert.match(tintForCatalog("custom_1"), /^#[0-9a-f]{6}$/);
  });

  it("tunes a midtone into a readable accent pair", () => {
    const dark = tunedAccent("#8a7040", true);
    const light = tunedAccent("#8a7040", false);
    assert.match(dark.accent, /^#[0-9a-f]{6}$/);
    assert.match(light.accent, /^#[0-9a-f]{6}$/);
    assert.notEqual(dark.accent, light.accent);
  });
});
