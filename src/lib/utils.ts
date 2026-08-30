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

const STEAM_IMG =
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";

export function steamPortraitUrl(catalogId: string): string | null {
  const match = /^steam_(\d+)$/.exec(catalogId);
  return match ? `${STEAM_IMG}/${match[1]}/library_600x900.jpg` : null;
}
