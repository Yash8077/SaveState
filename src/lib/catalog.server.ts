import type { CatalogDetails, CatalogGame, FeaturedRail } from "./types.ts";
import { seedRelated, slimCatalogGame } from "./catalog-seed.ts";
import {
  fetchIgdbDetails,
  fetchIgdbFeatured,
  isIgdbReady,
  searchIgdb,
} from "./igdb.server.ts";
import { GAME_TYPE } from "./game-type.ts";
import {
  parseCatalogProvider,
  type CatalogProvider,
} from "./catalog-provider.ts";

const UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36";

const STEAM_IMG =
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";

type SteamSearchItem = {
  type?: string;
  id?: number;
  name?: string;
  tiny_image?: string;
  metascore?: string;
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
};

type SteamFeaturedItem = {
  id?: number;
  name?: string;
  header_image?: string;
  large_capsule_image?: string;
  small_capsule_image?: string;
  windows_available?: boolean;
  mac_available?: boolean;
  linux_available?: boolean;
};

type SteamAppData = {
  name?: string;
  short_description?: string;
  header_image?: string;
  website?: string;
  developers?: string[];
  publishers?: string[];
  genres?: { description?: string }[];
  screenshots?: { path_full?: string; path_thumbnail?: string }[];
  metacritic?: { score?: number };
  release_date?: { coming_soon?: boolean; date?: string };
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
};

let featuredCache = new Map<
  CatalogProvider,
  { at: number; rails: FeaturedRail[] }
>();
const FEATURED_TTL_MS = 30 * 60 * 1000;
const SEARCH_TTL_MS = 10 * 60 * 1000;
const DETAILS_TTL_MS = 2 * 60 * 1000;
const DETAILS_CACHE_VER = "rel-5";
const FETCH_MS = 4000;
const searchCache = new Map<string, { at: number; games: CatalogGame[] }>();
const detailsCache = new Map<
  string,
  { at: number; data: CatalogDetails | null }
>();
const searchInflight = new Map<string, Promise<CatalogGame[]>>();
const detailsInflight = new Map<string, Promise<CatalogDetails | null>>();
const featuredInflight = new Map<CatalogProvider, Promise<FeaturedRail[]>>();

async function steamGet(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) {
    throw new Error(`Catalog request failed (${res.status})`);
  }
  return res.json();
}

function platformsFromFlags(flags?: {
  windows?: boolean;
  mac?: boolean;
  linux?: boolean;
  windows_available?: boolean;
  mac_available?: boolean;
  linux_available?: boolean;
}): string[] {
  const out: string[] = [];
  if (flags?.windows || flags?.windows_available) out.push("Windows");
  if (flags?.mac || flags?.mac_available) out.push("macOS");
  if (flags?.linux || flags?.linux_available) out.push("Linux");
  return out;
}

export function steamCatalogId(steamId: number): string {
  return `steam_${steamId}`;
}

export function parseSteamId(catalogId: string): number | null {
  const match = /^steam_(\d+)$/.exec(catalogId);
  return match ? Number(match[1]) : null;
}

function artUrl(steamId: number, fallback?: string | null): string {
  return fallback || `${STEAM_IMG}/${steamId}/header.jpg`;
}

function fromSearchItem(item: SteamSearchItem): CatalogGame | null {
  if (!item.id || !item.name) return null;
  const kind = (item.type ?? "app").toLowerCase();
  if (kind !== "app" && kind !== "game") return null;
  if (/\b(soundtrack|ost|playtest|demo)\b/i.test(item.name)) {
    return null;
  }
  const metascore = item.metascore ? Number(item.metascore) : NaN;
  const art = artUrl(item.id, item.tiny_image);
  return {
    id: steamCatalogId(item.id),
    steamId: item.id,
    title: item.name,
    coverUrl: art,
    headerUrl: art,
    capsuleUrl: item.tiny_image ?? null,
    platforms: platformsFromFlags(item.platforms),
    metacritic: Number.isFinite(metascore) ? metascore : null,
  };
}

