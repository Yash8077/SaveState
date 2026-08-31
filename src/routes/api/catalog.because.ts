import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/catalog/because")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { catalogRateLimitResponse } = await import(
          "@/lib/rate-limit.server"
        );
        const limited = catalogRateLimitResponse(request);
        if (limited) return limited;
        const url = new URL(request.url);
        const raw = url.searchParams.get("seeds") ?? "";
        const seeds = raw
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 8)
          .map((catalogId, i) => ({
            catalogId,
            title: catalogId,
            favorite: false,
            status: "beaten",
            score: null,
            updatedAt: String(100 - i),
          }));
        const { catalogJson } = await import("@/lib/catalog.server");
        if (seeds.length < 2) {
          return catalogJson({ id: "recommended", title: "Recommended", games: [] }, 60);
        }
        const { fetchBecauseRail } = await import("@/lib/because.server");
        const rail = await fetchBecauseRail(seeds);
        return catalogJson(rail, 21600);
      },
    },
  },
});
