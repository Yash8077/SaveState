import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Sql } from "./db";
import type { ActivityEventInput } from "./activity-schema";

const TOKEN_PREFIX = "ssps5_";

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function newDeviceToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export async function createPs5Device(
  sql: Sql,
  userId: string,
  name = "PS5",
): Promise<{ id: string; name: string; token: string }> {
  const id = randomUUID();
  const token = newDeviceToken();
  await sql.query(
    `insert into ps5_devices (id, user_id, name, token_hash)
     values ($1, $2, $3, $4)`,
    [id, userId, name, hashToken(token)],
  );
  return { id, name, token };
}

export async function listPs5Devices(
  sql: Sql,
  userId: string,
): Promise<Array<{ id: string; name: string; createdAt: string; lastSeenAt: string | null }>> {
  return sql.query(
    `select id, name, created_at::text as "createdAt", last_seen_at::text as "lastSeenAt"
       from ps5_devices
      where user_id = $1
      order by created_at desc`,
    [userId],
  );
}

export async function authenticatePs5Device(
  sql: Sql,
  deviceId: string,
  token: string,
): Promise<{ id: string; userId: string }> {
  const rows = await sql.query<{ id: string; user_id: string }>(
    `select id, user_id from ps5_devices where id = $1 and token_hash = $2 limit 1`,
    [deviceId, hashToken(token)],
  );
  const row = rows[0];
  if (!row) throw Object.assign(new Error("Invalid PS5 device credentials"), { status: 401 });
  return { id: row.id, userId: row.user_id };
}

export async function ingestPs5Activity(
  sql: Sql,
  device: { id: string; userId: string },
  events: ActivityEventInput[],
): Promise<{ accepted: number; duplicates: number }> {
  let accepted = 0;
  let duplicates = 0;
  for (const event of events) {
    const rows = await sql.query<{ inserted: boolean }>(
      `insert into ps5_activity_events
        (user_id, device_id, source_rowid, title_id, title_name, created_date, total_fg_time)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (device_id, source_rowid) do nothing
       returning true as inserted`,
      [
        device.userId,
        device.id,
        event.sourceRowid,
        event.titleId,
        event.titleName ?? null,
        event.createdDate,
        event.totalFgTime,
      ],
    );
    if (rows.length) accepted += 1;
    else duplicates += 1;
  }
  await sql.query(`update ps5_devices set last_seen_at = now() where id = $1`, [device.id]);
  return { accepted, duplicates };
}

export type ActivityDashboard = {
  totals: { seconds: number; sessions: number; games: number; days: number };
  recent: Array<{
    titleId: string;
    titleName: string | null;
    createdDate: string;
    seconds: number;
  }>;
  games: Array<{
    titleId: string;
    titleName: string | null;
    seconds: number;
    sessions: number;
    lastPlayed: string;
  }>;
  daily: Array<{
    date: string;
    titleId: string;
    titleName: string | null;
    seconds: number;
    sessions: number;
  }>;
};

export async function getActivityDashboard(
  sql: Sql,
  userId: string,
  limit = 100,
): Promise<ActivityDashboard> {
  const safeLimit = Math.min(200, Math.max(1, limit));
  const totals = await sql.query<{
    seconds: number | string;
    sessions: number | string;
    games: number | string;
    days: number | string;
  }>(
    `select coalesce(sum(total_fg_time), 0)::bigint as seconds,
            count(*)::bigint as sessions,
            count(distinct title_id)::bigint as games,
            count(distinct substr(created_date, 1, 10))::bigint as days
       from ps5_activity_events where user_id = $1`,
    [userId],
  );
  const recent = await sql.query(
    `select title_id as "titleId", max(title_name) as "titleName",
            created_date as "createdDate", total_fg_time as seconds
       from ps5_activity_events
      where user_id = $1
      order by created_date desc, id desc
      limit $2`,
    [userId, safeLimit],
  );
  const games = await sql.query(
    `select title_id as "titleId", max(title_name) as "titleName",
            sum(total_fg_time)::bigint as seconds,
            count(*)::bigint as sessions,
            max(created_date) as "lastPlayed"
       from ps5_activity_events
      where user_id = $1
      group by title_id
      order by sum(total_fg_time) desc, max(created_date) desc
      limit $2`,
    [userId, safeLimit],
  );
  const daily = await sql.query(
    `select substr(created_date, 1, 10) as date,
            title_id as "titleId",
            max(title_name) as "titleName",
            sum(total_fg_time)::bigint as seconds,
            count(*)::bigint as sessions
       from ps5_activity_events
      where user_id = $1
      group by substr(created_date, 1, 10), title_id
      order by date desc, seconds desc
      limit $2`,
    [userId, safeLimit * 30],
  );
  const t = totals[0] ?? { seconds: 0, sessions: 0, games: 0, days: 0 };
  return {
    totals: {
      seconds: Number(t.seconds),
      sessions: Number(t.sessions),
      games: Number(t.games),
      days: Number(t.days),
    },
    recent: recent.map((row) => ({ ...row, seconds: Number(row.seconds) })),
    games: games.map((row) => ({ ...row, seconds: Number(row.seconds), sessions: Number(row.sessions) })),
    daily: daily.map((row) => ({ ...row, seconds: Number(row.seconds), sessions: Number(row.sessions) })),
  };
}
