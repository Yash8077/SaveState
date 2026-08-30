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

export function relationBadge(railId: string, railTitle: string): string {
  return RELATION_BADGE[railId] ?? railTitle;
}

export function flattenRelated(rails: FeaturedRail[]): RelatedCard[] {
  const out: RelatedCard[] = [];
  const seen = new Set<string>();
  for (const rail of rails) {
    const badge = relationBadge(rail.id, rail.title);
    for (const game of rail.games) {
      if (seen.has(game.id)) continue;
      seen.add(game.id);
      out.push({ ...game, relationId: rail.id, relation: badge });
    }
  }
  return out;
}
