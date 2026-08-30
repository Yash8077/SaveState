import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_CATALOG_PROVIDER,
  parseCatalogProvider,
} from "./catalog-provider.ts";

describe("parseCatalogProvider", () => {
  it("defaults unknown values to IGDB", () => {
    assert.equal(parseCatalogProvider(null), DEFAULT_CATALOG_PROVIDER);
    assert.equal(parseCatalogProvider("anilist"), "igdb");
    assert.equal(parseCatalogProvider("IGDB"), "igdb");
  });

  it("accepts steam", () => {
    assert.equal(parseCatalogProvider("steam"), "steam");
    assert.equal(parseCatalogProvider("igdb"), "igdb");
  });
});
