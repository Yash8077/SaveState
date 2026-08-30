import type { CatalogDetails, CatalogGame, FeaturedRail } from "./types.ts";
import { FEATURED_SEED, playstationSeedRail, seedRelated, slimCatalogGame } from "./catalog-seed.ts";
import {
  fetchIgdbDetails,
  fetchIgdbPlaystation,
  fetchIgdbRatings,
  applyIgdbRatings,
  igdbCatalogId,
  isIgdbReady,
  lookupIgdbByTitles,
  PLAYSTATION_FALLBACK_TITLES,
  searchIgdb,
} from "./igdb.server.ts";
import {
  lookupIgdbBySteamIds,
  lookupIgdbIdBySteamId,
} from "./igdb-steam.server.ts";
import { GAME_TYPE } from "./game-type.ts";
import type { CatalogProvider } from "./catalog-provider.ts";
import { upgradeSteamCapsule } from "./utils.ts";
import { withSteamLibraryArt } from "./steam-assets.server.ts";
import { fetchWikiDetails, parseWikiTitle, searchWikipedia } from "./wikipedia.server.ts";

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
  dlc?: number[];
};

let featuredCache: { at: number; rails: FeaturedRail[] } | null = null;
const FEATURED_TTL_MS = 30 * 60 * 1000;
const SEARCH_TTL_MS = 10 * 60 * 1000;
const DETAILS_TTL_MS = 30 * 60 * 1000;
const DETAILS_CACHE_VER = "rel-14";
const FETCH_MS = 4000;
const searchCache = new Map<string, { at: number; games: CatalogGame[] }>();
const detailsCache = new Map<
  string,
  { at: number; data: CatalogDetails | null }
>();
const searchInflight = new Map<string, Promise<CatalogGame[]>>();
const detailsInflight = new Map<string, Promise<CatalogDetails | null>>();
let featuredInflight: Promise<FeaturedRail[]> | null = null;

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

function portraitUrl(steamId: number): string {
  return `${STEAM_IMG}/${steamId}/library_600x900.jpg`;
}

function heroUrl(steamId: number): string {
  return `${STEAM_IMG}/${steamId}/library_hero.jpg`;
}

function fromSearchItem(item: SteamSearchItem): CatalogGame | null {
  if (!item.id || !item.name) return null;
  const kind = (item.type ?? "app").toLowerCase();
  if (kind !== "app" && kind !== "game") return null;
  if (/\b(soundtrack|ost|playtest|demo|bundle)\b/i.test(item.name)) {
    return null;
  }
  const metascore = item.metascore ? Number(item.metascore) : NaN;
  const header = artUrl(item.id);
  return {
    id: steamCatalogId(item.id),
    steamId: item.id,
    title: item.name,
    coverUrl: portraitUrl(item.id),
    headerUrl: heroUrl(item.id),
    capsuleUrl: upgradeSteamCapsule(item.tiny_image) ?? header,
    platforms: platformsFromFlags(item.platforms),
    metacritic: Number.isFinite(metascore) ? metascore : null,
  };
}

function fromFeaturedItem(item: SteamFeaturedItem): CatalogGame | null {
  if (!item.id || !item.name) return null;
  const header = artUrl(
    item.id,
    item.header_image ?? item.large_capsule_image,
  );
  return {
    id: steamCatalogId(item.id),
    steamId: item.id,
    title: item.name,
    coverUrl: portraitUrl(item.id),
    headerUrl: heroUrl(item.id),
    capsuleUrl:
      upgradeSteamCapsule(item.small_capsule_image) ??
      item.large_capsule_image ??
      header,
    platforms: platformsFromFlags(item),
    metacritic: null,
  };
}

export type SteamSearchHit = {
  steamId: number;
  title: string;
  released: string;
  capsule: string | null;
  metacritic: number | null;
};

export function decodeSteamHtml(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;|'/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/&trade;/g, "™")
    .replace(/&reg;/g, "®")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16)),
    )
    .trim();
}

