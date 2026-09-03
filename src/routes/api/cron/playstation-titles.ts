import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/playstation-titles")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { apiErrorResponse, apiJson } = await import("@/lib/api-auth.server");
        try {
          const configuredSecret = process.env.CRON_SECRET?.trim();
          if (configuredSecret) {
            const authorization = request.headers.get("authorization")?.trim() ?? "";
            if (authorization !== `Bearer ${configuredSecret}`) {
              return apiJson({ error: "Unauthorized" }, 401);
            }
          }

          const { getSql } = await import("@/lib/db");
          const { syncPlayStationTitles } = await import("@/lib/playstation-titles.server");
          const result = await syncPlayStationTitles(await getSql());
          return apiJson({ ok: true, ...result });
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
