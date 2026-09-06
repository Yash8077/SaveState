import { createFileRoute } from "@tanstack/react-router";

type SyncStatus = "never_synced" | "syncing" | "synced" | "failed";

export const Route = createFileRoute("/api/sync/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } =
          await import("@/lib/api-auth.server");

        try {
          const userId = await requireApiUser(request);
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();

          const devices = await sql<{
            id: string;
            name: string;
            created_at: string;
            last_seen_at: string | null;
            activity_sync_status: SyncStatus;
            activity_last_attempt_at: string | null;
            activity_last_success_at: string | null;
            activity_last_error_at: string | null;
            activity_last_error: string | null;
          }>`
            select
              id,
              name,
              created_at::text as created_at,
              last_seen_at::text as last_seen_at,
              activity_sync_status,
              activity_last_attempt_at::text as activity_last_attempt_at,
              activity_last_success_at::text as activity_last_success_at,
              activity_last_error_at::text as activity_last_error_at,
              activity_last_error
            from ps5_devices
            where user_id = ${userId}
            order by created_at desc
            limit 1
          `;

          if (devices.length === 0) {
            return apiJson({
              device: null,
              activity: {
                status: "never_synced" as SyncStatus,
                lastAttemptAt: null,
                lastSyncedAt: null,
                lastErrorAt: null,
                lastError: null,
              },
              trophies: {
                status: "never_synced" as SyncStatus,
                lastAttemptAt: null,
                lastSyncedAt: null,
                lastErrorAt: null,
                lastError: null,
                sets: [],
                syncedSets: 0,
                failedSets: 0,
                syncingSets: 0,
                pendingSets: 0,
              },
            });
          }

          const device = devices[0];

          const trophyRows = await sql<{
            title_id: string;
            trophy_title_id: string;
            status: SyncStatus;
            last_attempt_at: string | null;
            last_success_at: string | null;
            last_error_at: string | null;
            last_error: string | null;
            updated_at: string;
          }>`
            select
              title_id,
              trophy_title_id,
              status,
              last_attempt_at::text as last_attempt_at,
              last_success_at::text as last_success_at,
              last_error_at::text as last_error_at,
              last_error,
              updated_at::text as updated_at
            from ps5_trophy_sync_state
            where device_id = ${device.id}
            order by updated_at desc
          `;

          const syncedSets = trophyRows.filter(
            (row) => row.status === "synced",
          ).length;
          const failedSets = trophyRows.filter(
            (row) => row.status === "failed",
          ).length;
          const syncingSets = trophyRows.filter(
            (row) => row.status === "syncing",
          ).length;
          const pendingSets = trophyRows.filter(
            (row) =>
              row.status === "never_synced" ||
              row.status === "failed",
          ).length;

          let trophyStatus: SyncStatus = "never_synced";
          if (syncingSets > 0) trophyStatus = "syncing";
          else if (failedSets > 0) trophyStatus = "failed";
          else if (syncedSets > 0) trophyStatus = "synced";

          const latestAttempt = trophyRows
            .map((row) => row.last_attempt_at)
            .filter((value): value is string => value != null)
            .sort()
            .at(-1) ?? null;

          const latestSuccess = trophyRows
            .map((row) => row.last_success_at)
            .filter((value): value is string => value != null)
            .sort()
            .at(-1) ?? null;

          const latestErrorRow = [...trophyRows]
            .filter((row) => row.last_error_at != null)
            .sort((a, b) =>
              String(b.last_error_at).localeCompare(
                String(a.last_error_at),
              ),
            )[0];

          return apiJson({
            device: {
              id: device.id,
              name: device.name,
              createdAt: device.created_at,
              lastSeenAt: device.last_seen_at,
            },
            activity: {
              status: device.activity_sync_status,
              lastAttemptAt: device.activity_last_attempt_at,
              lastSyncedAt: device.activity_last_success_at,
              lastErrorAt: device.activity_last_error_at,
              lastError: device.activity_last_error,
            },
            trophies: {
              status: trophyStatus,
              lastAttemptAt: latestAttempt,
              lastSyncedAt: latestSuccess,
              lastErrorAt: latestErrorRow?.last_error_at ?? null,
              lastError: latestErrorRow?.last_error ?? null,
              syncedSets,
              failedSets,
              syncingSets,
              pendingSets,
              sets: trophyRows.map((row) => ({
                titleId: row.title_id,
                trophyTitleId: row.trophy_title_id,
                status: row.status,
                lastAttemptAt: row.last_attempt_at,
                lastSyncedAt: row.last_success_at,
                lastErrorAt: row.last_error_at,
                lastError: row.last_error,
              })),
            },
          });
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
