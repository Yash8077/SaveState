import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeAvatar,
  defaultAvatarSrc,
  parseAvatarValue,
  parseDisplayName,
} from "./avatars.ts";
import { listBuiltInAvatars } from "./avatars.server.ts";

describe("avatars", () => {
  it("accepts a display name of 1–40 characters", () => {
    assert.equal(parseDisplayName("  Yash  "), "Yash");
    assert.equal(parseDisplayName(""), null);
    assert.equal(parseDisplayName("x".repeat(41)), null);
  });

  it("accepts any avatar_N.png without a hardcoded map", () => {
    assert.equal(
      parseAvatarValue(defaultAvatarSrc("avatar_1")),
      "/avatars/avatar_1.png",
    );
    assert.equal(parseAvatarValue("/avatars/avatar_99.png"), "/avatars/avatar_99.png");
    assert.equal(parseAvatarValue("/avatars/robot_07.png"), "/avatars/avatar_7.png");
    assert.equal(canonicalizeAvatar("/avatars/robot_01.png"), "/avatars/avatar_1.png");
    assert.equal(parseAvatarValue("/avatars/fox.svg"), "/avatars/fox.svg");
    assert.equal(parseAvatarValue("/avatars/nope.svg"), undefined);
    assert.equal(parseAvatarValue("https://evil.example/x.png"), undefined);
    assert.equal(
      parseAvatarValue("data:image/jpeg;base64,abc+/12=="),
      "data:image/jpeg;base64,abc+/12==",
    );
    assert.equal(parseAvatarValue("data:text/html;base64,aaaa"), undefined);
    assert.equal(parseAvatarValue(null), null);
  });

  it("lists avatar_N.png files from disk in numeric order", () => {
    const listed = listBuiltInAvatars();
    assert.ok(listed.length >= 12);
    assert.equal(listed[0], "/avatars/avatar_1.png");
    assert.ok(listed.includes("/avatars/avatar_12.png"));
    const nums = listed.map((s) => Number(/avatar_(\d+)/.exec(s)?.[1]));
    assert.deepEqual(nums, [...nums].sort((a, b) => a - b));
  });
});
