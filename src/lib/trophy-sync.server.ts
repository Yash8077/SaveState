import { createHash } from "node:crypto";
import type { Sql } from "@/lib/db";
import type { TrophySyncInput } from "@/lib/trophy-schema";
import { syncPs5Trophies } from "@/lib/trophies.server";

const LOCK_MAX_AGE_MINUTES = 10;
const EMPTY_STATUS = "never_synced" as const;

type SyncStatus = "never_synced" | "syncing" | "synced" | "failed";

type SyncStateRow = {
  payload_hash: string;
  processed_trophy_ids_json: string;
  status: SyncStatus;
};

type NormalizedGame = {
  titleId: string;
  trophyTitleId: string;
  trophyIds: number[];
};

function normalizeTitleId(value: string): string {
  return value.trim().toUpperCase().replace(/_00$/, "");
}

function normalizeTrophyTitleId(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function normalizeGames(input: TrophySyncInput): NormalizedGame[] {
  const byKey = new Map<string, Set<number>>();

  for (const game of input.games) {
    const titleId = normalizeTitleId(game.titleId);
    const trophyTitleId = normalizeTrophyTitleId(game.trophyTitleId);
    const key = `${titleId}\u0000${trophyTitleId}`;
    const ids = byKey.get(key) ?? new Set<number>();

    for (const trophyId of game.trophyIds) {
      ids.add(trophyId);
    }

    byKey.set(key, ids);
  }

  return [...byKey.entries()].map(([key, ids]) => {
    const separator = key.indexOf("\u0000");
    return {
      titleId: key.slice(0, separator),
      trophyTitleId: key.slice(separator + 1),
      trophyIds: [...ids].sort((a, b) => a - b),
    };
  });
}

function payloadHash(
  titleId: string,
  trophyTitleId: string,
  trophyIds: number[],
): string {
  const canonical = JSON.stringify([titleId, trophyTitleId, trophyIds]);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function parseStoredIds(value: string): number[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id): id is number => Number.isInteger(id))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mergeIds(existing: number[], incoming: number[]): number[] {
  return [...new Set([...existing, ...incoming])].sort((a, b) => a - b);
}

async function acquireDeviceLock(sql: Sql, deviceId: string): Promise<boolean> {
  const rows = await sql<{ id: string }>`
    update ps5_devices
       set trophy_sync_lock_acquired_at = now()
     where id = ${deviceId}
       and (
         trophy_sync_lock_acquired_at is null
         or trophy_sync_lock_acquired_at <
              now() - (${LOCK_MAX_AGE_MINUTES} * interval '1 minute')
       )
     returning id
  `;

  return rows.length === 1;
}

async function releaseDeviceLock(sql: Sql, deviceId: string): Promise<void> {
  await sql`
    update ps5_devices
       set trophy_sync_lock_acquired_at = null,
           last_seen_at = now()
     where id = ${deviceId}
  `;
}

async function ensureState(
  sql: Sql,
  deviceId: string,
  titleId: string,
  trophyTitleId: string,
): Promise<SyncStateRow> {
  const rows = await sql<SyncStateRow>`
    insert into ps5_trophy_sync_state (
      device_id,
      title_id,
      trophy_title_id,
      status,
      updated_at
    ) values (
      ${deviceId},
      ${titleId},
      ${trophyTitleId},
      ${EMPTY_STATUS},
      now()
    )
    on conflict (device_id, title_id, trophy_title_id)
    do update set updated_at = now()
    returning payload_hash, processed_trophy_ids_json, status
  `;

  return rows[0]!;
}

async function markSyncing(
  sql: Sql,
  deviceId: string,
  titleId: string,
  trophyTitleId: string,
): Promise<void> {
  await sql`
    update ps5_trophy_sync_state
       set status = 'syncing',
           last_attempt_at = now(),
           last_error_at = null,
           last_error = null,
           updated_at = now()
     where device_id = ${deviceId}
       and title_id = ${titleId}
       and trophy_title_id = ${trophyTitleId}
  `;
}

async function markSynced(
  sql: Sql,
  deviceId: string,
  titleId: string,
  trophyTitleId: string,
  hash: string,
  processedTrophyIds: number[],
): Promise<void> {
  await sql`
    update ps5_trophy_sync_state
       set payload_hash = ${hash},
           processed_trophy_ids_json = ${JSON.stringify(processedTrophyIds)},
           status = 'synced',
           last_success_at = now(),
           last_error_at = null,
           last_error = null,
           updated_at = now()
     where device_id = ${deviceId}
       and title_id = ${titleId}
       and trophy_title_id = ${trophyTitleId}
  `;
}

async function markFailed(
  sql: Sql,
  deviceId: string,
  titleId: string,
  trophyTitleId: string,
  message: string,
): Promise<void> {
  await sql`
    update ps5_trophy_sync_state
       set status = 'failed',
           last_error_at = now(),
           last_error = ${message.slice(0, 1000)},
           updated_at = now()
     where device_id = ${deviceId}
       and title_id = ${titleId}
       and trophy_title_id = ${trophyTitleId}
  `;
}

export async function syncPs5TrophiesIncremental(
  sql: Sql,
  input: TrophySyncInput,
) {
  const acquired = await acquireDeviceLock(sql, input.deviceId);

  if (!acquired) {
    return {
      ok: false,
      locked: true,
      gamesReceived: input.games.length,
      gamesProcessed: 0,
      gamesSkipped: 0,
      gamesChanged: 0,
      gamesFailed: 0,
      trophiesMarked: 0,
      trophiesAlreadyProcessed: 0,
    };
  }

  let gamesProcessed = 0;
  let gamesSkipped = 0;
  let gamesChanged = 0;
  let gamesFailed = 0;
  let trophiesMarked = 0;
  let trophiesAlreadyProcessed = 0;

  try {
    const games = normalizeGames(input);

    for (const game of games) {
      if (!game.titleId || !game.trophyTitleId || game.trophyIds.length === 0) {
        gamesFailed++;
        continue;
      }

      const hash = payloadHash(
        game.titleId,
        game.trophyTitleId,
        game.trophyIds,
      );

      try {
        const previous = await ensureState(
          sql,
          input.deviceId,
          game.titleId,
          game.trophyTitleId,
        );

        const previousIds = new Set(
          parseStoredIds(previous.processed_trophy_ids_json),
        );
        const newTrophyIds = game.trophyIds.filter(
          (id) => !previousIds.has(id),
        );

        if (newTrophyIds.length === 0) {
          trophiesAlreadyProcessed += game.trophyIds.length;
          gamesSkipped++;
          continue;
        }

        await markSyncing(
          sql,
          input.deviceId,
          game.titleId,
          game.trophyTitleId,
        );

        const result = await syncPs5Trophies(sql, {
          ...input,
          games: [
            {
              titleId: game.titleId,
              trophyTitleId: game.trophyTitleId,
              trophyIds: newTrophyIds,
            },
          ],
        });

        if (result.malformedGames > 0 || result.unknownTitles > 0) {
          const message =
            result.malformedGames > 0
              ? `Malformed trophy game payload for ${game.titleId}`
              : `PlayStation title ${game.titleId} is not cached`;

          await markFailed(
            sql,
            input.deviceId,
            game.titleId,
            game.trophyTitleId,
            message,
          );
          gamesFailed++;
          continue;
        }

        const mergedIds = mergeIds(
          [...previousIds],
          newTrophyIds,
        );

        // The state snapshot is committed only after the trophy upserts have
        // completed. A crash before this point merely causes a safe duplicate
        // retry on the next payload run.
        await markSynced(
          sql,
          input.deviceId,
          game.titleId,
          game.trophyTitleId,
          hash,
          mergedIds,
        );

        trophiesMarked += result.trophiesMarked;
        gamesChanged++;
        gamesProcessed++;
      } catch (error) {
        await markFailed(
          sql,
          input.deviceId,
          game.titleId,
          game.trophyTitleId,
          errorMessage(error),
        );
        gamesFailed++;
      }
    }

    return {
      ok: gamesFailed === 0,
      locked: false,
      gamesReceived: input.games.length,
      gamesProcessed,
      gamesSkipped,
      gamesChanged,
      gamesFailed,
      trophiesMarked,
      trophiesAlreadyProcessed,
    };
  } finally {
    await releaseDeviceLock(sql, input.deviceId);
  }
}
