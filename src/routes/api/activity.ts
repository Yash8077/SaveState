import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/activity")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import("@/lib/api-auth.server");
        try {
          const userId = await requireApiUser(request);
          const url = new URL(request.url);
          const limitRaw = url.searchParams.get("limit");
          const month = url.searchParams.get("month") || undefined;
          const limit = limitRaw ? Number(limitRaw) : 100;
          if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
            return apiJson({ error: "Invalid limit" }, 400);
          }
          if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            return apiJson({ error: "Invalid month" }, 400);
          }
          const { getSql } = await import("@/lib/db");
          const { getActivityDashboard } = await import("@/lib/activity.server");
          return apiJson(await getActivityDashboard(await getSql(), userId, limit, month));
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
