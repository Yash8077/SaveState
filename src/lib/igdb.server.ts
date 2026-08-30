import type { CatalogDetails, CatalogGame, FeaturedRail } from "./types.ts";
import { slimCatalogGame } from "./catalog-seed.ts";
import {
  needsPrequelSequelFallback,
  prependPrequelSequel,
} from "./related.ts";
import { fetchWikidataRelations } from "./wikidata.server.ts";
import { GAME_TYPE } from "./game-type.ts";

export { GAME_TYPE } from "./game-type.ts";

const FETCH_MS = 8000;
const IMG = "https://images.igdb.com/igdb/image/upload";

type Token = { access: string; clientId: string; exp: number };
let token: Token | null = null;
let tokenInflight: Promise<Token> | null = null;
let skipCachedToken = false;

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
  aggregated_rating_count?: number;
  total_rating?: number;
  rating?: number;
  total_rating_count?: number;
  hypes?: number;
  category?: number;
  game_type?: number;
  url?: string;
  cover?: IgdbImage | number;
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
  parent_game?: IgdbGame | number;
  version_parent?: IgdbGame | number;
  dlcs?: IgdbGame[];
  expansions?: IgdbGame[];
  expanded_games?: IgdbGame[];
  remakes?: IgdbGame[];
  remasters?: IgdbGame[];
  standalone_expansions?: IgdbGame[];
};

