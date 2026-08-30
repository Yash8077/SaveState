import type { CatalogGame, FeaturedRail } from "./types";

type HeroSource = {
  catalogId: string;
  title: string;
  coverUrl: string | null;
  headerUrl: string | null;
};

export function heroSlides(
  playing: HeroSource[],
  rails: FeaturedRail[],
  limit = 8,
): CatalogGame[] {
  const out: CatalogGame[] = [];
  const seen = new Set<string>();

  const push = (game: CatalogGame) => {
    if (seen.has(game.id) || out.length >= limit) return;
    if (!game.headerUrl && !game.coverUrl) return;
    seen.add(game.id);
    out.push(game);
  };

  for (const entry of playing) {
    push({
      id: entry.catalogId,
      steamId: null,
      title: entry.title,
      coverUrl: entry.coverUrl,
      headerUrl: entry.headerUrl,
      capsuleUrl: entry.headerUrl,
      platforms: [],
      metacritic: null,
    });
  }

  for (const rail of rails) {
    for (const game of rail.games) push(game);
    if (out.length >= limit) break;
  }

  return out;
}
