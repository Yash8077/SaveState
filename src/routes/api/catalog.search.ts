import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/catalog/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { catalogRateLimitResponse } = await import(
          "@/lib/rate-limit.server"
        );
        const limited = catalogRateLimitResponse(request);
        if (limited) return limited;
        const url = new URL(request.url);
        const q = url.searchParams.get("q") ?? "";
        const { parseCatalogProvider } = await import("@/lib/catalog-provider");
        const provider = parseCatalogProvider(url.searchParams.get("provider"));
        const { catalogJson, searchCatalog } = await import(
          "@/lib/catalog.server"
        );
        const games = await searchCatalog(q, provider);
        return catalogJson(games, 120);
      },
    },
  },
});
