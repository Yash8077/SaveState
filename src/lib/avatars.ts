import { AVATAR_SVG } from "./avatar-svg.ts";

export const DEFAULT_AVATARS = [
  { id: "robot_01", name: "Bolt" },
  { id: "robot_02", name: "Pixel" },
  { id: "robot_03", name: "Gyro" },
  { id: "robot_04", name: "Hex" },
  { id: "robot_05", name: "Nova" },
  { id: "robot_06", name: "Circuit" },
  { id: "robot_07", name: "Mag" },
  { id: "robot_08", name: "Chip" },
  { id: "robot_09", name: "Orbit" },
  { id: "robot_10", name: "Tank" },
  { id: "robot_11", name: "Pulse" },
  { id: "robot_12", name: "Core" },
] as const;

export type DefaultAvatarId = (typeof DEFAULT_AVATARS)[number]["id"];

export function defaultAvatarSrc(id: string): string {
  return `/avatars/${id}.png`;
}

export function avatarIdFromSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  const match = /^\/avatars\/([a-z0-9_]+)\.(png|svg)$/.exec(src.trim());
  return match?.[1] ?? null;
}

const KNOWN_SRC = new Set([
  ...DEFAULT_AVATARS.map((a) => defaultAvatarSrc(a.id)),
  ...Object.keys(AVATAR_SVG).map((id) => `/avatars/${id}.svg`),
]);

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
  if (KNOWN_SRC.has(value)) return value;
  if (DATA_IMAGE.test(value) && value.length <= MAX_DATA_CHARS) return value;
  return undefined;
}

export function isDefaultAvatar(src: string | null | undefined): boolean {
  return Boolean(src && KNOWN_SRC.has(src));
}
