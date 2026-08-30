import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchWikidataRelations,
  isWikidataCacheFresh,
  parseSparqlRelations,
  WIKIDATA_TTL_MS,
  wikidataSparql,
} from "./wikidata.server.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/sparql-results+json" },
  });
}

describe("wikidata SPARQL", () => {
  it("looks up by IGDB slug when present, otherwise by numeric id", () => {
    const bySlug = wikidataSparql(1942, "the-witcher-3-wild-hunt");
    assert.match(bySlug, /wdt:P5794 "the-witcher-3-wild-hunt"/);
    assert.doesNotMatch(bySlug, /wdt:P9043 "1942"/);
    assert.match(bySlug, /wdt:P155/);
    assert.match(bySlug, /wdt:P156/);
    assert.match(bySlug, /\?followsIgdb/);
    assert.match(bySlug, /\?followedByIgdb/);

    const byId = wikidataSparql(1942);
    assert.match(byId, /wdt:P9043 "1942"/);
    assert.match(byId, /wdt:P5794 "1942"/);
    assert.match(byId, /wdt:P155/);
    assert.match(byId, /wdt:P156/);
  });
});

describe("parseSparqlRelations", () => {
  it("reads numeric literal bindings from the SPARQL JSON shape", () => {
    const parsed = parseSparqlRelations({
      results: {
        bindings: [
          {
            followsIgdb: { type: "literal", value: "80" },
            followedByIgdb: { type: "literal", value: "1943" },
          },
        ],
      },
    });
    assert.deepEqual(parsed, {
      prequelIgdbId: 80,
      sequelIgdbId: 1943,
      prequelSlug: null,
      sequelSlug: null,
    });
  });

  it("accepts a URI-shaped value by taking the last path segment", () => {
    const parsed = parseSparqlRelations({
      results: {
        bindings: [
          {
            followsIgdb: { value: "https://www.igdb.com/games/80" },
          },
        ],
      },
    });
    assert.equal(parsed.prequelIgdbId, 80);
    assert.equal(parsed.sequelIgdbId, null);
    assert.equal(parsed.prequelSlug, null);
    assert.equal(parsed.sequelSlug, null);
  });

  it("returns nulls for empty, missing, or junk bindings", () => {
    assert.deepEqual(parseSparqlRelations(null), {
      prequelIgdbId: null,
      sequelIgdbId: null,
      prequelSlug: null,
      sequelSlug: null,
    });
    assert.deepEqual(parseSparqlRelations({ results: { bindings: [] } }), {
      prequelIgdbId: null,
      sequelIgdbId: null,
      prequelSlug: null,
      sequelSlug: null,
    });
    assert.deepEqual(
      parseSparqlRelations({
        results: {
          bindings: [{ followsIgdb: { value: "not-a-number" } }],
        },
      }),
      {
        prequelIgdbId: null,
        sequelIgdbId: null,
        prequelSlug: null,
        sequelSlug: null,
      },
    );
  });

  it("takes the first valid prequel and sequel across multiple rows", () => {
    const parsed = parseSparqlRelations({
      results: {
        bindings: [
          { followsIgdb: { value: "80" } },
          { followedByIgdb: { value: "1943" } },
        ],
      },
    });
    assert.deepEqual(parsed, {
      prequelIgdbId: 80,
      sequelIgdbId: 1943,
      prequelSlug: null,
      sequelSlug: null,
    });
  });

  it("reads slug bindings when numeric IDs are missing", () => {
    const parsed = parseSparqlRelations({
      results: {
        bindings: [
          {
            followsSlug: { type: "literal", value: "portal" },
            followedBySlug: { type: "literal", value: "portal-2" },
            followsIgdb: { type: "literal", value: "71" },
          },
        ],
      },
    });
    assert.deepEqual(parsed, {
      prequelIgdbId: 71,
      sequelIgdbId: null,
      prequelSlug: "portal",
      sequelSlug: "portal-2",
    });
  });
});

describe("wikidata cache TTL", () => {
  it("treats a 29-day-old row as fresh and a 31-day-old row as stale", () => {
    const now = Date.UTC(2026, 7, 30);
    assert.equal(isWikidataCacheFresh(now - 29 * 24 * 60 * 60 * 1000, now), true);
    assert.equal(isWikidataCacheFresh(now - 31 * 24 * 60 * 60 * 1000, now), false);
    assert.equal(WIKIDATA_TTL_MS, 30 * 24 * 60 * 60 * 1000);
  });
});

describe("fetchWikidataRelations", () => {
  it("parses a successful SPARQL response and sends the required headers", async () => {
    let url = "";
    let headers: Headers | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      url = String(input);
      headers = new Headers(init?.headers);
      const body = decodeURIComponent(String(init?.body ?? "").replace(/\+/g, " "));
      assert.match(body, /P5794 "1942"/);
      return jsonResponse({
        results: {
          bindings: [
            {
              followsIgdb: { value: "80" },
              followedByIgdb: { value: "1943" },
            },
          ],
        },
      });
    };
    const rel = await fetchWikidataRelations(1942, fetchImpl);
    assert.equal(url, "https://query.wikidata.org/sparql");
    assert.equal(headers?.get("Accept"), "application/sparql-results+json");
    assert.match(headers?.get("User-Agent") ?? "", /SaveState\/1\.0/);
    assert.deepEqual(rel, {
      prequelIgdbId: 80,
      sequelIgdbId: 1943,
      prequelSlug: null,
      sequelSlug: null,
    });
  });

  it("returns empty relations on HTTP errors, timeouts, and invalid ids", async () => {
    const boom: typeof fetch = async () => jsonResponse({}, 500);
    assert.deepEqual(await fetchWikidataRelations(1942, boom), {
      prequelIgdbId: null,
      sequelIgdbId: null,
      prequelSlug: null,
      sequelSlug: null,
    });
    const timeout: typeof fetch = async () => {
      throw new DOMException("The operation was aborted.", "TimeoutError");
    };
    assert.deepEqual(await fetchWikidataRelations(1942, timeout), {
      prequelIgdbId: null,
      sequelIgdbId: null,
      prequelSlug: null,
      sequelSlug: null,
    });
    let called = 0;
    const spy: typeof fetch = async () => {
      called += 1;
      return jsonResponse({ results: { bindings: [] } });
    };
    assert.deepEqual(await fetchWikidataRelations(0, spy), {
      prequelIgdbId: null,
      sequelIgdbId: null,
      prequelSlug: null,
      sequelSlug: null,
    });
    assert.equal(called, 0);
  });
});
