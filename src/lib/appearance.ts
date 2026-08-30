export const ACCENTS = [
  { id: "teal", label: "Teal", accent: "#4fd8c4", fg: "#003731" },
  { id: "blue", label: "Blue", accent: "#8ec8ff", fg: "#00344f" },
  { id: "violet", label: "Violet", accent: "#d0bcff", fg: "#381e72" },
  { id: "amber", label: "Amber", accent: "#e4c18a", fg: "#3f2e04" },
  { id: "rose", label: "Rose", accent: "#ffb4ab", fg: "#690005" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export type Appearance = {
  oled: boolean;
  accent: AccentId;
};

const KEY = "savestate-appearance";

export const DEFAULT_APPEARANCE: Appearance = {
  oled: false,
  accent: "teal",
};

function isAccent(value: unknown): value is AccentId {
  return ACCENTS.some((item) => item.id === value);
}

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<Appearance>;
    return {
      oled: Boolean(parsed.oled),
      accent: isAccent(parsed.accent) ? parsed.accent : "teal",
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearance(next: Appearance) {
  localStorage.setItem(KEY, JSON.stringify(next));
  applyAppearance(next);
}

export function applyAppearance(next: Appearance) {
  const root = document.documentElement;
  root.classList.toggle("oled", next.oled);
  root.dataset.accent = next.accent;
}
