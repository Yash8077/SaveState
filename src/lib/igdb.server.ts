import type { CatalogDetails, CatalogGame, FeaturedRail } from "./types.ts";
import { slimCatalogGame } from "./catalog-seed.ts";

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
export type IgdbGame = {
  id?: number;
  name?: string;
  slug?: string;
  summary?: string;
  first_release_date?: number;
  aggregated_rating?: number;
  url?: string;
  cover?: IgdbImage;
  genres?: { name?: string }[];
  platforms?: { name?: string; abbreviation?: string }[];
  screenshots?: IgdbImage[];
  involved_companies?: IgdbCompany[];
  websites?: IgdbWebsite[];
  collection?: { name?: string; games?: IgdbGame[] };
  franchises?: { name?: string; games?: IgdbGame[] }[];
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

export function relatedRails(game: IgdbGame): FeaturedRail[] {
  const self = game.id;
  const selfDate =
    game.first_release_date ??
    game.collection?.games?.find((g) => g.id === self)?.first_release_date ??
    0;
  const rails: FeaturedRail[] = [];
  const seen = new Set<string>();

  const push = (id: string, title: string, games: CatalogGame[]) => {
    const unique = games.filter((g) => !seen.has(g.id));
    for (const g of unique) seen.add(g.id);
    if (unique.length) rails.push({ id, title, games: unique });
  };

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

  const collection = game.collection?.games ?? [];
  const prequels: IgdbGame[] = [];
  const sequels: IgdbGame[] = [];
  const rest: IgdbGame[] = [];
  for (const row of collection) {
    if (self && row.id === self) continue;
    const d = row.first_release_date ?? 0;
    if (selfDate && d && d < selfDate) prequels.push(row);
    else if (selfDate && d && d > selfDate) sequels.push(row);
    else rest.push(row);
  }
  push("prequel", "Prequel", mapRelatedList(prequels, self));
  push("sequel", "Sequel", mapRelatedList(sequels, self));

  const seriesTitle = game.collection?.name
    ? `In ${game.collection.name}`
    : "In this series";
  if (rest.length) {
    push(
      "series",
      game.collection?.name
        ? `Also in ${game.collection.name}`
        : "In this series",
      mapRelatedList(rest, self),
    );
  } else if (!prequels.length && !sequels.length) {
    push("series", seriesTitle, mapRelatedList(collection, self));
  }

  if (!rails.some((r) => r.id === "prequel" || r.id === "sequel" || r.id === "series")) {
    const franchiseGames = (game.franchises ?? []).flatMap((f) => f.games ?? []);
    push("franchise", "Franchise", mapRelatedList(franchiseGames, self));
  }

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
  "name, cover.image_id, first_release_date";
export const DETAIL_FIELDS = `${CARD_FIELDS}, platforms.abbreviation, platforms.name, genres.name, slug, summary, url, screenshots.image_id, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, websites.url, websites.category, collection.name, collection.games.${REL_NEST}, similar_games.${REL_NEST}, parent_game.${REL_NEST}, version_parent.${REL_NEST}, dlcs.${REL_NEST}, expansions.${REL_NEST}, expanded_games.${REL_NEST}, remakes.${REL_NEST}, remasters.${REL_NEST}, standalone_expansions.${REL_NEST}, franchises.name, franchises.games.${REL_NEST}`;

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
  const base = toGame(game, "cover_big");
  if (!base) return null;
  const shots = (game.screenshots ?? [])
    .map((s) => img(s.image_id, "screenshot_med"))
    .filter((src): src is string => Boolean(src))
    .slice(0, 8);
  const site =
    game.websites?.find((w) => w.category === 1)?.url || game.url || null;
  const release = game.first_release_date ?? 0;
  return {
    ...base,
    summary: game.summary ?? "",
    releaseDate: unixDate(game.first_release_date),
    comingSoon: Boolean(release && release * 1000 > Date.now()),
    genres: names(game.genres),
    developers: companies(game.involved_companies, "developer"),
    publishers: companies(game.involved_companies, "publisher"),
    screenshots: shots,
    website: site,
    headerUrl: shots[0] || base.headerUrl,
    related: relatedRails(game),
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
