import { tunedAccent } from "./tints.ts";

export const ACCENTS = [
  { id: "teal", label: "Teal", accent: "#4fd8c4", fg: "#003731" },
  { id: "blue", label: "Blue", accent: "#8ec8ff", fg: "#00344f" },
  { id: "violet", label: "Violet", accent: "#d0bcff", fg: "#381e72" },
  { id: "amber", label: "Amber", accent: "#e4c18a", fg: "#3f2e04" },
  { id: "rose", label: "Rose", accent: "#ffb4ab", fg: "#690005" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];
export type ThemeMode = "system" | "light" | "dark";

export type GrainIntensity = "low" | "medium" | "high";

export type Appearance = {
  mode: ThemeMode;
  oled: boolean;
  accent: AccentId;
  grain: boolean;
  grainIntensity: GrainIntensity;
  bloom: boolean;
  dynamic: boolean;
};

const KEY = "savestate-appearance";

export const DEFAULT_APPEARANCE: Appearance = {
  mode: "dark",
  oled: false,
  accent: "teal",
  grain: false,
  grainIntensity: "medium",
  bloom: true,
  dynamic: false,
};

function isAccent(value: unknown): value is AccentId {
  return ACCENTS.some((item) => item.id === value);
}

function isMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function isGrain(value: unknown): value is GrainIntensity {
  return value === "low" || value === "medium" || value === "high";
}

export function parseAppearance(raw: unknown): Appearance {
  if (!raw || typeof raw !== "object") return DEFAULT_APPEARANCE;
  const parsed = raw as Partial<Appearance>;
  return {
    mode: isMode(parsed.mode) ? parsed.mode : "dark",
    oled: Boolean(parsed.oled),
    accent: isAccent(parsed.accent) ? parsed.accent : "teal",
    grain: Boolean(parsed.grain),
    grainIntensity: isGrain(parsed.grainIntensity)
      ? parsed.grainIntensity
      : "medium",
    bloom: parsed.bloom !== false,
    dynamic: Boolean(parsed.dynamic),
  };
}

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    return parseAppearance(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearance(next: Appearance) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function isDarkAppearance(
  next: Appearance,
  systemDark = systemPrefersDark(),
): boolean {
  if (next.mode === "light") return false;
  if (next.mode === "dark") return true;
  return systemDark;
}

export function applyAppearance(
  next: Appearance,
  systemDark = systemPrefersDark(),
  dynamicHex?: string | null,
) {
  const root = document.documentElement;
  const dark = isDarkAppearance(next, systemDark);
  root.classList.toggle("light", !dark);
  root.classList.toggle("oled", dark && next.oled);
  root.classList.toggle("grain", next.grain);
  root.classList.toggle("bloom", next.bloom);
  root.dataset.grain = next.grainIntensity;
  root.style.colorScheme = dark ? "dark" : "light";

  if (next.dynamic && dynamicHex) {
    const tuned = tunedAccent(dynamicHex, dark);
    root.dataset.accent = "dynamic";
    root.style.setProperty("--color-accent", tuned.accent);
    root.style.setProperty("--color-accent-fg", tuned.fg);
    root.style.setProperty("--color-primary", tuned.accent);
    root.style.setProperty("--color-primary-fg", tuned.fg);
    return;
  }

  root.dataset.accent = next.accent;
  root.style.removeProperty("--color-accent");
  root.style.removeProperty("--color-accent-fg");
  root.style.removeProperty("--color-primary");
  root.style.removeProperty("--color-primary-fg");
}