export function parseSteamSearchHtml(html: string): SteamSearchHit[] {
  const out: SteamSearchHit[] = [];
  const seen = new Set<number>();
  const rowRe =
    /<a[^>]*class="[^"]*search_result_row[^"]*"[^>]*>[\s\S]*?<\/a>/gi;
  for (const match of html.matchAll(rowRe)) {
    const row = match[0];
    if (/store\.steampowered\.com\/(?:bundle|sub)\//i.test(row)) continue;
    const idMatch = /data-ds-appid="(\d+)"/.exec(row);
    const titleMatch = /<span class="title">([^<]+)<\/span>/.exec(row);
    if (!idMatch || !titleMatch) continue;
    const steamId = Number(idMatch[1]);
    const title = decodeSteamHtml(titleMatch[1]);
    if (!steamId || !title) continue;
    if (seen.has(steamId)) continue;
    if (/\b(soundtrack|ost|playtest|demo|bundle)\b/i.test(title)) continue;
    seen.add(steamId);
    const releasedMatch = /search_released[^>]*>\s*([^<]*)/.exec(row);
    const imgMatch =
      /search_capsule[\s\S]*?<img[^>]+src="([^"]+)"/i.exec(row) ??
      /<img[^>]+src="([^"]+)"/i.exec(row);
    const capsuleRaw = imgMatch ? decodeSteamHtml(imgMatch[1]) : "";
    const capsule = capsuleRaw.replace(/&/g, "&") || null;
    const scoreMatch = /search_metascore[^>]*>\s*(\d{2,3})/.exec(row);
    const metascore = scoreMatch ? Number(scoreMatch[1]) : NaN;
    out.push({
      steamId,
      title,
      released: decodeSteamHtml(releasedMatch?.[1] ?? ""),
      capsule,
      metacritic: Number.isFinite(metascore) ? metascore : null,
    });
  }
  return out;
}

export function steamReleaseKind(
  released: string,
  now = new Date(),
): "upcoming" | "recent" | "old" | "unknown" {
  const text = released.trim();
  if (!text) return "unknown";
  const lower = text.toLowerCase();
  if (
    lower.includes("announce") ||
    lower.includes("coming soon") ||
    lower === "tba" ||
    lower.includes("to be")
  ) {
    return "upcoming";
  }
  if (/^20\d{2}$/.test(text)) {
    const year = Number(text);
    if (year > now.getFullYear()) return "upcoming";
    if (year < now.getFullYear()) return "old";
    return "unknown";
  }
  const at = Date.parse(text);
  if (Number.isNaN(at)) return "unknown";
  if (at > now.getTime()) return "upcoming";
  const ageDays = (now.getTime() - at) / 86_400_000;
  if (ageDays <= 150) return "recent";
  return "old";
}

function filterSteamHits(
  hits: SteamSearchHit[],
  keep: "all" | "recent" | "upcoming",
): SteamSearchHit[] {
  if (keep === "all") return hits;
  if (keep === "upcoming") {
    return hits.filter((hit) => {
      const kind = steamReleaseKind(hit.released);
      return kind === "upcoming" || kind === "unknown";
    });
  }
  const recent = hits.filter(
    (hit) => steamReleaseKind(hit.released) === "recent",
  );
  return recent.length >= 4 ? recent : hits;
}