function fromFeaturedItem(item: SteamFeaturedItem): CatalogGame | null {
  if (!item.id || !item.name) return null;
  const art = artUrl(
    item.id,
    item.header_image ?? item.large_capsule_image ?? item.small_capsule_image,
  );
  return {
    id: steamCatalogId(item.id),
    steamId: item.id,
    title: item.name,
    coverUrl: art,
    headerUrl: art,
    capsuleUrl: item.small_capsule_image ?? item.large_capsule_image ?? null,
    platforms: platformsFromFlags(item),
    metacritic: null,
  };
}

function trimCache<T>(cache: Map<string, T>, max: number) {
  while (cache.size > max) {
    const first = cache.keys().next().value;
    if (!first) break;
    cache.delete(first);
  }
}

const PREFERRED_SEARCH_TYPES = new Set<number>([
  GAME_TYPE.main_game,
  GAME_TYPE.remake,
  GAME_TYPE.remaster,
]);

export function dedupeGames(games: CatalogGame[]): CatalogGame[] {
  const seen = new Set<string>();
  const out: CatalogGame[] = [];
  for (const game of games) {
    if (!game.id || seen.has(game.id)) continue;
    seen.add(game.id);
    out.push(slimCatalogGame(game));
  }

  const dropped = new Set<string>();
  const byName = new Map<string, CatalogGame[]>();
  for (const game of out) {
    const key = game.title.trim().toLowerCase();
    const list = byName.get(key);
    if (list) list.push(game);
    else byName.set(key, [game]);
  }
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    const ids = new Set(group.map((g) => g.id));
    const linked = group.some((g) => g.parentGameId && ids.has(g.parentGameId));
    if (!linked) continue;
    for (const game of group) {
      if (game.parentGameId && ids.has(game.parentGameId)) {
        dropped.add(game.id);
      }
    }
    const remaining = group.filter((g) => !dropped.has(g.id));
    if (remaining.length <= 1) continue;
    const preferred =
      remaining.find((g) => g.gameType != null && PREFERRED_SEARCH_TYPES.has(g.gameType)) ??
      remaining[0];
    for (const game of remaining) {
      if (game.id !== preferred?.id) dropped.add(game.id);
    }
  }
  if (!dropped.size) return out;
  return out.filter((game) => !dropped.has(game.id));
}

/** Drop "Base: DLC/edition" rows when the base title is already in the list. */
export function collapseEditions(games: CatalogGame[]): CatalogGame[] {
  const titles = games.map((game) => game.title.trim().toLowerCase());
  return games.filter((game, index) => {
    const title = titles[index] ?? "";
    if (!title) return true;
    return !titles.some((other, otherIndex) => {
      if (otherIndex === index || !other || title === other) return false;
      if (!title.startsWith(other)) return false;
      const rest = title.slice(other.length).trim();
      return /^[:\-–—]/.test(rest);
    });
  });
}

function finishSearch(games: CatalogGame[]): CatalogGame[] {
  return collapseEditions(dedupeGames(games));
}

