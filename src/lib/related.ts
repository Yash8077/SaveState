import type { CatalogGame, FeaturedRail } from "./types";

export type RelatedCard = CatalogGame & {
  relationId: string;
  relation: string;
};

export const RELATION_BADGE: Record<string, string> = {
  prequel: "Prequel",
  sequel: "Sequel",
  series: "Series",
  original: "Original",
  franchise: "Franchise",
  dlc: "DLC",
  remakes: "Remake",
  similar: "Similar",
};

export const SEQUEL_DLC_RAIL_IDS = ["dlc", "prequel", "sequel"] as const;
export const RELATED_RAIL_IDS = [
  "series",
  "original",
  "franchise",
  "remakes",
  "similar",
] as const;

export function relationBadge(railId: string, railTitle: string): string {
  return RELATION_BADGE[railId] ?? railTitle;
}

export function flattenRelated(
  rails: FeaturedRail[],
  ids?: readonly string[],
): RelatedCard[] {
  const allow = ids ? new Set(ids) : null;
  const out: RelatedCard[] = [];
  const seen = new Set<string>();
  for (const rail of rails) {
    if (allow && !allow.has(rail.id)) continue;
    const badge = relationBadge(rail.id, rail.title);
    for (const game of rail.games) {
      if (seen.has(game.id)) continue;
      seen.add(game.id);
      out.push({ ...game, relationId: rail.id, relation: badge });
    }
  }
  return out;
}

export function needsPrequelSequelFallback(rails: FeaturedRail[]): boolean {
  const hasPrequel = rails.some((r) => r.id === "prequel" && r.games.length > 0);
  const hasSequel = rails.some((r) => r.id === "sequel" && r.games.length > 0);
  return !hasPrequel && !hasSequel;
}

export function prependPrequelSequel(
  rails: FeaturedRail[],
  prequel: CatalogGame | null,
  sequel: CatalogGame | null,
): FeaturedRail[] {
  const extra: FeaturedRail[] = [];
  if (prequel) extra.push({ id: "prequel", title: "Prequel", games: [prequel] });
  if (sequel) extra.push({ id: "sequel", title: "Sequel", games: [sequel] });
  if (!extra.length) return rails;
  const claimed = new Set(
    extra.flatMap((rail) => rail.games.map((game) => game.id)),
  );
  const rest: FeaturedRail[] = [];
  for (const rail of rails) {
    if (rail.id === "prequel" || rail.id === "sequel") continue;
    const games = rail.games.filter((game) => !claimed.has(game.id));
    if (games.length) rest.push({ ...rail, games });
  }
  return [...extra, ...rest];
}
