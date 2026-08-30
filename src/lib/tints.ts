const FALLBACK = [
  "#4fd8c4",
  "#8ec8ff",
  "#d0bcff",
  "#e4c18a",
  "#ffb4ab",
] as const;

const GAME_TINTS: Record<string, string> = {
  steam_1245620: "#8a7040",
  steam_1086940: "#8b3a2a",
  steam_1091500: "#1a8a9a",
  steam_292030: "#7a2e24",
  steam_1174180: "#5c6b3a",
  steam_271590: "#3d6b4a",
  steam_2358720: "#8a6a38",
  steam_1623730: "#3e7a48",
  steam_553850: "#b4562a",
  steam_1145350: "#6b3a8a",
  steam_2379780: "#8a6a28",
  steam_2622380: "#7a5a38",
  steam_1030300: "#3a4a6a",
  steam_1145360: "#8a2a2a",
  steam_367520: "#2a2a38",
  steam_413150: "#4a7a3a",
  steam_814380: "#6a3a2a",
  steam_1593500: "#4a5a6a",
  steam_2322010: "#3a4a5a",
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace("#", "");
  const n = Number.parseInt(raw.length === 3 ? raw.repeat(2) : raw, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return { h: h / 6, s, l };
}

function hue2rgb(p: number, q: number, t: number) {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = clamp01(s);
  const light = clamp01(l);
  if (sat === 0) {
    const v = Math.round(light * 255);
    return `#${v.toString(16).padStart(2, "0").repeat(3)}`;
  }
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function hashIndex(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % FALLBACK.length;
}

export function tintForCatalog(catalogId: string): string {
  return GAME_TINTS[catalogId] ?? FALLBACK[hashIndex(catalogId)]!;
}

export function tunedAccent(
  hex: string,
  dark: boolean,
): { accent: string; fg: string } {
  const { r, g, b } = hexToRgb(hex);
  const { h, s } = rgbToHsl(r, g, b);
  if (dark) {
    return {
      accent: hslToHex(h, Math.min(0.42, s * 0.7 + 0.18), 0.72),
      fg: hslToHex(h, 0.38, 0.12),
    };
  }
  return {
    accent: hslToHex(h, Math.min(0.48, s * 0.65 + 0.16), 0.34),
    fg: hslToHex(h, 0.12, 0.97),
  };
}
