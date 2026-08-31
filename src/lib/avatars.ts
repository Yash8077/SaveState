/** Built-in badge path: /avatars/avatar_1.png, avatar_2.png, … */
const AVATAR_PATH = /^\/avatars\/avatar_(\d+)\.png$/;
const LEGACY_ROBOT = /^\/avatars\/robot_0*(\d+)\.png$/;

const DATA_IMAGE =
  /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

const MAX_DATA_CHARS = 120_000;

/** Shown for guests and anyone without a saved portrait. */
export const GUEST_AVATAR = "/avatars/avatar_6.png";

export function defaultAvatarSrc(id: string): string {
  return `/avatars/${id}.png`;
}

export function avatarIdFromSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  const match = /^\/avatars\/(avatar_\d+)\.png$/.exec(src.trim());
  return match?.[1] ?? null;
}

/** Map leftover robot_N / svg paths onto the current PNG set. */
export function canonicalizeAvatar(
  src: string | null | undefined,
): string | null {
  if (!src) return null;
  const value = src.trim();
  if (!value) return null;
  const robot = LEGACY_ROBOT.exec(value);
  if (robot) return `/avatars/avatar_${Number(robot[1])}.png`;
  if (value.endsWith(".svg")) return GUEST_AVATAR;
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
  if (DATA_IMAGE.test(value) && value.length <= MAX_DATA_CHARS) return value;
  return undefined;
}

export function isDefaultAvatar(src: string | null | undefined): boolean {
  const value = canonicalizeAvatar(src);
  return Boolean(value && AVATAR_PATH.test(value));
}

const MAX_BANNER_CHARS = 400_000;
const BANNER_HOST =
  /^https:\/\/(?:(?:shared|cdn)\.akamai\.steamstatic\.com|steamcdn-a\.akamaihd\.net|images\.igdb\.com)\//i;

/** Custom photo, Steam/IGDB art, or null to use the automatic favorite hero. */
export function parseBannerValue(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!value || value === "auto") return null;
  if (DATA_IMAGE.test(value) && value.length <= MAX_BANNER_CHARS) return value;
  if (BANNER_HOST.test(value)) return value;
  return undefined;
}

export function parseBannerY(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function sortAvatarSrcs(srcs: string[]): string[] {
  return [...srcs].sort((a, b) => {
    const n = (s: string) => Number(AVATAR_PATH.exec(s)?.[1] ?? 0);
    return n(a) - n(b);
  });
}
