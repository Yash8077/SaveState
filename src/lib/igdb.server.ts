import type { CatalogDetails, CatalogGame, FeaturedRail } from "./types.ts";
import { slimCatalogGame } from "./catalog-seed.ts";
import {
  needsPrequelSequelFallback,
  prependPrequelSequel,
} from "./related.ts";
import { fetchWikidataRelations } from "./wikidata.server.ts";

const FETCH_MS = 4000;
const IMG = "https://images.igdb.com/igdb/image/upload";

type Token = { access: string; clientId: string; exp: number };
let token: Token | null = null;
let tokenInflight: Promise<Token> | null = null;

type IgdbImage = { image_id?: string };
type IgdbCompany = {
  developer?: boolean;
  publisher?: boolean;
  company?: { name?: string };
};
type IgdbWebsite = { url?: string; category?: number };
type IgdbGroup = { id?: number; name?: string; games?: IgdbGame[] };
export type IgdbGame = {
  id?: number;
  name?: string;
  slug?: string;
  summary?: string;
  first_release_date?: number;
  aggregated_rating?: number;
  category?: number;
  url?: string;
  cover?: IgdbImage;
  genres?: { name?: string }[];
  platforms?: { name?: string; abbreviation?: string }[];
  screenshots?: IgdbImage[];
  involved_companies?: IgdbCompany[];
  websites?: IgdbWebsite[];
  collection?: IgdbGroup | number;
  collections?: Array<IgdbGroup | number>;
  franchise?: IgdbGroup | number;
  franchises?: Array<IgdbGroup | number>;
  similar_games?: IgdbGame[];
  parent_game?: IgdbGame;
  version_parent?: IgdbGame;
  dlcs?: IgdbGame[];
  expansions?: IgdbGame[];
  expanded_games?: IgdbGame[];
  remakes?: IgdbGame[];
  remasters?: IgdbGame[];
  standalone_expansions?: IgdbGame[];
};

function credentials(): { id: string; secret: string } | null {
  const id = process.env.TWITCH_CLIENT_ID || process.env.IGDB_CLIENT_ID || "";
  const secret =
    process.env.TWITCH_CLIENT_SECRET || process.env.IGDB_CLIENT_SECRET || "";
  if (!id || !secret) return null;
  return { id, secret };
}

export function isIgdbReady(): boolean {
  return credentials() != null;
}

export function igdbCatalogId(id: number): string {
  return `igdb_${id}`;
}

export function parseIgdbId(catalogId: string): number | null {
  const match = /^igdb_(\d+)$/.exec(catalogId);
  return match ? Number(match[1]) : null;
}

