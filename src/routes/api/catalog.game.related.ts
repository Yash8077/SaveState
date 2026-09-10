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
        const rails = id ? await fetchCatalogRelated(id) : [];
        return catalogJson(rails, 604800);
      },
    },
  },
});
