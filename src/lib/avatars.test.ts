import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_AVATARS,
  defaultAvatarSrc,
  parseAvatarValue,
  parseDisplayName,
} from "./avatars.ts";

describe("avatars", () => {
  it("accepts a display name of 1–40 characters", () => {
    assert.equal(parseDisplayName("  Yash  "), "Yash");
    assert.equal(parseDisplayName(""), null);
    assert.equal(parseDisplayName("x".repeat(41)), null);
  });

  it("only allows built-in badges or compact image data URLs", () => {
    assert.equal(
      parseAvatarValue(defaultAvatarSrc("robot_01")),
      "/avatars/robot_01.png",
    );
    assert.equal(parseAvatarValue("/avatars/fox.svg"), "/avatars/fox.svg");
    assert.equal(parseAvatarValue("/avatars/nope.svg"), undefined);
    assert.equal(parseAvatarValue("https://evil.example/x.png"), undefined);
    assert.equal(
      parseAvatarValue("data:image/jpeg;base64,abc+/12=="),
      "data:image/jpeg;base64,abc+/12==",
    );
    assert.equal(parseAvatarValue("data:text/html;base64,aaaa"), undefined);
    assert.equal(parseAvatarValue(null), null);
    assert.equal(DEFAULT_AVATARS.length, 12);
  });
});
