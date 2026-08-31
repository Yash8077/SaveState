import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours === 0) return "0h";
  if (hours < 10) return `${hours.toFixed(1).replace(/\.0$/, "")}h`;
  return `${Math.round(hours)}h`;
}

/** IGDB 0–100 critic/user mix as Saikou-style 7.7 */
export function ratingLabel(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(score) || score <= 0) return null;
  const ten = score > 10 ? score / 10 : score;
  return ten.toFixed(1);
}

const STEAM_IMG =
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";

export function steamPortraitUrl(catalogId: string): string | null {
  const match = /^steam_(\d+)$/.exec(catalogId);
  return match ? `${STEAM_IMG}/${match[1]}/library_600x900.jpg` : null;
}

/** Make catalog art URLs loadable in the browser (protocol-relative, http). */
export function normalizeArtUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice(7)}`;
  if (trimmed.startsWith("https://") || trimmed.startsWith("/")) return trimmed;
  return trimmed;
}

/** Steam capsules/headers/heroes are landscape; library covers are 2:3 portraits. */
export function isLandscapeArt(url: string | null | undefined): boolean {
  if (!url) return false;
  if (/library_capsule|library_600x900|cover_big|cover_art/i.test(url)) return false;
  return /(?:header(?:_2x)?\.jpg|capsule_231|capsule_616|capsule_184|library_hero|hero_capsule)/i.test(
    url,
  );
}

export function pickPortraitCover(
  ...urls: Array<string | null | undefined>
): string | null {
  const normalized = urls
    .map((url) => normalizeArtUrl(url))
    .filter((url): url is string => Boolean(url));
  return (
    normalized.find((url) => !isLandscapeArt(url)) ?? normalized[0] ?? null
  );
}

export function upgradeSteamCapsule(url: string | null | undefined): string | null {
  const normalized = normalizeArtUrl(url);
  if (!normalized) return null;
  return normalized.replace(/capsule_231x87(?=_2x)?\.jpg/i, "capsule_231x87_2x.jpg");
}

/** Prefer Steam library_hero_2x / IGDB 1080p so wide banners stay sharp. */
export function upgradeHeroUrl(
  url: string | null | undefined,
  catalogId?: string | null,
): string | null {
  let normalized = normalizeArtUrl(url);
  if (!normalized) {
    const steam = /^steam_(\d+)$/.exec(catalogId ?? "");
    return steam ? `${STEAM_IMG}/${steam[1]}/library_hero_2x.jpg` : null;
  }
  normalized = normalized.replace(
    /\/t_(thumb|cover_small|cover_big|screenshot_med|screenshot_big|720p)\b/g,
    "/t_1080p",
  );
  normalized = normalized
    .replace(/\/header(?:_2x)?\.jpg/i, "/library_hero_2x.jpg")
    .replace(/\/library_hero\.jpg/i, "/library_hero_2x.jpg");
  return normalized;
}
