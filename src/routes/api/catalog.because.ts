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
        const ids = raw
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 8);
        const names = (url.searchParams.get("names") ?? "")
          .split("|")
          .map((name) => {
            try {
              return decodeURIComponent(name.trim());
            } catch {
              return name.trim();
            }
          });
        const statuses = (url.searchParams.get("status") ?? "")
          .split(",")
          .map((value) => value.trim());
        const favorites = (url.searchParams.get("fav") ?? "")
          .split(",")
          .map((value) => value.trim() === "1");
        const scores = (url.searchParams.get("score") ?? "")
          .split(",")
          .map((value) => {
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
          });
        const seeds = ids.map((catalogId, i) => ({
          catalogId,
          title: names[i] || catalogId,
          favorite: Boolean(favorites[i]),
          status: statuses[i] || "beaten",
          score: scores[i] ?? null,
          updatedAt: String(100 - i),
        }));
        const { catalogJson } = await import("@/lib/catalog.server");
        if (seeds.length < 1) {
          return catalogJson({ id: "recommended", title: "Recommended", games: [] }, 60);
        }
        const { fetchBecauseRail } = await import("@/lib/because.server");
        const rail = await fetchBecauseRail(seeds);
        return catalogJson(rail, 172800);
      },
    },
  },
});
