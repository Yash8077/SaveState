import { createFileRoute } from "@tanstack/react-router";
import { trophySyncInput } from "@/lib/trophy-schema";

export const Route = createFileRoute("/api/trophies/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { apiErrorResponse, apiJson } = await import("@/lib/api-auth.server");

        try {
          const rawToken = request.headers.get("x-savestate-device-token")?.trim() ?? "";
          if (!rawToken) return apiJson({ error: "Missing device token" }, 401);

          const parsed = trophySyncInput.safeParse(await request.json());
          if (!parsed.success) return apiJson({ error: "Invalid trophy payload" }, 400);

          const { getSql } = await import("@/lib/db");
          const { authenticatePs5Device } = await import("@/lib/activity.server");
          const { syncPs5Trophies } = await import("@/lib/trophies.server");

          const sql = await getSql();
          const device = await authenticatePs5Device(sql, parsed.data.deviceId, rawToken);

          if (device.id !== parsed.data.deviceId) {
            return apiJson({ error: "Invalid device" }, 401);
          }

          const result = await syncPs5Trophies(sql, parsed.data);
          return apiJson({ ok: true, ...result });
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
