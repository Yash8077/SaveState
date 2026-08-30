import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_APPEARANCE, parseAppearance } from "./appearance.ts";

describe("parseAppearance", () => {
  it("returns defaults for junk", () => {
    assert.deepEqual(parseAppearance(null), DEFAULT_APPEARANCE);
    assert.deepEqual(parseAppearance("nope"), DEFAULT_APPEARANCE);
  });

  it("keeps known fields and the new dynamic flag", () => {
    const parsed = parseAppearance({
      mode: "light",
      oled: true,
      accent: "rose",
      grain: true,
      grainIntensity: "high",
      bloom: false,
      dynamic: true,
    });
    assert.equal(parsed.mode, "light");
    assert.equal(parsed.oled, true);
    assert.equal(parsed.accent, "rose");
    assert.equal(parsed.grainIntensity, "high");
    assert.equal(parsed.bloom, false);
    assert.equal(parsed.dynamic, true);
  });

  it("ignores unknown accents and modes", () => {
    const parsed = parseAppearance({ mode: "neon", accent: "chartreuse" });
    assert.equal(parsed.mode, "dark");
    assert.equal(parsed.accent, "teal");
    assert.equal(parsed.dynamic, false);
  });
});
