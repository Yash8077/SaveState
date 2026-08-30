import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GameCard, GameRail } from "@/components/game-card";
import { useMounted } from "@/hooks/use-mounted";
import { getFeaturedRails } from "@/lib/api";
import { FEATURED_SEED } from "@/lib/catalog-seed";

export const Route = createFileRoute("/discover")({ component: Discover });

function Discover() {
  const mounted = useMounted();
  const featured = useQuery({
    queryKey: ["featured"],
    queryFn: ({ signal }) => getFeaturedRails(signal),
    staleTime: 30 * 60_000,
    placeholderData: FEATURED_SEED,
    enabled: mounted,
  });

  const rails = featured.data ?? FEATURED_SEED;

  return (
    <div className="space-y-7">
      {featured.isError && rails.length === 0 ? (
        <p className="text-sm text-dropped">
          Catalog is unavailable. Try Browse, or add a custom title.
        </p>
      ) : null}

      {rails.map((rail, railIndex) => (
        <GameRail key={rail.id} title={rail.title}>
          {rail.games.map((g, i) => (
            <GameCard
              key={`${rail.id}-${g.id}`}
              catalogId={g.id}
              title={g.title}
              coverUrl={g.coverUrl}
              headerUrl={g.headerUrl}
              capsuleUrl={g.capsuleUrl}
              priority={railIndex === 0 && i < 6}
            />
          ))}
        </GameRail>
      ))}
    </div>
  );
}