export async function searchSteam(query: string): Promise<CatalogGame[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&cc=us&l=english`;
  const data = (await steamGet(url)) as { items?: SteamSearchItem[] };
  const games: CatalogGame[] = [];
  for (const item of data.items ?? []) {
    const game = fromSearchItem(item);
    if (!game) continue;
    games.push(game);
    if (games.length >= 18) break;
  }
  return finishSearch(games);
}

export type SearchSources = {
  igdbReady: () => boolean;
  searchIgdb: (q: string) => Promise<CatalogGame[]>;
  searchSteam: (q: string) => Promise<CatalogGame[]>;
};

export async function runSearchWith(
  query: string,
  sources: SearchSources,
  provider: CatalogProvider = "igdb",
): Promise<CatalogGame[]> {
  if (provider === "steam") {
    try {
      return finishSearch(await sources.searchSteam(query));
    } catch {
      return [];
    }
  }
  if (!sources.igdbReady()) return [];
  try {
    return finishSearch(await sources.searchIgdb(query));
  } catch {
    return [];
  }
}

export async function runSearch(
  query: string,
  provider: CatalogProvider = "igdb",
): Promise<CatalogGame[]> {
  return runSearchWith(
    query,
    {
      igdbReady: isIgdbReady,
      searchIgdb,
      searchSteam,
    },
    provider,
  );
}

export async function searchCatalog(
  query: string,
  provider: CatalogProvider = "igdb",
): Promise<CatalogGame[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const source = parseCatalogProvider(provider);
  const key = `${source}:${q.toLowerCase()}`;
  const now = Date.now();
  const hit = searchCache.get(key);
  if (hit && now - hit.at < SEARCH_TTL_MS) return hit.games;

  const pending = searchInflight.get(key);
  if (hit) {
    if (!pending) {
      const run = runSearch(q, source)
        .then((games) => {
          trimCache(searchCache, 200);
          searchCache.set(key, { at: Date.now(), games });
          return games;
        })
        .finally(() => {
          searchInflight.delete(key);
        });
      searchInflight.set(key, run);
    }
    return hit.games;
  }
  if (pending) return pending;

  const run = runSearch(q, source)
    .then((games) => {
      trimCache(searchCache, 200);
      searchCache.set(key, { at: Date.now(), games });
      return games;
    })
    .finally(() => {
      searchInflight.delete(key);
    });
  searchInflight.set(key, run);
  return run;
}

export async function fetchSteamDetails(
  catalogId: string,
): Promise<CatalogDetails | null> {
  const steamId = parseSteamId(catalogId);
  if (!steamId) return null;
  const url = `https://store.steampowered.com/api/appdetails?appids=${steamId}&l=english&filters=basic,developers,publishers,genres,screenshots,metacritic`;
  const data = (await steamGet(url)) as Record<
    string,
    { success?: boolean; data?: SteamAppData }
  >;
  const payload = data[String(steamId)];
  if (!payload?.success || !payload.data) return null;
  const app = payload.data;
  const screenshots = (app.screenshots ?? [])
    .map((shot) => shot.path_thumbnail ?? shot.path_full)
    .filter((src): src is string => Boolean(src))
    .slice(0, 6);
  const art = artUrl(steamId, app.header_image);
  return {
    id: steamCatalogId(steamId),
    steamId,
    title: app.name ?? `App ${steamId}`,
    coverUrl: art,
    headerUrl: art,
    capsuleUrl: app.header_image ?? null,
    platforms: platformsFromFlags(app.platforms),
    metacritic: app.metacritic?.score ?? null,
    summary: app.short_description ?? "",
    releaseDate: app.release_date?.date ?? null,
    comingSoon: Boolean(app.release_date?.coming_soon),
    genres: (app.genres ?? [])
      .map((g) => g.description)
      .filter((g): g is string => Boolean(g)),
    developers: app.developers ?? [],
    publishers: app.publishers ?? [],
    screenshots,
    website: app.website ?? null,
    related: seedRelated(steamCatalogId(steamId)),
  };
}

async function runDetails(catalogId: string): Promise<CatalogDetails | null> {
  if (catalogId.startsWith("igdb_")) {
    try {
      return await fetchIgdbDetails(catalogId);
    } catch {
      return null;
    }
  }
  return fetchSteamDetails(catalogId);
}