function credentials(): { id: string; secret: string } | null {
  const id = (
    process.env.TWITCH_CLIENT_ID ||
    process.env.IGDB_CLIENT_ID ||
    ""
  ).trim();
  const secret = (
    process.env.TWITCH_CLIENT_SECRET ||
    process.env.IGDB_CLIENT_SECRET ||
    process.env.TWITCH_SECRET ||
    ""
  ).trim();
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

// IGDB moved GameCategoryEnum onto the `game_types` table (`game_type`).
// Docs (api-docs.igdb.com/#migration-enums-to-tables): "All current enum
// values will remain the same in the new table structure. Only the field
// names are changing, not the values they contain." Confirmed against
// api-docs.igdb.com/#game-type and the deprecated Game enums table.

export const SEARCH_KEEP_GAME_TYPES = new Set<number>([
  GAME_TYPE.main_game,
  GAME_TYPE.standalone_expansion,
  GAME_TYPE.remake,
  GAME_TYPE.remaster,
  GAME_TYPE.expanded_game,
  GAME_TYPE.port,
]);

const SEARCH_KEEP_IDS = [...SEARCH_KEEP_GAME_TYPES].join(",");

export const SEARCH_WHERE = `version_parent = null & (game_type = (${SEARCH_KEEP_IDS}) | (game_type = null & (category = (${SEARCH_KEEP_IDS}) | category = null)))`;

function img(id: string | undefined, size: string): string | null {
  return id ? `${IMG}/t_${size}/${id}.jpg` : null;
}

function coverImageId(cover: IgdbImage | number | undefined): string | undefined {
  if (!cover || typeof cover === "number") return undefined;
  return cover.image_id;
}

function quote(value: string): string {
  return JSON.stringify(value);
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

function parentCatalogId(value: IgdbGame | number | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return igdbCatalogId(value);
  }
  if (value && typeof value === "object" && typeof value.id === "number") {
    return igdbCatalogId(value.id);
  }
  return null;
}

function numericType(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function gameKind(game: IgdbGame): number | null {
  return numericType(game.game_type) ?? numericType(game.category);
}

export function isSearchableGame(game: IgdbGame): boolean {
  const kind = gameKind(game);
  if (kind == null) return true;
  return SEARCH_KEEP_GAME_TYPES.has(kind);
}

export function mapSearchHits(rows: IgdbGame[] | null | undefined): CatalogGame[] {
  const seen = new Set<string>();
  const games: CatalogGame[] = [];
  for (const row of rows ?? []) {
    if (!isSearchableGame(row)) continue;
    const mapped = toGame(row);
    if (!mapped || seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    games.push(slimCatalogGame(mapped));
  }
  return games;
}

export function igdbRating100(game: {
  total_rating?: number;
  aggregated_rating?: number;
  rating?: number;
}): number | null {
  const n = game.total_rating ?? game.aggregated_rating ?? game.rating;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function applyIgdbRatings<T extends CatalogGame>(
  games: T[],
  ratings: Map<string, number>,
): T[] {
  if (!ratings.size) return games;
  return games.map((game) => {
    const score = ratings.get(game.id);
    if (score == null) return game;
    return { ...game, metacritic: score };
  });
}

export function toGame(
  game: IgdbGame,
  coverSize = "cover_big_2x",
): CatalogGame | null {
  if (!game.id || !game.name) return null;
  const cover = img(coverImageId(game.cover), coverSize);
  const header =
    img(game.screenshots?.[0]?.image_id, "screenshot_med") || cover;
  const rating = igdbRating100(game);
  return {
    id: igdbCatalogId(game.id),
    steamId: null,
    title: game.name,
    coverUrl: cover,
    headerUrl: header,
    capsuleUrl: cover,
    platforms: names(game.platforms).slice(0, 6),
    metacritic: rating,
    parentGameId: parentCatalogId(game.parent_game),
    gameType: gameKind(game),
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
    const game = toGame(row);
    if (!game || seen.has(game.id)) continue;
    seen.add(game.id);
    out.push(slimCatalogGame(game));
    if (out.length >= limit) break;
  }
  return out;
}

export function relatedIdsMissingArt(rails: FeaturedRail[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const rail of rails) {
    for (const game of rail.games) {
      if (game.coverUrl || game.headerUrl) continue;
      const id = parseIgdbId(game.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function relatedIgdbIds(rails: FeaturedRail[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const rail of rails) {
    for (const game of rail.games) {
      const id = parseIgdbId(game.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function applyRelatedArt(
  rails: FeaturedRail[],
  cards: CatalogGame[],
): FeaturedRail[] {
  if (!cards.length) return rails;
  const byId = new Map(cards.map((game) => [game.id, game]));
  return rails.map((rail) => ({
    ...rail,
    games: rail.games.map((game) => {
      const filled = byId.get(game.id);
      if (!filled) return game;
      return {
        ...game,
        title: game.title || filled.title,
        coverUrl: filled.coverUrl ?? game.coverUrl,
        headerUrl: filled.headerUrl ?? game.headerUrl,
        capsuleUrl: filled.capsuleUrl ?? game.capsuleUrl,
      };
    }),
  }));
}

export function dropCoverlessSimilar(rails: FeaturedRail[]): FeaturedRail[] {
  return rails
    .map((rail) => {
      if (rail.id !== "similar" && rail.id !== "franchise") return rail;
      return {
        ...rail,
        games: rail.games.filter((game) => game.coverUrl || game.headerUrl),
      };
    })
    .filter((rail) => rail.games.length > 0);
}

async function hydrateRelatedCovers(
  rails: FeaturedRail[],
): Promise<FeaturedRail[]> {
  const fetchIds = relatedIdsMissingArt(rails);
  if (!fetchIds.length) return dropCoverlessSimilar(rails);
  try {
    const rows = await igdb<IgdbGame[]>(
      "games",
      `fields name, cover.image_id, screenshots.image_id;
       where id = (${fetchIds.join(",")});
       limit ${Math.min(50, fetchIds.length)};`,
    );
    const cards: CatalogGame[] = [];
    for (const row of rows ?? []) {
      const mapped = toGame(row);
      if (mapped) cards.push(slimCatalogGame(mapped));
    }
    return dropCoverlessSimilar(applyRelatedArt(rails, cards));
  } catch {
    return dropCoverlessSimilar(rails);
  }
}

async function hydrateSimilarGames(game: IgdbGame): Promise<IgdbGame> {
  const similar = asGames(game.similar_games);
  const ids = similar
    .map((row) => row.id)
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
  if (!ids.length) return game;
  const needsFetch = similar.some((row) => !row.name || !coverImageId(row.cover));
  if (!needsFetch) return game;
  try {
    const rows = await igdb<IgdbGame[]>(
      "games",
      `fields name, cover.image_id, screenshots.image_id, first_release_date;
       where id = (${ids.slice(0, 20).join(",")});
       limit 20;`,
    );
    if (!rows?.length) return game;
    return { ...game, similar_games: rows };
  } catch {
    return game;
  }
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
      asGames([
        ...(game.expansions ?? []),
        ...(game.dlcs ?? []),
        ...(game.standalone_expansions ?? []),
        ...(game.expanded_games ?? []),
      ]),
      self,
    ),
  );
  push(
    "remakes",
    "Remakes & remasters",
    mapRelatedList(asGames([...(game.remakes ?? []), ...(game.remasters ?? [])]), self),
  );
  push("similar", "Similar games", mapRelatedList(asGames(game.similar_games), self));
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
      const mapped = toGame(row);
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
  if (!skipCachedToken && token && tokenStillValid(token, creds.id)) return token;
  if (tokenInflight) return tokenInflight;

  tokenInflight = (async () => {
    if (!skipCachedToken) {
      const cached = await readTokenFromDb(creds.id);
      if (cached && tokenStillValid(cached, creds.id)) {
        token = cached;
        return cached;
      }
    }
    skipCachedToken = false;
    const fresh = await fetchTwitchToken(creds);
    token = fresh;
    void writeTokenToDb(fresh);
    return fresh;
  })().finally(() => {
    tokenInflight = null;
  });

  return tokenInflight;
}

function invalidateToken() {
  token = null;
  skipCachedToken = true;
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
    if (res.status === 401 || res.status === 403) {
      invalidateToken();
      continue;
    }
    if (res.status !== 429 && res.status < 500) throw lastError;
  }
  throw lastError ?? new Error("IGDB request failed");
}

export const SEARCH_FIELDS = "name, cover.image_id, game_type, category, parent_game, total_rating, aggregated_rating, rating";
export const CARD_FIELDS =
  "name, cover.image_id, first_release_date, total_rating, aggregated_rating, rating, aggregated_rating_count, hypes";
const REL_NEST =
  "name, cover.image_id, first_release_date, category";
export const DETAIL_FIELDS = `${CARD_FIELDS}, platforms.abbreviation, platforms.name, genres.name, slug, summary, url, screenshots.image_id, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, websites.url, websites.category, collection.id, collection.name, collections.id, collections.name, similar_games.${REL_NEST}, parent_game.${REL_NEST}, version_parent.${REL_NEST}, dlcs.${REL_NEST}, expansions.${REL_NEST}, expanded_games.${REL_NEST}, remakes.${REL_NEST}, remasters.${REL_NEST}, standalone_expansions.${REL_NEST}, franchise.name, franchise.games.${REL_NEST}, franchises.name, franchises.games.${REL_NEST}`;

/** IGDB `external_games.category` for Steam store apps. */
export const IGDB_STEAM_CATEGORY = 1;

export function searchNeedle(raw: string): string {
  return raw
    .replace(/[\n\r*"\\()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function buildIgdbSearchBody(query: string): string | null {
  const q = searchNeedle(query);
  if (q.length < 3) return null;
  return `search ${quote(q)}; fields ${SEARCH_FIELDS}; where ${SEARCH_WHERE}; limit 24;`;
}

export function buildIgdbContainsBody(query: string): string | null {
  const q = searchNeedle(query);
  if (q.length < 2) return null;
  return `fields ${SEARCH_FIELDS}; where name ~ *${quote(q)}* & ${SEARCH_WHERE}; limit 24; sort aggregated_rating_count desc;`;
}

type ExternalGame = {
  id?: number;
  uid?: string;
  category?: number;
  game?: number | IgdbGame;
};

function steamGameId(row: ExternalGame | undefined): number | null {
  if (!row) return null;
  if (typeof row.game === "number" && Number.isFinite(row.game)) return row.game;
  if (row.game && typeof row.game === "object" && typeof row.game.id === "number") {
    return row.game.id;
  }
  return null;
}

export async function lookupIgdbIdBySteamId(
  steamId: number,
): Promise<number | null> {
  if (!Number.isFinite(steamId) || steamId <= 0) return null;
  try {
    const rows = await igdb<ExternalGame[]>(
      "external_games",
      `fields game, uid;
       where uid = ${quote(String(Math.trunc(steamId)))} & category = ${IGDB_STEAM_CATEGORY};
       limit 8;`,
    );
    for (const row of rows ?? []) {
      const id = steamGameId(row);
      if (id) return id;
    }
  } catch {
    return null;
  }
  return null;
}

export async function lookupIgdbBySteamIds(
  steamIds: number[],
): Promise<CatalogGame[]> {
  const ids = [
    ...new Set(
      steamIds.filter((id) => Number.isFinite(id) && id > 0).map(Math.trunc),
    ),
  ].slice(0, 20);
  if (!ids.length) return [];
  try {
    const uids = ids.map((id) => quote(String(id))).join(",");
    const rows = await igdb<ExternalGame[]>(
      "external_games",
      `fields game, uid;
       where uid = (${uids}) & category = ${IGDB_STEAM_CATEGORY};
       limit 50;`,
    );
    const gameIds = [
      ...new Set(
        (rows ?? []).map(steamGameId).filter((id): id is number => id != null),
      ),
    ];
    if (!gameIds.length) return [];
    const games = await igdb<IgdbGame[]>(
      "games",
      `fields ${SEARCH_FIELDS};
       where id = (${gameIds.join(",")});
       limit 20;`,
    );
    const out: CatalogGame[] = [];
    const seen = new Set<string>();
    for (const row of games ?? []) {
      const mapped = toGame(row);
      if (!mapped || seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      out.push(slimCatalogGame(mapped));
    }
    return out;
  } catch {
    return [];
  }
}

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
  const q = searchNeedle(query);
  if (q.length < 2) return [];
  const bodies = [buildIgdbContainsBody(q), buildIgdbSearchBody(q)].filter(
    (body): body is string => Boolean(body),
  );
  const rows: IgdbGame[] = [];
  const settled = await Promise.allSettled(
    bodies.map((body) => igdb<IgdbGame[]>("games", body)),
  );
  for (const result of settled) {
    if (result.status === "fulfilled") rows.push(...(result.value ?? []));
  }
  return mapSearchHits(rows);
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
  const filled = await hydrateSimilarGames(await hydrateCollections(game));
  const base = toGame(filled);
  if (!base) return null;
  const shots = (filled.screenshots ?? [])
    .map((s) => img(s.image_id, "screenshot_med"))
    .filter((src): src is string => Boolean(src))
    .slice(0, 8);
  const site =
    filled.websites?.find((w) => w.category === 1)?.url || filled.url || null;
  const release = filled.first_release_date ?? 0;
  const related = await hydrateRelatedCovers(
    await withWikidataFallback(filled, relatedRails(filled)),
  );
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
  where cover != null & version_parent = null & category = 0 & aggregated_rating_count > 80;
  sort aggregated_rating_count desc;
  limit 16;
};
query games "new" {
  fields ${CARD_FIELDS};
  where cover != null & version_parent = null & category = 0 & first_release_date > ${now - 90 * day} & first_release_date <= ${now} & aggregated_rating_count > 10;
  sort aggregated_rating_count desc;
  limit 16;
};
query games "soon" {
  fields ${CARD_FIELDS};
  where cover != null & version_parent = null & category = 0 & first_release_date > ${now} & first_release_date < ${now + 540 * day} & hypes > 8;
  sort hypes desc;
  limit 16;
};
query games "top" {
  fields ${CARD_FIELDS};
  where cover != null & version_parent = null & category = 0 & aggregated_rating > 80 & aggregated_rating_count > 40;
  sort aggregated_rating_count desc;
  limit 16;
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
      const mapped = toGame(game);
      if (!mapped || seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      games.push(slimCatalogGame(mapped));
    }
    if (games.length) rails.push({ id: key, title, games });
  }
  return rails;
}

export async function lookupIgdbByTitles(titles: string[]): Promise<CatalogGame[]> {
  const names = [
    ...new Set(
      titles
        .map((title) => title.replace(/\s*\(video game\)$/i, "").trim())
        .filter((title) => title.length >= 2),
    ),
  ].slice(0, 16);
  if (!names.length) return [];
  try {
    const quoted = names.map(quote).join(",");
    const rows = await igdb<IgdbGame[]>(
      "games",
      `fields ${SEARCH_FIELDS}, first_release_date, aggregated_rating_count, hypes;
       where name = (${quoted}) & ${SEARCH_WHERE};
       limit 20;`,
    );
    return mapSearchHits(rows);
  } catch {
    return [];
  }
}

/** IGDB platform ids: PS5 = 167, PS4 = 48, PC = 6. */
export const PLAYSTATION_PLATFORM_IDS = "167,48";
export const PLAYSTATION_PS5_ID = 167;
export const PLAYSTATION_PC_ID = 6;
export const PLAYSTATION_FRESH_SECONDS = 18 * 30 * 24 * 60 * 60;

export const PLAYSTATION_FALLBACK_TITLES = [
  "Astro Bot",
  "Marvel's Spider-Man 2",
  "Marvel's Wolverine",
  "God of War Ragnarök",
  "The Last of Us Part II",
  "Ghost of Tsushima",
  "Horizon Forbidden West",
  "Returnal",
  "Ratchet & Clank: Rift Apart",
  "Gran Turismo 7",
  "Stellar Blade",
  "Final Fantasy VII Rebirth",
  "Demon's Souls",
  "Death Stranding 2: On the Beach",
];

export function playstationPopularBody(): string {
  return `fields ${CARD_FIELDS};
       where cover != null & version_parent = null & category = 0 & platforms = (${PLAYSTATION_PS5_ID}) & (game_type != ${GAME_TYPE.port} | game_type = null);
       sort aggregated_rating_count desc;
       limit 20;`;
}

export function playstationFreshBody(now = Date.now()): string {
  const cutoff = Math.floor(now / 1000) - PLAYSTATION_FRESH_SECONDS;
  return `fields ${CARD_FIELDS};
       where cover != null & version_parent = null & category = 0 & platforms = (${PLAYSTATION_PS5_ID}) & platforms != (${PLAYSTATION_PC_ID}) & first_release_date > ${cutoff} & (game_type != ${GAME_TYPE.port} | game_type = null);
       sort hypes desc;
       limit 20;`;
}

export function mixPlaystationGames(
  fresh: CatalogGame[],
  popular: CatalogGame[],
  limit = 12,
): CatalogGame[] {
  const out: CatalogGame[] = [];
  const seen = new Set<string>();
  const take = (game: CatalogGame | undefined) => {
    if (!game?.coverUrl || seen.has(game.id)) return;
    seen.add(game.id);
    out.push(game);
  };
  let i = 0;
  let j = 0;
  while (out.length < limit && (i < fresh.length || j < popular.length)) {
    if (i < fresh.length) take(fresh[i++]);
    if (out.length >= limit) break;
    if (j < popular.length) take(popular[j++]);
  }
  return out;
}

export async function fetchIgdbPlaystation(): Promise<FeaturedRail | null> {
  const [rated, hyped] = await Promise.all([
    igdb<IgdbGame[]>("games", playstationPopularBody()),
    igdb<IgdbGame[]>("games", playstationFreshBody()),
  ]);
  const toCards = (rows: IgdbGame[] | undefined) => {
    const games: CatalogGame[] = [];
    const seen = new Set<string>();
    for (const row of rows ?? []) {
      const mapped = toGame(row);
      if (!mapped?.coverUrl || seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      games.push(slimCatalogGame(mapped));
    }
    return games;
  };
  let games = mixPlaystationGames(toCards(hyped), toCards(rated));
  if (games.length < 8) {
    const fallback = await lookupIgdbByTitles(PLAYSTATION_FALLBACK_TITLES);
    games = mixPlaystationGames(games, fallback.filter((game) => Boolean(game.coverUrl)));
  }
  if (!games.length) return null;
  return { id: "playstation", title: "PlayStation", games: games.slice(0, 12) };
}

export function popularityValue(
  hypes?: number | null,
  ratingCount?: number | null,
): number {
  const h = typeof hypes === "number" && Number.isFinite(hypes) ? hypes : 0;
  const r =
    typeof ratingCount === "number" && Number.isFinite(ratingCount) ? ratingCount : 0;
  return h * 40 + r;
}

/** Most-hyped unreleased games, used to keep Coming soon free of no-name titles. */
export async function fetchIgdbAnticipated(): Promise<CatalogGame[]> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await igdb<IgdbGame[]>(
    "games",
    `fields ${CARD_FIELDS};
     where cover != null & version_parent = null & category = 0 & first_release_date > ${now} & hypes > 15;
     sort hypes desc;
     limit 16;`,
  );
  const games: CatalogGame[] = [];
  const seen = new Set<string>();
  for (const row of rows ?? []) {
    const mapped = toGame(row);
    if (!mapped?.coverUrl || seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    games.push(slimCatalogGame(mapped));
  }
  return games;
}

export async function fetchPopularityScores(
  games: CatalogGame[],
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const igdbIds: number[] = [];
  const steamIds: number[] = [];
  const steamToCatalog = new Map<number, string>();
  for (const game of games) {
    const igdbId = parseIgdbId(game.id);
    if (igdbId) igdbIds.push(igdbId);
    if (game.steamId) {
      steamIds.push(game.steamId);
      steamToCatalog.set(game.steamId, game.id);
    }
  }
  const uniqueIgdb = [...new Set(igdbIds)].slice(0, 50);
  const uniqueSteam = [...new Set(steamIds)].slice(0, 50);

  if (uniqueIgdb.length) {
    try {
      const rows = await igdb<IgdbGame[]>(
        "games",
        `fields hypes, aggregated_rating_count, total_rating_count;
         where id = (${uniqueIgdb.join(",")});
         limit ${uniqueIgdb.length};`,
      );
      for (const row of rows ?? []) {
        if (!row.id) continue;
        scores.set(
          igdbCatalogId(row.id),
          popularityValue(
            row.hypes,
            (row.aggregated_rating_count ?? 0) + (row.total_rating_count ?? 0),
          ),
        );
      }
    } catch {
      /* best-effort */
    }
  }

  if (uniqueSteam.length) {
    try {
      const uids = uniqueSteam.map((id) => quote(String(id))).join(",");
      const ext = await igdb<ExternalGame[]>(
        "external_games",
        `fields uid, game;
         where uid = (${uids}) & category = ${IGDB_STEAM_CATEGORY};
         limit 50;`,
      );
      const gameIdToSteam = new Map<number, number>();
      for (const row of ext ?? []) {
        const gid = steamGameId(row);
        const uid = row.uid ? Number(row.uid) : NaN;
        if (gid && Number.isFinite(uid)) gameIdToSteam.set(gid, uid);
      }
      const gids = [...gameIdToSteam.keys()];
      if (gids.length) {
        const rows = await igdb<IgdbGame[]>(
          "games",
          `fields hypes, aggregated_rating_count, total_rating_count;
           where id = (${gids.join(",")});
           limit ${Math.min(50, gids.length)};`,
        );
        for (const row of rows ?? []) {
          if (!row.id) continue;
          const steamId = gameIdToSteam.get(row.id);
          const catalogId = steamId != null ? steamToCatalog.get(steamId) : undefined;
          if (!catalogId) continue;
          scores.set(
            catalogId,
            popularityValue(
              row.hypes,
              (row.aggregated_rating_count ?? 0) + (row.total_rating_count ?? 0),
            ),
          );
        }
      }
    } catch {
      /* best-effort */
    }
  }

  return scores;
}

export async function fetchIgdbRatings(
  games: CatalogGame[],
): Promise<Map<string, number>> {
  const ratings = new Map<string, number>();
  const igdbIds: number[] = [];
  const steamIds: number[] = [];
  const steamToCatalog = new Map<number, string>();
  for (const game of games) {
    if (game.metacritic && game.metacritic > 0 && game.id.startsWith("igdb_")) {
      ratings.set(game.id, game.metacritic);
    }
    const igdbId = parseIgdbId(game.id);
    if (igdbId) igdbIds.push(igdbId);
    if (game.steamId) {
      steamIds.push(game.steamId);
      steamToCatalog.set(game.steamId, game.id);
    }
  }
  const uniqueIgdb = [...new Set(igdbIds)].slice(0, 50);
  const uniqueSteam = [...new Set(steamIds)].slice(0, 50);

  if (uniqueIgdb.length) {
    try {
      const rows = await igdb<IgdbGame[]>(
        "games",
        `fields total_rating, aggregated_rating, rating;
         where id = (${uniqueIgdb.join(",")});
         limit ${uniqueIgdb.length};`,
      );
      for (const row of rows ?? []) {
        if (!row.id) continue;
        const score = igdbRating100(row);
        if (score) ratings.set(igdbCatalogId(row.id), score);
      }
    } catch {
      /* best-effort */
    }
  }

  if (uniqueSteam.length) {
    try {
      const uids = uniqueSteam.map((id) => quote(String(id))).join(",");
      const ext = await igdb<ExternalGame[]>(
        "external_games",
        `fields uid, game;
         where uid = (${uids}) & category = ${IGDB_STEAM_CATEGORY};
         limit 50;`,
      );
      const gameIdToSteam = new Map<number, number>();
      for (const row of ext ?? []) {
        const gid = steamGameId(row);
        const uid = row.uid ? Number(row.uid) : NaN;
        if (gid && Number.isFinite(uid)) gameIdToSteam.set(gid, uid);
      }
      const gids = [...gameIdToSteam.keys()];
      if (gids.length) {
        const rows = await igdb<IgdbGame[]>(
          "games",
          `fields total_rating, aggregated_rating, rating;
           where id = (${gids.join(",")});
           limit ${Math.min(50, gids.length)};`,
        );
        for (const row of rows ?? []) {
          if (!row.id) continue;
          const score = igdbRating100(row);
          if (!score) continue;
          const steamId = gameIdToSteam.get(row.id);
          const catalogId =
            steamId != null ? steamToCatalog.get(steamId) : undefined;
          if (catalogId) ratings.set(catalogId, score);
        }
      }
    } catch {
      /* best-effort */
    }
  }

  return ratings;
}
