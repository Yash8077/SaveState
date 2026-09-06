import { createFileRoute } from "@tanstack/react-router";
import { ingestPs5ActivityInput } from "@/lib/activity-schema";

export const Route = createFileRoute("/api/activity/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { apiErrorResponse, apiJson } = await import("@/lib/api-auth.server");

        try {
          const rawToken =
            request.headers.get("x-savestate-device-token")?.trim() ?? "";
          if (!rawToken) {
            return apiJson({ error: "Missing device token" }, 401);
          }

          const parsed = ingestPs5ActivityInput.safeParse(await request.json());
          if (!parsed.success) {
            return apiJson({ error: "Invalid activity payload" }, 400);
          }

          const { getSql } = await import("@/lib/db");
          const {
            authenticatePs5Device,
            ingestPs5Activity,
          } = await import("@/lib/activity.server");

          const sql = await getSql();
          const device = await authenticatePs5Device(
            sql,
            parsed.data.deviceId,
            rawToken,
          );

          await sql`
            update ps5_devices
               set activity_sync_status = 'syncing',
                   activity_last_attempt_at = now(),
                   activity_last_error_at = null,
                   activity_last_error = null
             where id = ${device.id}
          `;

          try {
            const result = await ingestPs5Activity(
              sql,
              device,
              parsed.data.events,
            );

            await sql`
              update ps5_devices
                 set activity_sync_status = 'synced',
                     activity_last_success_at = now(),
                     activity_last_error_at = null,
                     activity_last_error = null
               where id = ${device.id}
            `;

            return apiJson({ ok: true, ...result });
          } catch (err) {
            const message =
              err instanceof Error ? err.message : String(err);

            await sql`
              update ps5_devices
                 set activity_sync_status = 'failed',
                     activity_last_error_at = now(),
                     activity_last_error = ${message.slice(0, 1000)}
               where id = ${device.id}
            `;

            throw err;
          }
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
