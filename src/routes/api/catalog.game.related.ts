import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/catalog/game/related")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { catalogRateLimitResponse } = await import(
          "@/lib/rate-limit.server"
        );
        const limited = catalogRateLimitResponse(request);
        if (limited) return limited;
        const id = new URL(request.url).searchParams.get("id") ?? "";
        const { catalogJson, fetchCatalogRelated } = await import(
          "@/lib/catalog.server"
        );
        try {
          const rails = id ? await fetchCatalogRelated(id) : [];
          return catalogJson(rails, rails.length ? 604800 : 120);
        } catch {
          return new Response("[]", {
            status: 503,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          });
        }
      },
    },
  },
});