export async function fetchCatalogDetails(
  catalogId: string,
): Promise<CatalogDetails | null> {
  const key = `${DETAILS_CACHE_VER}:${catalogId}`;
  const hit = detailsCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < DETAILS_TTL_MS) return hit.data;

  const pending = detailsInflight.get(key);
  if (hit) {
    if (!pending) {
      const run = runDetails(catalogId)
        .then((data) => {
          trimCache(detailsCache, 200);
          detailsCache.set(key, { at: Date.now(), data });
          return data;
        })
        .finally(() => {
          detailsInflight.delete(key);
        });
      detailsInflight.set(key, run);
    }
    return hit.data;
  }
  if (pending) return pending;

  const run = runDetails(catalogId)
    .then((data) => {
      trimCache(detailsCache, 200);
      detailsCache.set(key, { at: Date.now(), data });
      return data;
    })
    .finally(() => {
      detailsInflight.delete(key);
    });
  detailsInflight.set(key, run);
  return run;
}

export async function fetchSteamFeatured(): Promise<FeaturedRail[]> {
  const url =
    "https://store.steampowered.com/api/featuredcategories/?cc=us&l=english";
  const data = (await steamGet(url)) as Record<
    string,
    { id?: string; name?: string; items?: SteamFeaturedItem[] }
  >;
  const wanted: { key: string; fallback: string }[] = [
    { key: "top_sellers", fallback: "Trending" },
    { key: "new_releases", fallback: "New releases" },
    { key: "coming_soon", fallback: "Coming soon" },
    { key: "specials", fallback: "On sale" },
  ];
  const rails: FeaturedRail[] = [];
  for (const { key, fallback } of wanted) {
    const block = data[key];
    const games: CatalogGame[] = [];
    for (const item of block?.items ?? []) {
      const game = fromFeaturedItem(item);
      if (!game) continue;
      games.push(game);
      if (games.length >= 12) break;
    }
    const unique = collapseEditions(dedupeGames(games));
    if (!unique.length) continue;
    rails.push({
      id: key,
      title: fallback,
      games: unique,
    });
  }
  return rails;
}

export type FeaturedSources = {
  igdbReady: () => boolean;
  fetchIgdbFeatured: () => Promise<FeaturedRail[]>;
  fetchSteamFeatured: () => Promise<FeaturedRail[]>;
};

export async function refreshFeaturedWith(
  sources: FeaturedSources,
  provider: CatalogProvider = "igdb",
): Promise<FeaturedRail[]> {
  const source = parseCatalogProvider(provider);
  let rails: FeaturedRail[] = [];
  if (source === "steam") {
    try {
      rails = await sources.fetchSteamFeatured();
    } catch {
      rails = [];
    }
  } else if (sources.igdbReady()) {
    try {
      rails = await sources.fetchIgdbFeatured();
    } catch {
      rails = [];
    }
  }
  rails = rails.map((rail) => ({
    ...rail,
    games: collapseEditions(dedupeGames(rail.games)),
  }));
  featuredCache.set(source, { at: Date.now(), rails });
  return rails;
}

export async function refreshFeatured(
  provider: CatalogProvider = "igdb",
): Promise<FeaturedRail[]> {
  return refreshFeaturedWith(
    {
      igdbReady: isIgdbReady,
      fetchIgdbFeatured,
      fetchSteamFeatured,
    },
    provider,
  );
}

export async function fetchFeaturedRails(
  provider: CatalogProvider = "igdb",
): Promise<FeaturedRail[]> {
  const source = parseCatalogProvider(provider);
  const now = Date.now();
  const hit = featuredCache.get(source);
  if (hit && now - hit.at < FEATURED_TTL_MS) return hit.rails;

  const pending = featuredInflight.get(source);
  if (hit) {
    if (!pending) {
      const run = refreshFeatured(source).finally(() => {
        featuredInflight.delete(source);
      });
      featuredInflight.set(source, run);
    }
    return hit.rails;
  }
  if (pending) return pending;

  const run = refreshFeatured(source).finally(() => {
    featuredInflight.delete(source);
  });
  featuredInflight.set(source, run);
  return run;
}

export function catalogJson(data: unknown, maxAgeSec: number): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${maxAgeSec}, stale-while-revalidate=${maxAgeSec * 6}`,
    },
  });
}

if (!process.env.NODE_TEST_CONTEXT) {
  void fetchFeaturedRails("igdb").catch(() => {});
}
