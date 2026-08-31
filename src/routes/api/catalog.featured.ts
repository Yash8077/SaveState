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
        const { catalogJson, fetchFeaturedRails } = await import(
          "@/lib/catalog.server"
        );
        const rails = await fetchFeaturedRails();
        return catalogJson(rails, 1800);
      },
    },
  },
});
