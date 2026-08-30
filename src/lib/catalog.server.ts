import type { CatalogDetails, CatalogGame, FeaturedRail } from "./types.ts";
import { mergeFeaturedRails, searchSeed, seedRelated, slimCatalogGame } from "./catalog-seed.ts";
import {
  fetchIgdbDetails,
  fetchIgdbFeatured,
  GAME_TYPE,
  isIgdbReady,
  searchIgdb,
} from "./igdb.server.ts";

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

let featuredCache: { at: number; rails: FeaturedRail[] } | null = null;
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

function fromSearchItem(item: SteamSearchItem): CatalogGame | null {
  if (!item.id || !item.name) return null;
  if (item.type && item.type !== "app") return null;
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
  return dedupeGames(games);
}
