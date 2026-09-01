import type { CatalogGame, FeaturedRail } from "./types.ts";
import { slimCatalogGame } from "./catalog-seed.ts";
import {
  igdbCatalogId,
  isIgdbReady,
  parseIgdbId,
  toGame,
  type IgdbGame,
} from "./igdb.server.ts";
import {
  applyRelatedArt,
  dropCoverlessSimilar,
  relatedIdsMissingArt,
} from "./igdb.server.ts";

const FETCH_MS = 4000;
const IMG = "https://images.igdb.com/igdb/image/upload";

type Token = { access: string; clientId: string };

async function twitchToken(): Promise<Token | null> {
  const id = process.env.TWITCH_CLIENT_ID || process.env.IGDB_CLIENT_ID || "";
  const secret =
    process.env.TWITCH_CLIENT_SECRET || process.env.IGDB_CLIENT_SECRET || "";
  if (!id || !secret) return null;
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    grant_type: "client_credentials",
  });
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) return null;
  return { access: data.access_token, clientId: id };
}

async function igdbGames(body: string): Promise<IgdbGame[]> {
  const auth = await twitchToken();
  if (!auth) return [];
  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-ID": auth.clientId,
      Authorization: `Bearer ${auth.access}`,
    },
    body,
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) return [];
  return (await res.json()) as IgdbGame[];
}

export async function fillMissingCovers(
  rails: FeaturedRail[],
): Promise<FeaturedRail[]> {
  const ids = relatedIdsMissingArt(rails);
  if (!ids.length) return dropCoverlessSimilar(rails);
  try {
    const rows = await igdbGames(
      `fields name, cover.image_id, screenshots.image_id;
       where id = (${ids.join(",")});
       limit ${Math.min(50, ids.length)};`,
    );
    const cards: CatalogGame[] = [];
    for (const row of rows) {
      const mapped = toGame(row);
      if (mapped) cards.push(slimCatalogGame(mapped));
    }
    return dropCoverlessSimilar(applyRelatedArt(rails, cards));
  } catch {
    return dropCoverlessSimilar(rails);
  }
}

/** IGDB platform ids: PS5 = 167, PS4 = 48. */
export async function fetchPlaystationRail(): Promise<FeaturedRail | null> {
  if (!isIgdbReady()) return null;
  const rows = await igdbGames(
    `fields name, cover.image_id, first_release_date, aggregated_rating;
     where cover != null & version_parent = null & (category = 0 | game_type = 0 | game_type = null) & platforms = (167,48) & aggregated_rating_count > 20;
     sort aggregated_rating_count desc;
     limit 16;`,
  );
  const games: CatalogGame[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const mapped = toGame(row);
    if (!mapped?.coverUrl || seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    games.push(slimCatalogGame(mapped));
  }
  if (!games.length) return null;
  return { id: "playstation", title: "Popular on PlayStation", games };
}

export function igdbCoverUrl(imageId: string | undefined): string | null {
  return imageId ? `${IMG}/t_cover_big/${imageId}.jpg` : null;
}

export function catalogIdForIgdb(id: number): string {
  return igdbCatalogId(id);
}

export function parseMissingIgdbId(catalogId: string): number | null {
  return parseIgdbId(catalogId);
}
