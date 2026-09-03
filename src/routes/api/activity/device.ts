import { createFileRoute } from "@tanstack/react-router";
import { createPs5DeviceInput } from "@/lib/activity-schema";

export const Route = createFileRoute("/api/activity/device")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import("@/lib/api-auth.server");
        try {
          const userId = await requireApiUser(request);
          const { getSql } = await import("@/lib/db");
          const { listPs5Devices } = await import("@/lib/activity.server");
          return apiJson(await listPs5Devices(await getSql(), userId));
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
      DELETE: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import("@/lib/api-auth.server");
        try {
          const userId = await requireApiUser(request);
          const id = new URL(request.url).searchParams.get("id");
          if (!id) return apiJson({ error: "Missing id" }, 400);
          const { getSql } = await import("@/lib/db");
          const rows = await (await getSql()).query(
            `delete from ps5_devices where id = $1 and user_id = $2 returning id`,
            [id, userId],
          );
          return apiJson({ ok: true, removed: rows.length === 1 });
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
      POST: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import("@/lib/api-auth.server");
        try {
          const userId = await requireApiUser(request);
          const parsed = createPs5DeviceInput.safeParse(await request.json().catch(() => ({})));
          if (!parsed.success) return apiJson({ error: "Invalid body" }, 400);
          const { getSql } = await import("@/lib/db");
          const { createPs5Device } = await import("@/lib/activity.server");
          return apiJson(await createPs5Device(await getSql(), userId, parsed.data.name ?? "PS5"), 201);
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
