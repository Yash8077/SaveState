import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nativeAppRedirect } from "./google-env.ts";

describe("google native redirect", () => {
  it("puts the session token on the app callback", () => {
    const url = nativeAppRedirect("abc.def");
    assert.equal(url.startsWith("savestate://callback?"), true);
    assert.equal(new URL(url).searchParams.get("token"), "abc.def");
  });
});
