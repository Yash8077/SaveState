import type { FeaturedRail } from "./types.ts";
import { slimCatalogGame } from "./catalog-seed.ts";
import {
  BECAUSE_RESULT_LIMIT,
  BECAUSE_SEED_LIMIT,
  becauseWeight,
  rankSimilarIds,
  type BecauseSeed,
} from "./because.ts";
import {
  igdbCatalogId,
  igdbQuery,
  isIgdbReady,
  parseIgdbId,
  SEARCH_WHERE,
  toGame,
  type IgdbGame,
} from "./igdb.server.ts";
import { mapSteamIdsToIgdb } from "./igdb-steam.server.ts";

const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; rail: FeaturedRail }>();
const inflight = new Map<string, Promise<FeaturedRail>>();

function parseSteamId(catalogId: string): number | null {
  const match = /^steam_(\d+)$/.exec(catalogId);
  return match ? Number(match[1]) : null;
}

export function emptyBecauseRail(): FeaturedRail {
  return { id: "recommended", title: "Recommended", games: [] };
}

export async function fetchBecauseRail(
  seeds: BecauseSeed[],
): Promise<FeaturedRail> {
  const list = seeds.slice(0, BECAUSE_SEED_LIMIT);
  if (list.length < 2 || !isIgdbReady()) return emptyBecauseRail();
  const key = list.map((row) => row.catalogId).join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rail;
  const pending = inflight.get(key);
  if (pending) return pending;
  const job = buildBecauseRail(list)
    .then((rail) => {
      cache.set(key, { at: Date.now(), rail });
      if (cache.size > 80) cache.delete(cache.keys().next().value!);
      return rail;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

async function buildBecauseRail(seeds: BecauseSeed[]): Promise<FeaturedRail> {
  const steamIds = seeds
    .map((row) => parseSteamId(row.catalogId))
    .filter((id): id is number => id != null);
  const steamMap = steamIds.length ? await mapSteamIdsToIgdb(steamIds) : new Map();
  const seedIgdb: { seed: BecauseSeed; igdbId: number }[] = [];
  const exclude = new Set<number>();
  for (const seed of seeds) {
    const igdbId = parseIgdbId(seed.catalogId) ?? steamMap.get(parseSteamId(seed.catalogId) ?? -1);
    if (!igdbId) continue;
    seedIgdb.push({ seed, igdbId });
    exclude.add(igdbId);
  }
  if (seedIgdb.length < 2) return emptyBecauseRail();

  const rows = await igdbQuery<IgdbGame[]>(
    "games",
    `fields name, similar_games;
     where id = (${seedIgdb.map((row) => row.igdbId).join(",")});
     limit ${seedIgdb.length};`,
  );
  const byId = new Map((rows ?? []).map((row) => [row.id, row]));
  const votes = new Map<number, number>();
  let seedTitle: string | null = null;
  let bestWeight = -1;
  for (const { seed, igdbId } of seedIgdb) {
    const weight = becauseWeight(seed);
    if (weight > bestWeight) {
      bestWeight = weight;
      seedTitle = byId.get(igdbId)?.name || seed.title;
    }
    const similar = byId.get(igdbId)?.similar_games ?? [];
    for (const item of similar) {
      const id = typeof item === "number" ? item : item.id;
      if (typeof id !== "number" || exclude.has(id)) continue;
      votes.set(id, (votes.get(id) ?? 0) + weight);
    }
  }
  const ranked = rankSimilarIds(votes, exclude, BECAUSE_RESULT_LIMIT);
  if (!ranked.length) return emptyBecauseRail();

  const cards = await igdbQuery<IgdbGame[]>(
    "games",
    `fields name, cover.image_id, first_release_date, total_rating, aggregated_rating, rating, game_type, category, parent_game;
     where id = (${ranked.join(",")}) & cover != null & ${SEARCH_WHERE};
     limit ${ranked.length};`,
  );
  const mapped = (cards ?? [])
    .map((row) => {
      const game = toGame(row);
      return game ? slimCatalogGame(game) : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const order = new Map(ranked.map((id, i) => [igdbCatalogId(id), i]));
  mapped.sort(
    (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
  );
  const title = seedTitle
    ? `Because you played ${seedTitle}`
    : "Recommended";
  return { id: "recommended", title, games: mapped.slice(0, 12) };
}
