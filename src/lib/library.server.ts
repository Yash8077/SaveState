import type { Sql } from "./db.ts";
import type {
  AddCustomGameInput,
  AddToLibraryInput,
  UpdateEntryInput,
} from "./library-schema.ts";
import {
  STATUSES,
  type GameEntry,
  type LibraryPage,
  type Status,
} from "./types.ts";

export type { AddCustomGameInput, AddToLibraryInput, UpdateEntryInput };

type EntryRow = {
  id: number;
  catalog_id: string;
  title: string;
  cover_url: string | null;
  header_url: string | null;
  summary: string | null;
  release_date: string | null;
  platforms: unknown;
  genres: unknown;
  metacritic: number | null;
  developers: unknown;
  publishers: unknown;
  screenshots: unknown;
  status: string;
  score: number | null;
  hours: number | string | null;
  favorite: boolean;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

const ENTRY_SELECT = `
  id, catalog_id, title, cover_url, header_url, summary, release_date,
  platforms, genres, metacritic, developers, publishers, screenshots,
  status, score, hours, favorite, notes,
  started_at::text as started_at, finished_at::text as finished_at,
  created_at::text as created_at, updated_at::text as updated_at
`;

function toHours(value: number | string | null): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  return match?.[1] ?? null;
}

export function mapEntry(row: EntryRow): GameEntry {
  const status = STATUSES.includes(row.status as Status)
    ? (row.status as Status)
    : "backlog";
  return {
    id: row.id,
    catalogId: row.catalog_id,
    title: row.title,
    coverUrl: row.cover_url,
    headerUrl: row.header_url,
    summary: row.summary,
    releaseDate: row.release_date,
    platforms: asStringArray(row.platforms),
    genres: asStringArray(row.genres),
    metacritic: row.metacritic,
    developers: asStringArray(row.developers),
    publishers: asStringArray(row.publishers),
    screenshots: asStringArray(row.screenshots),
    status,
    score: row.score,
    hours: toHours(row.hours),
    favorite: Boolean(row.favorite),
    notes: row.notes,
    startedAt: toIsoDate(row.started_at),
    finishedAt: toIsoDate(row.finished_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function jsonbBind(value: string[]): string {
  return JSON.stringify(value);
}

export function encodeLibraryCursor(updatedAt: string, id: number): string {
  return Buffer.from(JSON.stringify({ u: updatedAt, i: id }), "utf8").toString(
    "base64url",
  );
}

export function decodeLibraryCursor(
  raw: string | null | undefined,
): { u: string; i: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as { u?: unknown; i?: unknown };
    if (typeof parsed.u === "string" && Number.isInteger(parsed.i)) {
      return { u: parsed.u, i: parsed.i as number };
    }
  } catch {
    /* ignore malformed cursors */
  }
  return null;
}

export async function listLibraryPage(
  sql: Sql,
  userId: string,
  opts: { cursor?: string | null; limit?: number } = {},
): Promise<LibraryPage> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  const cursor = decodeLibraryCursor(opts.cursor);
  const rows = await sql.query<EntryRow>(
    `select ${ENTRY_SELECT} from game_entries
     where user_id = $1
       and (
         $2::timestamptz is null
         or updated_at < $2::timestamptz
         or (updated_at = $2::timestamptz and id < $3::int)
       )
     order by updated_at desc, id desc
     limit $4`,
    [userId, cursor?.u ?? null, cursor?.i ?? 0, limit + 1],
  );
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const items = page.map(mapEntry);
  const last = page[page.length - 1];
  return {
    items,
    nextCursor:
      hasMore && last ? encodeLibraryCursor(last.updated_at, last.id) : null,
  };
}

export async function addToLibraryRow(
  sql: Sql,
  userId: string,
  data: AddToLibraryInput,
): Promise<GameEntry> {
  const s = data.snapshot;
  const status = data.status ?? "playing";
  const rows = await sql.query<EntryRow>(
    `insert into game_entries (
      user_id, catalog_id, title, cover_url, header_url, summary, release_date,
      platforms, genres, metacritic, developers, publishers, screenshots,
      status, score, hours, favorite, started_at, finished_at, updated_at
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11::jsonb,$12::jsonb,$13::jsonb,
      $14,$15,$16,$17,$18,$19, now()
    )
    on conflict (user_id, catalog_id) do update set
      title = excluded.title,
      cover_url = excluded.cover_url,
      header_url = excluded.header_url,
      summary = excluded.summary,
      release_date = excluded.release_date,
      platforms = excluded.platforms,
      genres = excluded.genres,
      metacritic = excluded.metacritic,
      developers = excluded.developers,
      publishers = excluded.publishers,
      screenshots = excluded.screenshots,
      status = excluded.status,
      score = excluded.score,
      hours = excluded.hours,
      favorite = excluded.favorite,
      started_at = excluded.started_at,
      finished_at = excluded.finished_at,
      updated_at = now()
    returning ${ENTRY_SELECT}`,
    [
      userId,
      data.catalogId,
      s.title,
      s.coverUrl,
      s.headerUrl,
      s.summary,
      s.releaseDate,
      jsonbBind(s.platforms),
      jsonbBind(s.genres),
      s.metacritic,
      jsonbBind(s.developers),
      jsonbBind(s.publishers),
      jsonbBind(s.screenshots),
      status,
      data.score ?? null,
      data.hours ?? null,
      Boolean(data.favorite),
      toIsoDate(data.startedAt),
      toIsoDate(data.finishedAt),
    ],
  );
  return mapEntry(rows[0]!);
}

export async function addCustomGameRow(
  sql: Sql,
  userId: string,
  data: AddCustomGameInput,
): Promise<GameEntry> {
  const catalogId = `custom_${crypto.randomUUID()}`;
  const rows = await sql.query<EntryRow>(
    `insert into game_entries (
      user_id, catalog_id, title, status, notes, updated_at
    ) values ($1,$2,$3,$4,$5, now())
    returning ${ENTRY_SELECT}`,
    [
      userId,
      catalogId,
      data.title,
      data.status ?? "playing",
      data.notes?.trim() || null,
    ],
  );
  return mapEntry(rows[0]!);
}

export async function updateEntryRow(
  sql: Sql,
  userId: string,
  data: UpdateEntryInput,
): Promise<GameEntry> {
  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [];
  const push = (fragment: string, value: unknown) => {
    params.push(value);
    sets.push(fragment.replace("?", `$${params.length}`));
  };
  if (data.status !== undefined) push("status = ?", data.status);
  if (data.score !== undefined) push("score = ?", data.score);
  if (data.hours !== undefined) push("hours = ?", data.hours);
  if (data.favorite !== undefined) push("favorite = ?", data.favorite);
  if (data.notes !== undefined) push("notes = ?", data.notes);
  if (data.startedAt !== undefined) push("started_at = ?", toIsoDate(data.startedAt));
  if (data.finishedAt !== undefined) push("finished_at = ?", toIsoDate(data.finishedAt));
  params.push(data.id, userId);
  const idIdx = params.length - 1;
  const userIdx = params.length;
  const rows = await sql.query<EntryRow>(
    `update game_entries set ${sets.join(", ")}
     where id = $${idIdx} and user_id = $${userIdx}
     returning ${ENTRY_SELECT}`,
    params,
  );
  if (!rows[0]) {
    throw Object.assign(new Error("Game not found"), { status: 404 });
  }
  return mapEntry(rows[0]);
}

export async function removeEntryRow(
  sql: Sql,
  userId: string,
  id: number,
): Promise<{ ok: true }> {
  const rows = await sql.query<{ id: number }>(
    `delete from game_entries where id = $1 and user_id = $2 returning id`,
    [id, userId],
  );
  if (!rows[0]) {
    throw Object.assign(new Error("Game not found"), { status: 404 });
  }
  return { ok: true };
}
