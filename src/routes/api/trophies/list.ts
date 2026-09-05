import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/trophies/list")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import(
          "@/lib/api-auth.server"
        );

        try {
          const userId = await requireApiUser(request);
          const { getSql } = await import("@/lib/db");
          const { listLibraryTrophyProgressFast } = await import(
            "@/lib/trophy-list.server"
          );
          const { ensureLibraryArtwork } = await import(
            "@/lib/library-artwork.server"
          );
          const { summarizeTrophyGames } = await import("@/lib/trophies.server");

          const sql = await getSql();

          // Keep the fast DB-only trophy query. Only entries missing artwork
          // use the one-time catalog fallback, which persists the result.
          const games = await listLibraryTrophyProgressFast(sql, userId);
          const hydratedGames = await Promise.all(
            games.map(async (game) => {
              if (game.coverUrl && game.headerUrl) return game;

              const artwork = await ensureLibraryArtwork(
                sql,
                userId,
                game.catalogId,
                {
                  coverUrl: game.coverUrl,
                  headerUrl: game.headerUrl,
                },
              );

              return { ...game, ...artwork };
            }),
          );

          const summary = summarizeTrophyGames(hydratedGames);
          return apiJson({ summary, games: hydratedGames });
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
