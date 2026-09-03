import { createFileRoute } from "@tanstack/react-router";
import { ingestPs5ActivityInput } from "@/lib/activity-schema";

export const Route = createFileRoute("/api/activity/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { apiErrorResponse, apiJson } = await import("@/lib/api-auth.server");
        try {
          const rawToken = request.headers.get("x-savestate-device-token")?.trim() ?? "";
          if (!rawToken) return apiJson({ error: "Missing device token" }, 401);
          const parsed = ingestPs5ActivityInput.safeParse(await request.json());
          if (!parsed.success) return apiJson({ error: "Invalid activity payload" }, 400);
          const { getSql } = await import("@/lib/db");
          const { authenticatePs5Device, ingestPs5Activity } = await import("@/lib/activity.server");
          const sql = await getSql();
          const device = await authenticatePs5Device(sql, parsed.data.deviceId, rawToken);
          const result = await ingestPs5Activity(sql, device, parsed.data.events);
          return apiJson({ ok: true, ...result });
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
