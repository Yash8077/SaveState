import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeAvatar,
  defaultAvatarSrc,
  GUEST_AVATAR,
  parseAvatarValue,
  parseBannerValue,
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
    assert.equal(canonicalizeAvatar("/avatars/fox.svg"), GUEST_AVATAR);
    assert.equal(parseAvatarValue("/avatars/fox.svg"), GUEST_AVATAR);
    assert.equal(parseAvatarValue("https://evil.example/x.png"), undefined);
    assert.equal(
      parseAvatarValue("data:image/jpeg;base64,abc+/12=="),
      "data:image/jpeg;base64,abc+/12==",
    );
    assert.equal(parseAvatarValue("data:text/html;base64,aaaa"), undefined);
    assert.equal(parseAvatarValue(null), null);
    assert.equal(GUEST_AVATAR, "/avatars/avatar_6.png");
  });

  it("accepts Steam/IGDB banner URLs and data images, not random hosts", () => {
    assert.equal(parseBannerValue(null), null);
    assert.equal(parseBannerValue("auto"), null);
    assert.equal(
      parseBannerValue(
        "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/library_hero_2x.jpg",
      ),
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/library_hero_2x.jpg",
    );
    assert.equal(
      parseBannerValue("https://images.igdb.com/igdb/image/upload/t_1080p/abc.jpg"),
      "https://images.igdb.com/igdb/image/upload/t_1080p/abc.jpg",
    );
    assert.equal(parseBannerValue("https://evil.example/x.jpg"), undefined);
    assert.equal(
      parseBannerValue("data:image/jpeg;base64,abc+/12=="),
      "data:image/jpeg;base64,abc+/12==",
    );
  });

  it("lists avatar_N.png files from disk in numeric order", () => {
    const listed = listBuiltInAvatars();
    assert.ok(listed.length >= 12);
    assert.equal(listed[0], "/avatars/avatar_1.png");
    assert.ok(listed.includes("/avatars/avatar_6.png"));
    const nums = listed.map((s) => Number(/avatar_(\d+)/.exec(s)?.[1]));
    assert.deepEqual(nums, [...nums].sort((a, b) => a - b));
  });
});
