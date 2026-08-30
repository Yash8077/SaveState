import type { CatalogDetails, CatalogGame } from "./types.ts";

const FETCH_MS = 4000;
const UA = "SaveState/1.0 (https://github.com/Yash8077/SaveState)";
const API = "https://en.wikipedia.org/w/api.php";
const REST = "https://en.wikipedia.org/api/rest_v1/page/summary";

export function wikiCatalogId(title: string): string {
  return `wiki_${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

export function parseWikiTitle(catalogId: string): string | null {
  if (!catalogId.startsWith("wiki_")) return null;
  try {
    return decodeURIComponent(catalogId.slice(5)).replace(/_/g, " ");
  } catch {
    return null;
  }
}

export function isVideoGameSummary(row: {
  title?: string;
  description?: string;
  extract?: string;
}): boolean {
  const title = row.title ?? "";
  const description = row.description ?? "";
  if (/\(series\)|\(franchise\)|disambiguation/i.test(title)) return false;
  if (/\b(awards?|publisher|company|magazine)\b/i.test(title) && !/\(video game\)/i.test(title)) {
    return false;
  }
  if (/publisher|awards show|award ceremony|media franchise/i.test(description)) {
    return false;
  }
  return /video\s*game|videogame/i.test(`${description} ${title}`);
}

export function wikiImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)wikimedia\.org$/i.test(parsed.hostname)) return null;
    parsed.search = "";
    return `/api/catalog/art?src=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return null;
  }
}

type WikiSearchHit = { title?: string };
type WikiSummary = {
  title?: string;
  description?: string;
  extract?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
};

async function wikiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) throw new Error(`Wikipedia request failed (${res.status})`);
  return (await res.json()) as T;
}

async function fetchSummary(title: string): Promise<WikiSummary | null> {
  try {
    return await wikiGet<WikiSummary>(`${REST}/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  } catch {
    return null;
  }
}

function toGame(summary: WikiSummary): CatalogGame | null {
  if (!summary.title || !isVideoGameSummary(summary)) return null;
  const cover =
    wikiImageUrl(summary.originalimage?.source) ??
    wikiImageUrl(summary.thumbnail?.source);
  return {
    id: wikiCatalogId(summary.title),
    steamId: null,
    title: summary.title.replace(/\s*\(video game\)$/i, ""),
    coverUrl: cover,
    headerUrl: cover,
    capsuleUrl: cover,
    platforms: [],
    metacritic: null,
  };
}

export async function searchWikipedia(query: string): Promise<CatalogGame[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: `${q} video game`,
    srlimit: "8",
    format: "json",
    utf8: "1",
  });
  try {
    const data = await wikiGet<{ query?: { search?: WikiSearchHit[] } }>(
      `${API}?${params}`,
    );
    const titles = (data.query?.search ?? [])
      .map((row) => row.title)
      .filter((title): title is string => Boolean(title));
    const summaries = await Promise.all(titles.slice(0, 6).map(fetchSummary));
    const games: CatalogGame[] = [];
    const seen = new Set<string>();
    for (const summary of summaries) {
      if (!summary) continue;
      const game = toGame(summary);
      if (!game || seen.has(game.id)) continue;
      seen.add(game.id);
      games.push(game);
    }
    return games;
  } catch {
    return [];
  }
}

export async function fetchWikiDetails(
  catalogId: string,
): Promise<CatalogDetails | null> {
  const title = parseWikiTitle(catalogId);
  if (!title) return null;
  const summary = await fetchSummary(title);
  if (!summary) return null;
  const game = toGame(summary);
  if (!game) return null;
  return {
    ...game,
    summary: summary.extract ?? "",
    releaseDate: null,
    comingSoon: /upcoming/i.test(summary.description ?? ""),
    genres: [],
    developers: [],
    publishers: [],
    screenshots: [],
    website: summary.content_urls?.desktop?.page ?? null,
    related: [],
  };
}
