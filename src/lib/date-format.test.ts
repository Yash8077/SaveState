import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dmyToIso, isoToDmy } from "./date-format.ts";

describe("date format", () => {
  it("prints and parses dd-mm-yyyy", () => {
    assert.equal(isoToDmy("2026-08-02"), "02-08-2026");
    assert.equal(dmyToIso("02-08-2026"), "2026-08-02");
    assert.equal(dmyToIso("2/9/2026"), "2026-09-02");
    assert.equal(dmyToIso("31-02-2026"), "");
    assert.equal(isoToDmy(""), "");
  });
});