export function hashedSteamAsset(url: string | null | undefined): boolean {
  return Boolean(url && /\/apps\/\d+\/[a-f0-9]{24,}\//i.test(url));
}

export function steamCardFromSearchHit(hit: SteamSearchHit): CatalogGame {
  const capsule = upgradeSteamCapsule(hit.capsule);
  return {
    id: steamCatalogId(hit.steamId),
    steamId: hit.steamId,
    title: hit.title,
    coverUrl: portraitUrl(hit.steamId),
    headerUrl: heroUrl(hit.steamId),
    capsuleUrl: capsule,
    platforms: [],
    metacritic: hit.metacritic ?? null,
  };
}

function hitsToGames(hits: SteamSearchHit[]): CatalogGame[] {
  return collapseEditions(dedupeGames(hits.map(steamCardFromSearchHit))).slice(
    0,
    12,
  );
}

async function fetchSteamSearchHits(params: string): Promise<SteamSearchHit[]> {
  const url = `https://store.steampowered.com/search/results/?query&start=0&count=24&infinite=1&cc=US&l=english&category1=998&${params}`;
  const data = (await steamGet(url)) as { results_html?: string };
  return parseSteamSearchHtml(
    typeof data.results_html === "string" ? data.results_html : "",
  );
}

async function fetchSteamSearchRail(
  id: string,
  title: string,
  params: string,
  keep: "all" | "recent" | "upcoming",
): Promise<FeaturedRail | null> {
  const games = hitsToGames(
    filterSteamHits(await fetchSteamSearchHits(params), keep),
  );
  if (!games.length) return null;
  return { id, title, games };
}

async function applyArtToRails(rails: FeaturedRail[]): Promise<FeaturedRail[]> {
  const painted = await withSteamLibraryArt(rails.flatMap((rail) => rail.games));
  const byId = new Map(painted.map((game) => [game.id, game]));
  return rails.map((rail) => ({
    ...rail,
    games: rail.games.map((game) => byId.get(game.id) ?? game),
  }));
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

export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rankTitle(title: string, needle: string): number {
  if (!needle) return 2;
  if (title === needle) return 0;
  if (title.startsWith(needle)) return 1;
  if (title.split(" ").some((word) => word.startsWith(needle))) return 2;
  if (title.includes(needle)) return 3;
  return 4;
}

export function pickBestTitleMatch(
  title: string,
  games: CatalogGame[],
): CatalogGame | null {
  const key = titleKey(title);
  if (!key) return null;
  const exact = games.find((game) => titleKey(game.title) === key);
  if (exact) return exact;
  return (
    games.find((game) => {
      const other = titleKey(game.title);
      return other.startsWith(key) || key.startsWith(other);
    }) ?? null
  );
}

export function mergeSearchResults(
  igdbGames: CatalogGame[],
  steamGames: CatalogGame[],
  query = "",
  wikiGames: CatalogGame[] = [],
): CatalogGame[] {
  const needle = titleKey(query);
  const byTitle = new Map<string, CatalogGame>();
  const out: CatalogGame[] = [];

  const take = (game: CatalogGame) => {
    const key = titleKey(game.title);
    const existing = byTitle.get(key);
    if (existing) {
      if (!existing.steamId && game.steamId) existing.steamId = game.steamId;
      return;
    }
    const copy = { ...game };
    byTitle.set(key, copy);
    out.push(copy);
  };

  for (const game of igdbGames) take(game);
  for (const game of steamGames) take(game);
  for (const game of wikiGames) take(game);

  out.sort((a, b) => {
    const rank = rankTitle(titleKey(a.title), needle) - rankTitle(titleKey(b.title), needle);
    if (rank !== 0) return rank;
    const sourceRank = (id: string) =>
      id.startsWith("igdb_") ? 0 : id.startsWith("wiki_") ? 1 : 2;
    return sourceRank(a.id) - sourceRank(b.id);
  });

  return finishSearch(out).slice(0, 24);
}

export function replaceWikiWithIgdb(
  games: CatalogGame[],
  igdbGames: CatalogGame[],
): CatalogGame[] {
  if (!igdbGames.length) return games;
  return games.map((game) => {
    if (!game.id.startsWith("wiki_")) return game;
    return pickBestTitleMatch(game.title, igdbGames) ?? game;
  });
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
  return withSteamLibraryArt(finishSearch(games));
}

export type SearchSources = {
  igdbReady: () => boolean;
  searchIgdb: (q: string) => Promise<CatalogGame[]>;
  searchSteam: (q: string) => Promise<CatalogGame[]>;
  searchWiki?: (q: string) => Promise<CatalogGame[]>;
  lookupIgdbByTitles?: (titles: string[]) => Promise<CatalogGame[]>;
  fetchRatings?: (games: CatalogGame[]) => Promise<Map<string, number>>;
};

export async function runSearchWith(
  query: string,
  sources: SearchSources,
  _provider?: CatalogProvider,
): Promise<CatalogGame[]> {
  const igdbHits = sources.igdbReady()
    ? sources.searchIgdb(query).catch(() => [] as CatalogGame[])
    : Promise.resolve([] as CatalogGame[]);
  const steamHits = sources.searchSteam(query).catch(() => [] as CatalogGame[]);
  const wikiHits = sources.searchWiki
    ? sources.searchWiki(query).catch(() => [] as CatalogGame[])
    : Promise.resolve([] as CatalogGame[]);
  const [igdbGames, steamGames, wikiGames] = await Promise.all([
    igdbHits,
    steamHits,
    wikiHits,
  ]);
  let resolvedWiki = wikiGames;
  if (wikiGames.length && sources.lookupIgdbByTitles) {
    try {
      const titles = wikiGames.map((game) => game.title);
      const found = await sources.lookupIgdbByTitles(titles);
      resolvedWiki = replaceWikiWithIgdb(wikiGames, found);
    } catch {
      resolvedWiki = wikiGames;
    }
  }
  const merged = mergeSearchResults(igdbGames, steamGames, query, resolvedWiki);
  if (!sources.fetchRatings) return merged;
  try {
    return applyIgdbRatings(merged, await sources.fetchRatings(merged));
  } catch {
    return merged;
  }
}

export async function runSearch(
  query: string,
  provider?: CatalogProvider,
): Promise<CatalogGame[]> {
  return runSearchWith(
    query,
    {
      igdbReady: isIgdbReady,
      searchIgdb,
      searchSteam,
      searchWiki: searchWikipedia,
      lookupIgdbByTitles,
      fetchRatings: fetchIgdbRatings,
    },
    provider,
  );
}

export async function searchCatalog(
  query: string,
  _provider?: CatalogProvider,
): Promise<CatalogGame[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = q.toLowerCase();
  const now = Date.now();
  const hit = searchCache.get(key);
  if (hit && now - hit.at < SEARCH_TTL_MS) return hit.games;

  const pending = searchInflight.get(key);
  if (hit) {
    if (!pending) {
      const run = runSearch(q)
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

  const run = runSearch(q)
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

async function relatedForSteamGame(opts: {
  steamId: number;
  title: string;
  dlcIds: number[];
}): Promise<FeaturedRail[]> {
  const catalogId = steamCatalogId(opts.steamId);
  if (!isIgdbReady()) return seedRelated(catalogId);

  let rails: FeaturedRail[] = [];
  try {
    const igdbId = await lookupIgdbIdBySteamId(opts.steamId);
    let details: CatalogDetails | null = null;
    if (igdbId) {
      details = await fetchIgdbDetails(igdbCatalogId(igdbId));
    }
    if (!details?.related?.length && opts.title.trim().length >= 2) {
      const hits = await searchIgdb(opts.title);
      const match = pickBestTitleMatch(opts.title, hits);
      if (match) details = await fetchIgdbDetails(match.id);
    }
    if (details?.related?.length) rails = details.related;
  } catch {
    rails = [];
  }

  const hasDlc = rails.some((rail) => rail.id === "dlc" && rail.games.length > 0);
  if (!hasDlc && opts.dlcIds.length) {
    try {
      const dlcGames = await lookupIgdbBySteamIds(opts.dlcIds);
      if (dlcGames.length) {
        rails = [
          ...rails,
          { id: "dlc", title: "DLC & expansions", games: dlcGames },
        ];
      }
    } catch {
      /* Steam DLC enrichment is best-effort */
    }
  }

  if (!rails.length) return seedRelated(catalogId);
  return rails;
}

export async function fetchSteamDetails(
  catalogId: string,
): Promise<CatalogDetails | null> {
  const steamId = parseSteamId(catalogId);
  if (!steamId) return null;
  const url = `https://store.steampowered.com/api/appdetails?appids=${steamId}&l=english&filters=basic,developers,publishers,genres,screenshots,metacritic,dlc`;
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
  const dlcIds = (app.dlc ?? []).filter((id) => Number.isFinite(id) && id > 0);
  const related = await relatedForSteamGame({
    steamId,
    title: app.name ?? "",
    dlcIds,
  });
  const painted = (
    await withSteamLibraryArt([
      {
        id: steamCatalogId(steamId),
        steamId,
        title: app.name ?? `App ${steamId}`,
        coverUrl: portraitUrl(steamId),
        headerUrl: art,
        capsuleUrl: app.header_image ?? null,
        platforms: platformsFromFlags(app.platforms),
        metacritic: app.metacritic?.score ?? null,
      },
    ])
  )[0]!;
  return {
    ...painted,
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
    related,
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
  if (catalogId.startsWith("wiki_")) {
    const title = parseWikiTitle(catalogId);
    if (title && isIgdbReady()) {
      try {
        const hits = await lookupIgdbByTitles([title]);
        const match = pickBestTitleMatch(title, hits);
        if (match) {
          const details = await fetchIgdbDetails(match.id);
          if (details) return details;
        }
      } catch {
        /* fall through to the Wikipedia page */
      }
    }
    try {
      return await fetchWikiDetails(catalogId);
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

async function fetchSteamFeaturedCategories(): Promise<FeaturedRail[]> {
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

export async function fetchSteamFeatured(): Promise<FeaturedRail[]> {
  const specs: {
    id: string;
    title: string;
    params: string;
    keep: "all" | "recent" | "upcoming";
  }[] = [
    {
      id: "top_sellers",
      title: "Trending",
      params: "filter=globaltopsellers",
      keep: "all",
    },
    {
      id: "new_releases",
      title: "New releases",
      params: "filter=popularnew",
      keep: "recent",
    },
    {
      id: "coming_soon",
      title: "Coming soon",
      params: "filter=popularwishlist",
      keep: "upcoming",
    },
    {
      id: "specials",
      title: "On sale",
      params: "specials=1&filter=globaltopsellers",
      keep: "all",
    },
  ];
  const rows = await Promise.all(
    specs.map(async (spec) => {
      try {
        return await fetchSteamSearchRail(
          spec.id,
          spec.title,
          spec.params,
          spec.keep,
        );
      } catch {
        return null;
      }
    }),
  );
  const rails = rows.filter((rail): rail is FeaturedRail => Boolean(rail));
  if (rails.length) return applyArtToRails(rails);
  return applyArtToRails(await fetchSteamFeaturedCategories());
}

export async function fetchPlaystationRail(): Promise<FeaturedRail | null> {
  if (isIgdbReady()) {
    try {
      const igdb = await fetchIgdbPlaystation();
      if (igdb?.games.length) return igdb;
    } catch {
      /* try title lookup / Wikipedia next — never Steam PC ports */
    }
    try {
      const named = await lookupIgdbByTitles(PLAYSTATION_FALLBACK_TITLES);
      const games = named.filter((game) => Boolean(game.coverUrl)).slice(0, 12);
      if (games.length) {
        return { id: "playstation", title: "PlayStation", games };
      }
    } catch {
      /* Wikipedia discovery below */
    }
  }
  try {
    const found = await Promise.all(
      PLAYSTATION_FALLBACK_TITLES.slice(0, 8).map((title) =>
        searchWikipedia(title).then((games) => games[0] ?? null),
      ),
    );
    const games = found.filter((game): game is CatalogGame => Boolean(game));
    if (games.length) {
      return { id: "playstation", title: "PlayStation", games: games.slice(0, 12) };
    }
  } catch {
    /* seed last */
  }
  return playstationSeedRail();
}

export function rankRailGames(
  games: CatalogGame[],
  scores: Map<string, number>,
  opts?: { dropUnknown?: boolean; limit?: number },
): CatalogGame[] {
  const limit = opts?.limit ?? 12;
  const rows = games.map((game, index) => ({
    game,
    index,
    score: scores.get(game.id) ?? (game.metacritic && game.metacritic > 0 ? game.metacritic : 0),
  }));
  const anyScore = rows.some((row) => row.score > 0);
  if (!anyScore) return games.slice(0, limit);
  rows.sort((a, b) => b.score - a.score || a.index - b.index);
  const known = rows.filter((row) => row.score > 0);
  const picked = opts?.dropUnknown && known.length >= 6 ? known : rows;
  return picked.slice(0, limit).map((row) => row.game);
}

export function mergeComingSoon(
  steam: CatalogGame[],
  anticipated: CatalogGame[],
): CatalogGame[] {
  const byTitle = new Map<string, CatalogGame>();
  const take = (game: CatalogGame) => {
    const key = titleKey(game.title);
    if (!key) return;
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, game);
      return;
    }
    if (!existing.coverUrl && game.coverUrl) {
      byTitle.set(key, {
        ...existing,
        coverUrl: game.coverUrl,
        headerUrl: existing.headerUrl ?? game.headerUrl,
      });
    }
  };
  for (const game of anticipated) take(game);
  for (const game of steam) take(game);
  return [...byTitle.values()];
}

export type FeaturedSources = {
  igdbReady: () => boolean;
  fetchSteamFeatured: () => Promise<FeaturedRail[]>;
  fetchPlaystationRail: () => Promise<FeaturedRail | null>;
  fetchAnticipated?: () => Promise<CatalogGame[]>;
  popularity?: (games: CatalogGame[]) => Promise<Map<string, number>>;
  fetchRatings?: (games: CatalogGame[]) => Promise<Map<string, number>>;
};

export async function refreshFeaturedWith(
  sources: FeaturedSources,
  _provider?: CatalogProvider,
): Promise<FeaturedRail[]> {
  let rails: FeaturedRail[] = [];
  try {
    rails = await sources.fetchSteamFeatured();
  } catch {
    rails = [];
  }
  try {
    const playstation = await sources.fetchPlaystationRail();
    if (playstation?.games.length) {
      rails = [
        ...rails.filter((rail) => rail.id !== "playstation"),
        playstation,
      ];
    }
  } catch {
    /* PlayStation rail is extra */
  }
  if (!rails.length) rails = FEATURED_SEED;
  if (!rails.some((rail) => rail.id === "popular")) {
    rails = [{ ...FEATURED_SEED[0]! }, ...rails];
  }
  rails = rails.map((rail) => ({
    ...rail,
    games: collapseEditions(dedupeGames(rail.games)).slice(0, 12),
  }));
  rails = rails.filter((rail) => rail.games.length > 0);
  if (sources.fetchRatings) {
    try {
      const ratings = await sources.fetchRatings(rails.flatMap((rail) => rail.games));
      rails = rails.map((rail) => ({
        ...rail,
        games: applyIgdbRatings(rail.games, ratings),
      }));
    } catch {
      /* ratings are extra */
    }
  }
  featuredCache = { at: Date.now(), rails };
  return rails;
}

export async function refreshFeatured(
  _provider?: CatalogProvider,
): Promise<FeaturedRail[]> {
  return refreshFeaturedWith({
    igdbReady: isIgdbReady,
    fetchSteamFeatured,
    fetchPlaystationRail,
    fetchRatings: fetchIgdbRatings,
  });
}

export async function fetchFeaturedRails(
  _provider?: CatalogProvider,
): Promise<FeaturedRail[]> {
  const now = Date.now();
  const hit = featuredCache;
  if (hit && now - hit.at < FEATURED_TTL_MS) return hit.rails;

  const pending = featuredInflight;
  if (hit) {
    if (!pending) {
      const run = refreshFeatured().finally(() => {
        featuredInflight = null;
      });
      featuredInflight = run;
    }
    return hit.rails;
  }
  if (pending) return pending;

  const run = refreshFeatured().finally(() => {
    featuredInflight = null;
  });
  featuredInflight = run;
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
  void fetchFeaturedRails().catch(() => {});
}