function img(id: string | undefined, size: string): string | null {
  return id ? `${IMG}/t_${size}/${id}.jpg` : null;
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function unixDate(unix?: number): string | null {
  if (!unix) return null;
  return new Date(unix * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function names(list?: { name?: string; abbreviation?: string }[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list ?? []) {
    const label = item.abbreviation || item.name;
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

function companies(
  list: IgdbCompany[] | undefined,
  role: "developer" | "publisher",
): string[] {
  const out: string[] = [];
  for (const row of list ?? []) {
    const name = row.company?.name;
    if (!name) continue;
    if (role === "developer" && row.developer) out.push(name);
    if (role === "publisher" && row.publisher) out.push(name);
  }
  return out;
}

export function toGame(
  game: IgdbGame,
  coverSize = "cover_big",
): CatalogGame | null {
  if (!game.id || !game.name) return null;
  const cover = img(game.cover?.image_id, coverSize);
  const header =
    img(game.screenshots?.[0]?.image_id, "screenshot_med") || cover;
  const rating = game.aggregated_rating;
  return {
    id: igdbCatalogId(game.id),
    steamId: null,
    title: game.name,
    coverUrl: cover,
    headerUrl: header,
    capsuleUrl: cover,
    platforms: names(game.platforms).slice(0, 6),
    metacritic:
      typeof rating === "number" && Number.isFinite(rating)
        ? Math.round(rating)
        : null,
  };
}

function mapRelatedList(
  list: IgdbGame[] | undefined,
  excludeId: number | undefined,
  limit = 12,
): CatalogGame[] {
  const out: CatalogGame[] = [];
  const seen = new Set<string>();
  const sorted = [...(list ?? [])].sort((a, b) => {
    const da = a.first_release_date ?? 0;
    const db = b.first_release_date ?? 0;
    return da - db;
  });
  for (const row of sorted) {
    if (excludeId && row.id === excludeId) continue;
    const game = toGame(row, "cover_big");
    if (!game || seen.has(game.id)) continue;
    seen.add(game.id);
    out.push(slimCatalogGame(game));
    if (out.length >= limit) break;
  }
  return out;
}

function asGroup(value: unknown): IgdbGroup | null {
  if (typeof value === "number" && Number.isFinite(value)) return { id: value };
  if (!value || typeof value !== "object") return null;
  const row = value as IgdbGroup;
  return {
    id: typeof row.id === "number" ? row.id : undefined,
    name: row.name,
    games: asGames(row.games),
  };
}

function asGames(list: unknown): IgdbGame[] {
  if (!Array.isArray(list)) return [];
  const out: IgdbGame[] = [];
  for (const item of list) {
    if (typeof item === "number" && Number.isFinite(item)) {
      out.push({ id: item });
    } else if (item && typeof item === "object") {
      out.push(item as IgdbGame);
    }
  }
  return out;
}

function groupsOf(
  single: IgdbGroup | number | undefined,
  many: Array<IgdbGroup | number> | undefined,
): IgdbGroup[] {
  const out: IgdbGroup[] = [];
  const first = asGroup(single);
  if (first) out.push(first);
  for (const item of many ?? []) {
    const group = asGroup(item);
    if (group) out.push(group);
  }
  return out;
}

function mergeGroups(groups: IgdbGroup[] | undefined): IgdbGame[] {
  const out: IgdbGame[] = [];
  const seen = new Set<number>();
  for (const group of groups ?? []) {
    for (const row of asGames(group.games)) {
      if (!row.id || seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
  }
  return out;
}

function seriesSource(game: IgdbGame): { name: string | null; games: IgdbGame[] } {
  const groups = groupsOf(game.collection, game.collections);
  const named = groups.find((g) => g.name)?.name ?? null;
  return { name: named, games: mergeGroups(groups) };
}

function franchiseGames(game: IgdbGame): IgdbGame[] {
  return mergeGroups(groupsOf(game.franchise, game.franchises));
}

function splitByRelease(
  rows: IgdbGame[],
  self: number | undefined,
  selfDate: number,
): { prequels: IgdbGame[]; sequels: IgdbGame[]; rest: IgdbGame[] } {
  const prequels: IgdbGame[] = [];
  const sequels: IgdbGame[] = [];
  const rest: IgdbGame[] = [];
  const mains = rows.filter((row) => row.category == null || row.category === 0);
  const pool = mains.length ? mains : rows;
  for (const row of pool) {
    if (self && row.id === self) continue;
    const d = row.first_release_date ?? 0;
    if (selfDate && d && d < selfDate) prequels.push(row);
    else if (selfDate && d && d > selfDate) sequels.push(row);
    else rest.push(row);
  }
  return { prequels, sequels, rest };
}

export function relatedRails(game: IgdbGame): FeaturedRail[] {
  const self = game.id;
  const selfDate =
    game.first_release_date ??
    seriesSource(game).games.find((g) => g.id === self)?.first_release_date ??
    0;
  const rails: FeaturedRail[] = [];
  const seen = new Set<string>();

  const push = (id: string, title: string, games: CatalogGame[]) => {
    const unique = games.filter((g) => !seen.has(g.id));
    for (const g of unique) seen.add(g.id);
    if (unique.length) rails.push({ id, title, games: unique });
  };

  const series = seriesSource(game);
  const { prequels, sequels, rest } = splitByRelease(series.games, self, selfDate);
  push("prequel", "Prequel", mapRelatedList(prequels, self));
  push("sequel", "Sequel", mapRelatedList(sequels, self));

  const seriesTitle = series.name ? `In ${series.name}` : "Related games";
  if (rest.length) {
    push(
      "series",
      series.name ? `Also in ${series.name}` : "Related games",
      mapRelatedList(rest, self),
    );
  } else if (!prequels.length && !sequels.length && series.games.length) {
    push("series", seriesTitle, mapRelatedList(series.games, self));
  }

  push(
    "original",
    "Original",
    mapRelatedList(
      [game.parent_game, game.version_parent].filter((g): g is IgdbGame =>
        Boolean(g),
      ),
      self,
      4,
    ),
  );

  push("franchise", "Franchise", mapRelatedList(franchiseGames(game), self));

  push(
    "dlc",
    "DLC & expansions",
    mapRelatedList(
      [
        ...(game.expansions ?? []),
        ...(game.dlcs ?? []),
        ...(game.standalone_expansions ?? []),
        ...(game.expanded_games ?? []),
      ],
      self,
    ),
  );
  push(
    "remakes",
    "Remakes & remasters",
    mapRelatedList([...(game.remakes ?? []), ...(game.remasters ?? [])], self),
  );
  push("similar", "Similar games", mapRelatedList(game.similar_games, self));
  return rails;
}

export type WikidataCardIndex = {
  byId: Map<number, CatalogGame>;
  bySlug: Map<string, CatalogGame>;
};

export type WikidataRailDeps = {
  relations: (
    igdbId: number,
    slug?: string | null,
  ) => Promise<{
    prequelIgdbId: number | null;
    sequelIgdbId: number | null;
    prequelSlug?: string | null;
    sequelSlug?: string | null;
  }>;
  cards: (query: {
    ids: number[];
    slugs: string[];
  }) => Promise<WikidataCardIndex>;
};

export async function withWikidataFallback(
  game: IgdbGame,
  rails: FeaturedRail[],
  deps?: WikidataRailDeps,
): Promise<FeaturedRail[]> {
  if (!needsPrequelSequelFallback(rails) || !game.id) return rails;
  try {
    const lookup =
      deps?.relations ??
      ((id: number, slug?: string | null) => fetchWikidataRelations(id, fetch, slug));
    const loadCards = deps?.cards ?? fetchIgdbCards;
    const rel = await lookup(game.id, game.slug);
    const prequelId =
      rel.prequelIgdbId && rel.prequelIgdbId !== game.id
        ? rel.prequelIgdbId
        : null;
    const sequelId =
      rel.sequelIgdbId && rel.sequelIgdbId !== game.id ? rel.sequelIgdbId : null;
    const prequelSlug = rel.prequelSlug?.trim() || null;
    const sequelSlug = rel.sequelSlug?.trim() || null;
    const ids = [...new Set([prequelId, sequelId].filter((id): id is number => id != null))];
    const slugs = [
      ...new Set([prequelSlug, sequelSlug].filter((s): s is string => Boolean(s))),
    ];
    if (!ids.length && !slugs.length) return rails;
    const cards = await loadCards({ ids, slugs });
    const pick = (id: number | null, slug: string | null): CatalogGame | null => {
      if (id != null && cards.byId.has(id)) return cards.byId.get(id) ?? null;
      if (slug && cards.bySlug.has(slug)) return cards.bySlug.get(slug) ?? null;
      return null;
    };
    const prequel = pick(prequelId, prequelSlug);
    const sequel = pick(sequelId, sequelSlug);
    if (!prequel && !sequel) return rails;
    return prependPrequelSequel(rails, prequel, sequel);
  } catch {
    return rails;
  }
}

async function fetchIgdbCards(query: {
  ids: number[];
  slugs: string[];
}): Promise<WikidataCardIndex> {
  const empty: WikidataCardIndex = { byId: new Map(), bySlug: new Map() };
  const ids = [
    ...new Set(
      (query.ids ?? []).filter((id) => Number.isFinite(id) && id > 0).map(Math.trunc),
    ),
  ];
  const slugs = [
    ...new Set(
      (query.slugs ?? [])
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[a-z0-9][a-z0-9_-]{0,120}$/.test(s)),
    ),
  ];
  if (!ids.length && !slugs.length) return empty;
  const clauses: string[] = [];
  if (ids.length) clauses.push(`id = (${ids.join(",")})`);
  if (slugs.length) {
    const quoted = slugs
      .map((s) => '"' + s.replace(/"/g, "") + '"')
      .join(",");
    clauses.push("slug = (" + quoted + ")");
  }
  try {
    const rows = await igdb<IgdbGame[]>(
      "games",
      `fields ${CARD_FIELDS}, slug;
       where ${clauses.join(" | ")};
       limit ${Math.min(8, ids.length + slugs.length)};`,
    );
    const byId = new Map<number, CatalogGame>();
    const bySlug = new Map<string, CatalogGame>();
    for (const row of rows ?? []) {
      const mapped = toGame(row, "cover_big");
      if (!mapped || !row.id) continue;
      const card = slimCatalogGame(mapped);
      byId.set(row.id, card);
      if (row.slug) bySlug.set(row.slug.toLowerCase(), card);
    }
    return { byId, bySlug };
  } catch {
    return empty;
  }
}

function tokenStillValid(row: Token, clientId: string): boolean {
  return row.clientId === clientId && row.exp > Date.now() + 60_000;
}

async function readTokenFromDb(clientId: string): Promise<Token | null> {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<{ access_token: string; exp_ms: string | number }>(
      `select access_token, (extract(epoch from expires_at) * 1000) as exp_ms
       from igdb_token_cache where client_id = $1`,
      [clientId],
    );
    const row = rows[0];
    if (!row?.access_token) return null;
    const exp = Number(row.exp_ms);
    if (!Number.isFinite(exp) || exp <= Date.now() + 60_000) return null;
    return { access: row.access_token, clientId, exp };
  } catch {
    return null;
  }
}

async function writeTokenToDb(row: Token): Promise<void> {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query(
      `insert into igdb_token_cache (client_id, access_token, expires_at, updated_at)
       values ($1, $2, to_timestamp($3::double precision / 1000.0), now())
       on conflict (client_id) do update set
         access_token = excluded.access_token,
         expires_at = excluded.expires_at,
         updated_at = now()`,
      [row.clientId, row.access, row.exp],
    );
  } catch {
    /* cache is best-effort across cold starts */
  }
}

async function fetchTwitchToken(creds: { id: string; secret: string }): Promise<Token> {
  const body = new URLSearchParams({
    client_id: creds.id,
    client_secret: creds.secret,
    grant_type: "client_credentials",
  });
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) throw new Error(`IGDB auth failed (${res.status})`);
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) throw new Error("IGDB auth failed");
  const expires = Math.max(60, Number(data.expires_in) || 3600);
  return {
    access: data.access_token,
    clientId: creds.id,
    exp: Date.now() + (expires - 120) * 1000,
  };
}

async function getToken(): Promise<Token> {
  const creds = credentials();
  if (!creds) throw new Error("IGDB is not configured");
  if (token && tokenStillValid(token, creds.id)) return token;
  if (tokenInflight) return tokenInflight;

  tokenInflight = (async () => {
    const cached = await readTokenFromDb(creds.id);
    if (cached && tokenStillValid(cached, creds.id)) {
      token = cached;
      return cached;
    }
    const fresh = await fetchTwitchToken(creds);
    token = fresh;
    void writeTokenToDb(fresh);
    return fresh;
  })().finally(() => {
    tokenInflight = null;
  });

  return tokenInflight;
}

let ticks: number[] = [];
async function throttle(): Promise<void> {
  const now = Date.now();
  ticks = ticks.filter((t) => now - t < 1000);
  if (ticks.length >= 4) {
    await new Promise((r) => setTimeout(r, 1000 - (now - ticks[0]!)));
    ticks = ticks.filter((t) => Date.now() - t < 1000);
  }
  ticks.push(Date.now());
}

function retryDelay(attempt: number): number {
  const base = 250 * 2 ** (attempt - 1);
  return base + Math.random() * base;
}

async function igdb<T>(path: string, body: string): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, retryDelay(attempt)));
    }
    const auth = await getToken();
    await throttle();
    const res = await fetch(`https://api.igdb.com/v4/${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Client-ID": auth.clientId,
        Authorization: `Bearer ${auth.access}`,
      },
      body,
      signal: AbortSignal.timeout(FETCH_MS),
    });
    if (res.ok) return (await res.json()) as T;
    lastError = new Error(`IGDB request failed (${res.status})`);
    if (res.status !== 429 && res.status < 500) throw lastError;
  }
  throw lastError ?? new Error("IGDB request failed");
}

export const SEARCH_FIELDS = "name, cover.image_id";
export const CARD_FIELDS =
  "name, cover.image_id, first_release_date, aggregated_rating";
const REL_NEST =
  "name, cover.image_id, first_release_date, category";
export const DETAIL_FIELDS = `${CARD_FIELDS}, platforms.abbreviation, platforms.name, genres.name, slug, summary, url, screenshots.image_id, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, websites.url, websites.category, collection.id, collection.name, collections.id, collections.name, similar_games.${REL_NEST}, parent_game.${REL_NEST}, version_parent.${REL_NEST}, dlcs.${REL_NEST}, expansions.${REL_NEST}, expanded_games.${REL_NEST}, remakes.${REL_NEST}, remasters.${REL_NEST}, standalone_expansions.${REL_NEST}, franchise.name, franchise.games.${REL_NEST}, franchises.name, franchises.games.${REL_NEST}`;

function collectionIds(game: IgdbGame): number[] {
  const ids: number[] = [];
  for (const group of groupsOf(game.collection, game.collections)) {
    if (typeof group.id === "number") ids.push(group.id);
  }
  return [...new Set(ids)];
}

function namedSeriesGames(game: IgdbGame): boolean {
  return seriesSource(game).games.some((row) => Boolean(row.name));
}

async function hydrateCollections(game: IgdbGame): Promise<IgdbGame> {
  if (namedSeriesGames(game)) return game;
  const ids = collectionIds(game);
  if (!ids.length) return game;

  try {
    const groups = await igdb<IgdbGroup[]>(
      "collections",
      `fields name, games.name, games.cover.image_id, games.first_release_date, games.category;
       where id = (${ids.join(",")}); limit 10;`,
    );
    if ((groups ?? []).some((group) => asGames(group.games).some((row) => row.name))) {
      return { ...game, collections: groups };
    }
  } catch {
    /* fall through to a games-by-collection query */
  }

  try {
    const rows = await igdb<IgdbGame[]>(
      "games",
      `fields name, cover.image_id, first_release_date, category;
       where (collections = (${ids.join(",")}) | collection = (${ids.join(",")})) & version_parent = null;
       limit 50;
       sort first_release_date asc;`,
    );
    if (!rows?.length) return game;
    const name = seriesSource(game).name ?? undefined;
    return {
      ...game,
      collections: [{ id: ids[0], name, games: rows }],
    };
  } catch {
    return game;
  }
}

export async function searchIgdb(query: string): Promise<CatalogGame[]> {
  const q = query.replace(/[\n\r]/g, " ").trim().slice(0, 80);
  if (q.length < 2) return [];
  const rows = await igdb<IgdbGame[]>(
    "games",
    `search ${quote(q)}; fields ${SEARCH_FIELDS}; where version_parent = null; limit 12;`,
  );
  const seen = new Set<string>();
  const games: CatalogGame[] = [];
  for (const row of rows ?? []) {
    const game = toGame(row, "cover_big");
    if (!game || seen.has(game.id)) continue;
    seen.add(game.id);
    games.push(slimCatalogGame(game));
  }
  return games;
}

export async function fetchIgdbDetails(
  catalogId: string,
): Promise<CatalogDetails | null> {
  const id = parseIgdbId(catalogId);
  if (!id) return null;
  const rows = await igdb<IgdbGame[]>(
    "games",
    `fields ${DETAIL_FIELDS};
     where id = ${id}; limit 1;`,
  );
  const game = rows?.[0];
  if (!game) return null;
  const filled = await hydrateCollections(game);
  const base = toGame(filled, "cover_big");
  if (!base) return null;
  const shots = (filled.screenshots ?? [])
    .map((s) => img(s.image_id, "screenshot_med"))
    .filter((src): src is string => Boolean(src))
    .slice(0, 8);
  const site =
    filled.websites?.find((w) => w.category === 1)?.url || filled.url || null;
  const release = filled.first_release_date ?? 0;
  const related = await withWikidataFallback(filled, relatedRails(filled));
  return {
    ...base,
    summary: filled.summary ?? "",
    releaseDate: unixDate(filled.first_release_date),
    comingSoon: Boolean(release && release * 1000 > Date.now()),
    genres: names(filled.genres),
    developers: companies(filled.involved_companies, "developer"),
    publishers: companies(filled.involved_companies, "publisher"),
    screenshots: shots,
    website: site,
    headerUrl: shots[0] || base.headerUrl,
    related,
  };
}

type MultiRow = { name?: string; result?: IgdbGame[] };

export async function fetchIgdbFeatured(): Promise<FeaturedRail[]> {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;
  const body = `
query games "trending" {
  fields ${CARD_FIELDS};
  where cover != null & version_parent = null & category = 0 & aggregated_rating_count > 30;
  sort aggregated_rating_count desc;
  limit 12;
};
query games "new" {
  fields ${CARD_FIELDS};
  where cover != null & version_parent = null & category = 0 & first_release_date > ${now - 90 * day} & first_release_date <= ${now};
  sort first_release_date desc;
  limit 12;
};
query games "soon" {
  fields ${CARD_FIELDS};
  where cover != null & version_parent = null & category = 0 & first_release_date > ${now} & first_release_date < ${now + 180 * day};
  sort first_release_date asc;
  limit 12;
};
query games "top" {
  fields ${CARD_FIELDS};
  where cover != null & version_parent = null & category = 0 & aggregated_rating > 80 & aggregated_rating_count > 20;
  sort aggregated_rating desc;
  limit 12;
};
`;
  const rows = await igdb<MultiRow[]>("multiquery", body);
  const titles: Record<string, string> = {
    trending: "Popular",
    new: "New releases",
    soon: "Coming soon",
    top: "Highly rated",
  };
  const rails: FeaturedRail[] = [];
  for (const row of rows ?? []) {
    const key = row.name ?? "";
    const title = titles[key];
    if (!title) continue;
    const games: CatalogGame[] = [];
    const seen = new Set<string>();
    for (const game of row.result ?? []) {
      const mapped = toGame(game, "cover_big");
      if (!mapped || seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      games.push(slimCatalogGame(mapped));
    }
    if (games.length) rails.push({ id: key, title, games });
  }
  return rails;
}
