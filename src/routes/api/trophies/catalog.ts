import { createFileRoute } from "@tanstack/react-router";
import { trophyCatalogInput } from "@/lib/trophy-schema";

function isAuthorizedCron(request: Request): boolean {
  const configured = process.env.CRON_SECRET?.trim() ?? "";
  const supplied = request.headers.get("x-cron-secret")?.trim() ?? "";
  return !!configured && configured === supplied;
}

export const Route = createFileRoute("/api/trophies/catalog")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { apiJson } = await import("@/lib/api-auth.server");
        if (!isAuthorizedCron(request)) {
          return apiJson({ error: "Unauthorized" }, 401);
        }

        const { getSql } = await import("@/lib/db");
        const { listUncachedTrophyCatalogTargets } =
          await import("@/lib/trophies.server");

        const targets = await listUncachedTrophyCatalogTargets(await getSql());

        return apiJson({
          npCommunicationIds: targets.map((row) => ({
            npCommunicationId: row.trophy_title_id,
            platform: row.platform,
            catalogSynced: false,
          })),
        });
      },

      POST: async ({ request }) => {
        const { apiJson } = await import("@/lib/api-auth.server");
        if (!isAuthorizedCron(request)) {
          return apiJson({ error: "Unauthorized" }, 401);
        }

        const parsed = trophyCatalogInput.safeParse(await request.json());
        if (!parsed.success) {
          return apiJson(
            { error: "Invalid trophy catalog payload" },
            400,
          );
        }

        const { getSql } = await import("@/lib/db");
        const { applyTrophyCatalog } =
          await import("@/lib/trophies.server");

        const result = await applyTrophyCatalog(await getSql(), parsed.data);

        return apiJson({ ok: true, ...result });
      },
    },
  },
});
