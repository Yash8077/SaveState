import type { Sql } from "./db.ts";
import { parseAvatarValue, parseDisplayName } from "./avatars.ts";

export type Profile = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  hasPassword: boolean;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
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
    `select id, name, email, image from "user" where id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image ?? null,
    hasPassword: await userHasPassword(sql, userId),
  };
}

export function profilePatchFromBody(body: unknown): {
  name?: string;
  image?: string | null;
} | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as { name?: unknown; image?: unknown };
  const patch: { name?: string; image?: string | null } = {};
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
  if (!("name" in patch) && !("image" in patch)) return null;
  return patch;
}

export async function updateProfileRow(
  sql: Sql,
  userId: string,
  patch: { name?: string; image?: string | null },
): Promise<Profile | null> {
  const current = await getProfile(sql, userId);
  if (!current) return null;
  const name = patch.name ?? current.name;
  const image = patch.image !== undefined ? patch.image : current.image;
  await sql.query(
    `update "user"
     set name = $2, image = $3, "updatedAt" = now()
     where id = $1`,
    [userId, name, image],
  );
  return getProfile(sql, userId);
}
