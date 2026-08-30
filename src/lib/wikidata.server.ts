export type WikidataRelations = {
  prequelIgdbId: number | null;
  sequelIgdbId: number | null;
  prequelSlug: string | null;
  sequelSlug: string | null;
};

const SPARQL_URL = "https://query.wikidata.org/sparql";
const FETCH_MS = 4000;
export const WIKIDATA_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const UA = "SaveState/1.0 (https://github.com/Yash8077/SaveState)";
const EMPTY: WikidataRelations = {
  prequelIgdbId: null,
  sequelIgdbId: null,
  prequelSlug: null,
  sequelSlug: null,
};
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,120}$/;

const mem = new Map<number, { at: number; data: WikidataRelations }>();

export function safeIgdbSlug(value: string | null | undefined): string | null {
  if (!value) return null;
  const slug = value.trim().toLowerCase();
  return SLUG_RE.test(slug) ? slug : null;
}

function sparqlString(value: string): string {
  return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}
