import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isVideoGameSummary,
  parseWikiTitle,
  wikiCatalogId,
  wikiImageUrl,
} from "./wikipedia.server.ts";

describe("Wikipedia catalog fallback", () => {
  it("round-trips titles including apostrophes", () => {
    const id = wikiCatalogId("Marvel's Wolverine");
    assert.equal(parseWikiTitle(id), "Marvel's Wolverine");
  });

  it("keeps video games and drops series/disambiguation pages", () => {
    assert.equal(
      isVideoGameSummary({
        title: "Astro Bot",
        description: "2024 video game",
      }),
      true,
    );
    assert.equal(
      isVideoGameSummary({
        title: "The Game Awards 2024",
        description: "Annual video game awards ceremony",
      }),
      false,
    );
    assert.equal(
      isVideoGameSummary({
        title: "Marvel Games",
        description: "Video game publisher",
      }),
      false,
    );
  });

  it("proxies Wikimedia cover art", () => {
    const url = wikiImageUrl(
      "https://upload.wikimedia.org/wikipedia/en/a/a9/Astro_Bot_cover_art.jpg?utm_source=x",
    );
    assert.ok(url?.startsWith("/api/catalog/art?src="));
    assert.ok(url && decodeURIComponent(url).includes("Astro_Bot_cover_art.jpg"));
    assert.equal(wikiImageUrl("https://evil.example/x.jpg"), null);
  });
});
