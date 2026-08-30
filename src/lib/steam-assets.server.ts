import type { CatalogGame } from "./types.ts";

const FETCH_MS = 5000;
const CDN = "https://shared.akamai.steamstatic.com/store_item_assets";
const UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36";

export type SteamStoreAssets = {
  asset_url_format?: string;
  library_capsule?: string;
  library_capsule_2x?: string;
  library_hero?: string;
  library_hero_2x?: string;
  header?: string;
  header_2x?: string;
  main_capsule?: string;
  main_capsule_2x?: string;
  small_capsule?: string;
  small_capsule_2x?: string;
  hero_capsule?: string;
  hero_capsule_2x?: string;
};

export type SteamArt = {
  coverUrl: string | null;
  headerUrl: string | null;
  capsuleUrl: string | null;
};

const cache = new Map<number, { at: number; art: SteamArt }>();
const ART_TTL_MS = 6 * 60 * 60 * 1000;

export function steamAssetUrl(
  format: string | undefined,
  file: string | undefined,
): string | null {
  if (!format || !file) return null;
  const path = format.replace("${FILENAME}", file);
  if (/^https?:\/\//i.test(path)) return path;
  return `${CDN}/${path.replace(/^\/+/, "")}`;
}

export function artFromSteamAssets(assets: SteamStoreAssets): SteamArt {
  const format = assets.asset_url_format;
  return {
    coverUrl: steamAssetUrl(
      format,
      assets.library_capsule_2x || assets.library_capsule,
    ),
    headerUrl: steamAssetUrl(
      format,
      assets.library_hero_2x || assets.library_hero || assets.header_2x || assets.header,
    ),
    capsuleUrl: steamAssetUrl(
      format,
      assets.main_capsule_2x || assets.main_capsule || assets.small_capsule_2x,
    ),
  };
}

export function paintSteamArt(
  game: CatalogGame,
  byId: Map<number, SteamArt>,
): CatalogGame {
  const steamId = game.steamId;
  if (!steamId) return game;
  const art = byId.get(steamId);
  if (!art?.coverUrl && !art?.headerUrl) return game;
  return {
    ...game,
    coverUrl: art.coverUrl ?? game.coverUrl,
    headerUrl: art.headerUrl ?? game.headerUrl,
    capsuleUrl: art.capsuleUrl ?? game.capsuleUrl,
  };
}

export async function fetchSteamStoreAssets(
  steamIds: number[],
): Promise<Map<number, SteamArt>> {
  const ids = [
    ...new Set(
      steamIds.filter((id) => Number.isFinite(id) && id > 0).map(Math.trunc),
    ),
  ];
  const out = new Map<number, SteamArt>();
  const now = Date.now();
  const missing: number[] = [];
  for (const id of ids) {
    const hit = cache.get(id);
    if (hit && now - hit.at < ART_TTL_MS) out.set(id, hit.art);
    else missing.push(id);
  }
  if (!missing.length) return out;

  const payload = {
    ids: missing.slice(0, 50).map((appid) => ({ appid })),
    context: { language: "english", country_code: "US" },
    data_request: { include_assets: true },
  };
  const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(payload))}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_MS),
    });
    if (!res.ok) return out;
    const data = (await res.json()) as {
      response?: {
        store_items?: Array<{
          appid?: number;
          id?: number;
          assets?: SteamStoreAssets;
        }>;
      };
    };
    for (const item of data.response?.store_items ?? []) {
      const id = item.appid ?? item.id;
      if (!id || !item.assets) continue;
      const art = artFromSteamAssets(item.assets);
      cache.set(id, { at: Date.now(), art });
      out.set(id, art);
    }
  } catch {
    /* keep whatever we already had */
  }
  return out;
}

export async function withSteamLibraryArt(
  games: CatalogGame[],
): Promise<CatalogGame[]> {
  const ids = games
    .map((game) => game.steamId)
    .filter((id): id is number => typeof id === "number" && id > 0);
  if (!ids.length) return games;
  const art = await fetchSteamStoreAssets(ids);
  if (!art.size) return games;
  return games.map((game) => paintSteamArt(game, art));
}
