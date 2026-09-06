import { createFileRoute } from "@tanstack/react-router";
import { trophySyncInput } from "@/lib/trophy-schema";

export const Route = createFileRoute("/api/trophies/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { apiErrorResponse, apiJson } =
          await import("@/lib/api-auth.server");

        try {
          const rawToken =
            request.headers.get("x-savestate-device-token")?.trim() ?? "";
          if (!rawToken) return apiJson({ error: "Missing device token" }, 401);

          const parsed = trophySyncInput.safeParse(await request.json());
          if (!parsed.success) {
            return apiJson({ error: "Invalid trophy payload" }, 400);
          }

          const { getSql } = await import("@/lib/db");
          const { authenticatePs5Device } =
            await import("@/lib/activity.server");
          const { syncPs5TrophiesIncremental } =
            await import("@/lib/trophy-sync.server");

          const sql = await getSql();
          const device = await authenticatePs5Device(
            sql,
            parsed.data.deviceId,
            rawToken,
          );

          if (device.id !== parsed.data.deviceId) {
            return apiJson({ error: "Invalid device" }, 401);
          }

          const result = await syncPs5TrophiesIncremental(sql, parsed.data);

          // 409 has exactly one meaning in this protocol: the device-wide
          // trophy sync lock is currently held by another payload invocation.
          // Duplicate trophies are handled by idempotent DB upserts and are
          // therefore normal successful requests, not 409 conflicts.
          if (result.locked) {
            return apiJson(
              {
                ok: false,
                retryable: true,
                code: "SYNC_LOCKED",
                error: "Trophy sync already in progress",
              },
              409,
            );
          }

          // 207 means at least one game failed and the payload must retain its
          // pending local work. The fully successful path is always 200.
          return apiJson(result, result.ok ? 200 : 207);
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
