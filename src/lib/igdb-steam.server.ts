import type { CatalogGame } from "./types.ts";
import { slimCatalogGame } from "./catalog-seed.ts";
import { igdbQuery, toGame, type IgdbGame } from "./igdb.server.ts";

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
  return igdbQuery<T>(path, body);
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

export async function mapSteamIdsToIgdb(
  steamIds: number[],
): Promise<Map<number, number>> {
  const ids = [
    ...new Set(
      steamIds.filter((id) => Number.isFinite(id) && id > 0).map(Math.trunc),
    ),
  ].slice(0, 8);
  const out = new Map<number, number>();
  if (!ids.length) return out;
  try {
    const uids = ids.map((id) => quote(String(id))).join(",");
    const rows = await igdbLookup<ExternalGame[]>(
      "external_games",
      `fields game, uid;
       where uid = (${uids}) & category = ${IGDB_STEAM_CATEGORY};
       limit 20;`,
    );
    for (const row of rows ?? []) {
      const steam = Number(row.uid);
      const igdbId = steamGameId(row);
      if (Number.isFinite(steam) && igdbId) out.set(steam, igdbId);
    }
  } catch {
    return out;
  }
  return out;
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
