import type { Sql } from "./db.ts";
import { parseAvatarValue, parseBannerValue, parseBannerY, parseDisplayName } from "./avatars.ts";

export type Profile = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  banner: string | null;
  bannerY: number;
  hasPassword: boolean;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  banner: string | null;
  banner_y: number | null;
};

export async function userHasPassword(
  sql: Sql,
  userId: string,
): Promise<boolean> {
  const rows = await sql.query<{ ok: number }>(
    `select 1 as ok from account
     where "userId" = $1
       and "providerId" = 'credential'
       and password is not null
     limit 1`,
    [userId],
  );
  return rows.length > 0;
}

export async function getProfile(
  sql: Sql,
  userId: string,
): Promise<Profile | null> {
  const rows = await sql.query<UserRow>(
    `select id, name, email, image, banner, banner_y from "user" where id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image ?? null,
    banner: row.banner ?? null,
    bannerY: parseBannerY(row.banner_y) ?? 50,
    hasPassword: await userHasPassword(sql, userId),
  };
}

export type ProfilePatch = {
  name?: string;
  image?: string | null;
  banner?: string | null;
  bannerY?: number;
};

export function profilePatchFromBody(body: unknown): ProfilePatch | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as { name?: unknown; image?: unknown; banner?: unknown; bannerY?: unknown };
  const patch: ProfilePatch = {};
  if ("name" in raw) {
    const name = parseDisplayName(raw.name);
    if (!name) return null;
    patch.name = name;
  }
  if ("image" in raw) {
    const image = parseAvatarValue(raw.image);
    if (image === undefined) return null;
    patch.image = image;
  }
  if ("banner" in raw) {
    const banner = parseBannerValue(raw.banner);
    if (banner === undefined) return null;
    patch.banner = banner;
  }
  if ("bannerY" in raw) {
    const y = parseBannerY(raw.bannerY);
    if (y === undefined) return null;
    patch.bannerY = y;
  }
  if (
    !("name" in patch) &&
    !("image" in patch) &&
    !("banner" in patch) &&
    !("bannerY" in patch)
  ) {
    return null;
  }
  return patch;
}

export async function updateProfileRow(
  sql: Sql,
  userId: string,
  patch: ProfilePatch,
): Promise<Profile | null> {
  const current = await getProfile(sql, userId);
  if (!current) return null;
  const name = patch.name ?? current.name;
  const image = patch.image !== undefined ? patch.image : current.image;
  const banner = patch.banner !== undefined ? patch.banner : current.banner;
  const bannerY = patch.bannerY ?? current.bannerY;
  await sql.query(
    `update "user"
     set name = $2, image = $3, banner = $4, banner_y = $5, "updatedAt" = now()
     where id = $1`,
    [userId, name, image, banner, bannerY],
  );
  return getProfile(sql, userId);
}