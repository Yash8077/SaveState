import { AVATAR_SVG } from "./avatar-svg.ts";

/** Built-in badge path: /avatars/avatar_1.png, avatar_2.png, … */
const AVATAR_PATH = /^\/avatars\/avatar_(\d+)\.png$/;
const LEGACY_ROBOT = /^\/avatars\/robot_0*(\d+)\.png$/;
const LEGACY_SVG = /^\/avatars\/([a-z]+)\.svg$/;

const DATA_IMAGE =
  /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

const MAX_DATA_CHARS = 120_000;

export function defaultAvatarSrc(id: string): string {
  return `/avatars/${id}.png`;
}

export function avatarIdFromSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  const match = /^\/avatars\/([a-z0-9_]+)\.(png|svg)$/.exec(src.trim());
  return match?.[1] ?? null;
}

/** Map leftover robot_N paths onto avatar_N so old profile rows still render. */
export function canonicalizeAvatar(
  src: string | null | undefined,
): string | null {
  if (!src) return null;
  const value = src.trim();
  const robot = LEGACY_ROBOT.exec(value);
  if (robot) return `/avatars/avatar_${Number(robot[1])}.png`;
  return value;
}

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
  const value = canonicalizeAvatar(raw.trim());
  if (!value) return null;
  if (AVATAR_PATH.test(value)) return value;
  const svg = LEGACY_SVG.exec(value);
  if (svg && svg[1] in AVATAR_SVG) return value;
  if (DATA_IMAGE.test(value) && value.length <= MAX_DATA_CHARS) return value;
  return undefined;
}

export function isDefaultAvatar(src: string | null | undefined): boolean {
  const value = canonicalizeAvatar(src);
  return Boolean(value && AVATAR_PATH.test(value));
}

export function sortAvatarSrcs(srcs: string[]): string[] {
  return [...srcs].sort((a, b) => {
    const n = (s: string) => Number(AVATAR_PATH.exec(s)?.[1] ?? 0);
    return n(a) - n(b);
  });
}
