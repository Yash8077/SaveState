import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/catalog/featured")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { catalogRateLimitResponse } = await import(
          "@/lib/rate-limit.server"
        );
        const limited = catalogRateLimitResponse(request);
        if (limited) return limited;
        const { parseCatalogProvider } = await import("@/lib/catalog-provider");
        const provider = parseCatalogProvider(
          new URL(request.url).searchParams.get("provider"),
        );
        const { catalogJson, fetchFeaturedRails } = await import(
          "@/lib/catalog.server"
        );
        const rails = await fetchFeaturedRails(provider);
        return catalogJson(rails, 300);
      },
    },
  },
});
