import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { brandFaviconSvg } from "./brand.ts";

describe("brandFaviconSvg", () => {
  it("bakes the accent into the stacked cartridge mark", () => {
    const svg = brandFaviconSvg("#ffb4ab", true);
    assert.match(svg, /#ffb4ab/);
    assert.match(svg, /#1a2326/);
    assert.match(svg, /viewBox="0 0 32 32"/);
  });
});
