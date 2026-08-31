export const DEFAULT_AVATARS = [
  { id: "robot", name: "Pulse" },
  { id: "fox", name: "Ember" },
  { id: "owl", name: "Nox" },
  { id: "cat", name: "Mochi" },
  { id: "wolf", name: "Ash" },
  { id: "dragon", name: "Jade" },
  { id: "octopus", name: "Ink" },
  { id: "bird", name: "Sky" },
  { id: "bear", name: "Honey" },
  { id: "alien", name: "Nova" },
  { id: "knight", name: "Aegis" },
  { id: "slime", name: "Bloom" },
  { id: "pad", name: "Pad" },
  { id: "cart", name: "Cart" },
  { id: "dice", name: "Dice" },
  { id: "sword", name: "Blade" },
  { id: "potion", name: "Flask" },
  { id: "arcade", name: "Arcade" },
  { id: "chest", name: "Loot" },
  { id: "ghost", name: "Haunt" },
] as const;

export type DefaultAvatarId = (typeof DEFAULT_AVATARS)[number]["id"];

export function defaultAvatarSrc(id: string): string {
  return `/avatars/${id}.svg`;
}

export function avatarIdFromSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  const match = /^\/avatars\/([a-z]+)\.svg$/.exec(src.trim());
  return match?.[1] ?? null;
}

const DEFAULT_SRC = new Set(DEFAULT_AVATARS.map((a) => defaultAvatarSrc(a.id)));

const DATA_IMAGE =
  /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

const MAX_DATA_CHARS = 120_000;

export function parseDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 40) return null;
  return name;
}

export function parseAvatarValue(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!value) return null;
  if (DEFAULT_SRC.has(value)) return value;
  if (DATA_IMAGE.test(value) && value.length <= MAX_DATA_CHARS) return value;
  return undefined;
}

export function isDefaultAvatar(src: string | null | undefined): boolean {
  return Boolean(src && DEFAULT_SRC.has(src));
}
