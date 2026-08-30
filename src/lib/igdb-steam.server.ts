import type { CatalogGame } from "./types.ts";
import { slimCatalogGame } from "./catalog-seed.ts";
import { toGame, type IgdbGame } from "./igdb.server.ts";

const FETCH_MS = 4000;
const IGDB_STEAM_CATEGORY = 1;

type ExternalGame = {
  uid?: string;
  game?: number | IgdbGame;
};

function quote(value: string): string {
  return JSON.stringify(value);
}

function steamGameId(row: ExternalGame | undefined): number | null {
  if (!row) return null;
  if (typeof row.game === "number" && Number.isFinite(row.game)) return row.game;
  if (row.game && typeof row.game === "object" && typeof row.game.id === "number") {
    return row.game.id;
  }
  return null;
}

async function igdbLookup<T>(path: string, body: string): Promise<T> {
  const credsId = process.env.TWITCH_CLIENT_ID || process.env.IGDB_CLIENT_ID || "";
  const credsSecret =
    process.env.TWITCH_CLIENT_SECRET || process.env.IGDB_CLIENT_SECRET || "";
  if (!credsId || !credsSecret) throw new Error("IGDB is not configured");
  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credsId,
      client_secret: credsSecret,
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!tokenRes.ok) throw new Error(`IGDB auth failed (${tokenRes.status})`);
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("IGDB auth failed");
  const res = await fetch(`https://api.igdb.com/v4/${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-ID": credsId,
      Authorization: `Bearer ${token.access_token}`,
    },
    body,
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) throw new Error(`IGDB request failed (${res.status})`);
  return (await res.json()) as T;
}

export async function lookupIgdbIdBySteamId(
  steamId: number,
): Promise<number | null> {
  if (!Number.isFinite(steamId) || steamId <= 0) return null;
  try {
    const rows = await igdbLookup<ExternalGame[]>(
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
    const rows = await igdbLookup<ExternalGame[]>(
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
    const games = await igdbLookup<IgdbGame[]>(
      "games",
      `fields name, cover.image_id;
       where id = (${gameIds.join(",")});
       limit 20;`,
    );
    const out: CatalogGame[] = [];
    const seen = new Set<string>();
    for (const row of games ?? []) {
      const mapped = toGame(row, "cover_big");
      if (!mapped || seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      out.push(slimCatalogGame(mapped));
    }
    return out;
  } catch {
    return [];
  }
}
