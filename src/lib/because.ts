export const BECAUSE_SEED_LIMIT = 8;
export const BECAUSE_RESULT_LIMIT = 16;

export type BecauseSeed = {
  catalogId: string;
  title: string;
  favorite: boolean;
  status: string;
  score: number | null;
  updatedAt: string;
};

export function pickBecauseSeeds(entries: BecauseSeed[]): BecauseSeed[] {
  const ranked = entries.filter((entry) => {
    if (!entry.catalogId || entry.catalogId.startsWith("custom_")) return false;
    if (entry.favorite) return true;
    if (entry.status === "beaten") return true;
    if (entry.status === "playing") return true;
    return false;
  });
  ranked.sort((a, b) => {
    const aw = becauseWeight(a);
    const bw = becauseWeight(b);
    if (bw !== aw) return bw - aw;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  return ranked.slice(0, BECAUSE_SEED_LIMIT);
}

export function becauseWeight(seed: BecauseSeed): number {
  let n = 0;
  if (seed.favorite) n += 2;
  if (seed.status === "beaten") n += 2;
  if (seed.status === "playing") n += 1;
  if ((seed.score ?? 0) >= 9) n += 1;
  return n || 1;
}

export function becauseRailTitle(seeds: BecauseSeed[]): string {
  if (!seeds.length) return "Recommended for you";
  const ranked = [...seeds].sort((a, b) => {
    const cmp = becauseWeight(b) - becauseWeight(a);
    if (cmp !== 0) return cmp;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  const top = ranked[0]!;
  const name = displaySeedTitle(top.title);
  if (ranked.length >= 3 || !name) return "Recommended for you";
  const second = ranked[1];
  if (second && becauseWeight(top) < becauseWeight(second) + 2) {
    return "Recommended for you";
  }
  return `Because you played ${name}`;
}

export function displaySeedTitle(raw: string | null | undefined): string | null {
  const title = raw?.trim() ?? "";
  if (!title) return null;
  if (/^(steam|igdb|wiki|custom)_/i.test(title)) return null;
  return title;
}

export function rankSimilarIds(
  votes: Map<number, number>,
  exclude: Set<number>,
  limit = BECAUSE_RESULT_LIMIT,
): number[] {
  return [...votes.entries()]
    .filter(([id]) => !exclude.has(id))
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, limit)
    .map(([id]) => id);
}

export function isUpcomingRelease(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const text = raw.trim();
  if (/tba|coming soon|to be announced/i.test(text)) return true;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return text.slice(0, 10) > new Date().toISOString().slice(0, 10);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return false;
  return parsed > Date.now();
}

export function sortWishlist<T extends { title: string; releaseDate?: string | null }>(
  entries: T[],
): T[] {
  return [...entries].sort((a, b) => {
    const au = isUpcomingRelease(a.releaseDate);
    const bu = isUpcomingRelease(b.releaseDate);
    if (au !== bu) return au ? -1 : 1;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
}
