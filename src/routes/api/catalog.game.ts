import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/catalog/game")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { catalogRateLimitResponse } = await import(
          "@/lib/rate-limit.server"
        );
        const limited = catalogRateLimitResponse(request);
        if (limited) return limited;
        const id = new URL(request.url).searchParams.get("id") ?? "";
        const { catalogJson, fetchCatalogDetails } = await import(
          "@/lib/catalog.server"
        );
        const data = id ? await fetchCatalogDetails(id) : null;
        return catalogJson(data, 30);
      },
    },
  },
});
