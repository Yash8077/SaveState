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
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}`;
}

export function wikidataSparql(igdbId: number, slug?: string | null): string {
  const id = String(Math.trunc(igdbId));
  const safeSlug = safeIgdbSlug(slug);
  // P5794 is the IGDB slug; P9043 is the numeric IGDB id (direct or
  // as a qualifier on P5794). Prefer the slug when we have it - a
  // UNION across both identifiers is too slow for the public endpoint.
  const subject = safeSlug
    ? `?game wdt:P5794 ${sparqlString(safeSlug)} .`
    : `{ ?game wdt:P9043 "${id}" . } UNION { ?game wdt:P5794 "${id}" . }`;
  return `SELECT ?followsIgdb ?followedByIgdb ?followsSlug ?followedBySlug WHERE {
  ${subject}
  OPTIONAL {
    ?game wdt:P155 ?follows .
    OPTIONAL { ?follows wdt:P9043 ?followsIgdb . }
    OPTIONAL { ?follows wdt:P5794 ?followsSlug . }
  }
  OPTIONAL {
    ?game wdt:P156 ?followedBy .
    OPTIONAL { ?followedBy wdt:P9043 ?followedByIgdb . }
    OPTIONAL { ?followedBy wdt:P5794 ?followedBySlug . }
  }
}`;
}

export function isWikidataCacheFresh(fetchedAtMs: number, nowMs: number): boolean {
  return nowMs - fetchedAtMs < WIKIDATA_TTL_MS;
}

function parseIgdbLiteral(binding: unknown): number | null {
  if (binding == null) return null;
  let raw: unknown = binding;
  if (typeof binding === "object" && binding !== null && "value" in binding) {
    raw = (binding as { value: unknown }).value;
  }
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.trunc(raw);
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const segment = trimmed.includes("/")
    ? (trimmed.replace(/\/+$/, "").split("/").pop() ?? trimmed)
    : trimmed;
  const n = Number(segment);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function parseSlugLiteral(binding: unknown): string | null {
  if (binding == null) return null;
  let raw: unknown = binding;
  if (typeof binding === "object" && binding !== null && "value" in binding) {
    raw = (binding as { value: unknown }).value;
  }
  return typeof raw === "string" ? safeIgdbSlug(raw) : null;
}

type SparqlBinding = {
  followsIgdb?: unknown;
  followedByIgdb?: unknown;
  followsSlug?: unknown;
  followedBySlug?: unknown;
};

export function parseSparqlRelations(data: unknown): WikidataRelations {
  if (!data || typeof data !== "object") return { ...EMPTY };
  const results = (data as { results?: { bindings?: unknown } }).results;
  const bindings = results?.bindings;
  if (!Array.isArray(bindings) || !bindings.length) return { ...EMPTY };

  let prequelIgdbId: number | null = null;
  let sequelIgdbId: number | null = null;
  let prequelSlug: string | null = null;
  let sequelSlug: string | null = null;
  for (const row of bindings) {
    if (!row || typeof row !== "object") continue;
    const binding = row as SparqlBinding;
    if (prequelIgdbId == null) prequelIgdbId = parseIgdbLiteral(binding.followsIgdb);
    if (sequelIgdbId == null) sequelIgdbId = parseIgdbLiteral(binding.followedByIgdb);
    if (prequelSlug == null) prequelSlug = parseSlugLiteral(binding.followsSlug);
    if (sequelSlug == null) sequelSlug = parseSlugLiteral(binding.followedBySlug);
    if (prequelIgdbId != null && sequelIgdbId != null && prequelSlug && sequelSlug) break;
  }
  return { prequelIgdbId, sequelIgdbId, prequelSlug, sequelSlug };
}

function hasRelation(data: WikidataRelations): boolean {
  return Boolean(
    data.prequelIgdbId || data.sequelIgdbId || data.prequelSlug || data.sequelSlug,
  );
}

async function queryWikidata(
  igdbId: number,
  slug: string | null | undefined,
  fetchImpl: typeof fetch,
): Promise<WikidataRelations> {
  const run = async (query: string): Promise<WikidataRelations> => {
    try {
      const res = await fetchImpl(SPARQL_URL, {
        method: "POST",
        headers: {
          Accept: "application/sparql-results+json",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent": UA,
        },
        body: new URLSearchParams({ query }),
        signal: AbortSignal.timeout(FETCH_MS),
      });
      if (!res.ok) return { ...EMPTY };
      const data: unknown = await res.json();
      return parseSparqlRelations(data);
    } catch {
      return { ...EMPTY };
    }
  };

  if (safeIgdbSlug(slug)) {
    const bySlug = await run(wikidataSparql(igdbId, slug));
    if (hasRelation(bySlug)) return bySlug;
  }
  return run(wikidataSparql(igdbId));
}

function memGet(igdbId: number): WikidataRelations | null {
  const hit = mem.get(igdbId);
  if (!hit) return null;
  if (!isWikidataCacheFresh(hit.at, Date.now())) {
    mem.delete(igdbId);
    return null;
  }
  return hit.data;
}

function memSet(igdbId: number, data: WikidataRelations): void {
  mem.set(igdbId, { at: Date.now(), data });
}

async function readFromDb(igdbId: number): Promise<WikidataRelations | null> {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<{
      prequel_igdb_id: string | number | null;
      sequel_igdb_id: string | number | null;
      prequel_slug: string | null;
      sequel_slug: string | null;
      fetched_ms: string | number;
    }>(
      `select prequel_igdb_id, sequel_igdb_id, prequel_slug, sequel_slug,
              (extract(epoch from fetched_at) * 1000) as fetched_ms
       from wikidata_relations_cache where igdb_id = $1`,
      [igdbId],
    );
    const row = rows[0];
    if (!row) return null;
    const fetched = Number(row.fetched_ms);
    if (!Number.isFinite(fetched) || !isWikidataCacheFresh(fetched, Date.now())) {
      return null;
    }
    return {
      prequelIgdbId: parseIgdbLiteral(row.prequel_igdb_id),
      sequelIgdbId: parseIgdbLiteral(row.sequel_igdb_id),
      prequelSlug: safeIgdbSlug(row.prequel_slug),
      sequelSlug: safeIgdbSlug(row.sequel_slug),
    };
  } catch {
    return null;
  }
}

async function writeToDb(igdbId: number, data: WikidataRelations): Promise<void> {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query(
      `insert into wikidata_relations_cache
         (igdb_id, prequel_igdb_id, sequel_igdb_id, prequel_slug, sequel_slug, fetched_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (igdb_id) do update set
         prequel_igdb_id = excluded.prequel_igdb_id,
         sequel_igdb_id = excluded.sequel_igdb_id,
         prequel_slug = excluded.prequel_slug,
         sequel_slug = excluded.sequel_slug,
         fetched_at = now()`,
      [igdbId, data.prequelIgdbId, data.sequelIgdbId, data.prequelSlug, data.sequelSlug],
    );
  } catch {
    /* cache is best-effort across cold starts */
  }
}

export async function fetchWikidataRelations(
  igdbId: number,
  fetchImpl: typeof fetch = fetch,
  slug?: string | null,
): Promise<WikidataRelations> {
  if (!Number.isFinite(igdbId) || igdbId <= 0) return { ...EMPTY };
  const id = Math.trunc(igdbId);
  const skipCache = Boolean(process.env.NODE_TEST_CONTEXT);
  if (!skipCache) {
    const cached = memGet(id) ?? (await readFromDb(id));
    if (cached) {
      memSet(id, cached);
      return cached;
    }
  }
  const fresh = await queryWikidata(id, slug, fetchImpl);
  if (!skipCache) {
    memSet(id, fresh);
    void writeToDb(id, fresh);
  }
  return fresh;
}
