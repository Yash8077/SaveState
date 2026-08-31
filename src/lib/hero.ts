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

  const trending =
    rails.find((rail) => rail.id === "popular") ??
    rails.find((rail) => rail.id === "top_sellers");
  const rest = rails.filter(
    (rail) => rail.id !== "popular" && rail.id !== "top_sellers",
  );
  for (const rail of trending ? [trending, ...rest] : rest) {
    for (const game of rail.games) push(game);
    if (out.length >= limit) break;
  }

  return out;
}
