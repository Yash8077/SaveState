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
    if (entry.status === "playing" && (entry.score ?? 0) >= 8) return true;
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
