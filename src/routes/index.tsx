import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAppearance } from "@/components/appearance-provider";
import { GameCard, GameRail } from "@/components/game-card";
import { HeroCarousel } from "@/components/hero-carousel";
import { useLibrary } from "@/hooks/use-library";
import { useMounted } from "@/hooks/use-mounted";
import { getFeaturedRails } from "@/lib/api";
import { FEATURED_SEED } from "@/lib/catalog-seed";
import { heroSlides } from "@/lib/hero";
import { tintForCatalog } from "@/lib/tints";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatHours } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const mounted = useMounted();
  const { user } = useCurrentUserState();
  const library = useLibrary();
  const { appearance, setDynamicAccent } = useAppearance();
  const featured = useQuery({
    queryKey: ["featured", "rel-8"],
    queryFn: ({ signal }) => getFeaturedRails(signal),
    staleTime: 30 * 60_000,
    placeholderData: FEATURED_SEED,
    enabled: mounted,
  });

  const entries = library.data ?? [];
  const playing = entries.filter((e) => e.status === "playing");
  const backlog = entries.filter((e) => e.status === "backlog");
  const beaten = entries.filter((e) => e.status === "beaten");
  const favorites = entries.filter((e) => e.favorite);
  const hours = entries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
  const signedIn = mounted && Boolean(user);
  const name = user?.displayName?.split(" ")[0];
  const rails = featured.data ?? FEATURED_SEED;
  const slides = heroSlides(mounted ? playing : [], FEATURED_SEED);
  const tintSource = playing[0]?.catalogId ?? slides[0]?.id;

  useEffect(() => {
    if (!appearance.dynamic) return;
    if (!tintSource) return;
    setDynamicAccent(tintForCatalog(tintSource));
  }, [appearance.dynamic, tintSource, setDynamicAccent]);

  return (
    <div className="space-y-7">
      {slides.length ? <HeroCarousel games={slides} /> : null}

      {!signedIn && mounted ? (
        <header>
          <h2 className="text-2xl font-medium tracking-tight">Your games</h2>
          <p className="mt-1 text-sm text-muted">
            Log what you play. Syncs across phones and tablets.
          </p>
        </header>
      ) : null}

      {signedIn ? (
        <div>
          <p className="text-sm text-muted">
            {name ? `Welcome back, ${name}` : "Welcome back"}
            {hours > 0 ? ` · ${formatHours(hours)} logged` : ""}
          </p>
          <div className="chip-scroll mt-2">
            <Stat label="Playing" value={String(playing.length)} />
            <Stat label="Beaten" value={String(beaten.length)} />
            <Stat label="Backlog" value={String(backlog.length)} />
            <Stat label="Favorites" value={String(favorites.length)} />
          </div>
        </div>
      ) : null}

      {playing.length ? (
        <GameRail
          title="Continue playing"
          action={
            <Link to="/library" className="text-sm font-medium text-accent">
              All
            </Link>
          }
        >
          {playing.map((e) => (
            <GameCard
              key={e.id}
              catalogId={e.catalogId}
              title={e.title}
              coverUrl={e.coverUrl}
              headerUrl={e.headerUrl}
              status={e.status}
              score={e.score}
              hours={e.hours}
              favorite={e.favorite}
            />
          ))}
        </GameRail>
      ) : null}

      {backlog.length ? (
        <GameRail
          title="Planning to play"
          action={
            <Link to="/library" className="text-sm font-medium text-accent">
              Library
            </Link>
          }
        >
          {backlog.slice(0, 16).map((e) => (
            <GameCard
              key={e.id}
              catalogId={e.catalogId}
              title={e.title}
              coverUrl={e.coverUrl}
              headerUrl={e.headerUrl}
              status={e.status}
              favorite={e.favorite}
            />
          ))}
        </GameRail>
      ) : null}

      {signedIn && !library.isLoading && entries.length === 0 ? (
        <div className="rounded-xl bg-elevated px-4 py-8 text-center">
          <p className="text-lg font-medium">Library is empty</p>
          <p className="mt-1 text-sm text-muted">
            Search the catalog and add something you are playing.
          </p>
          <Link
            to="/search"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg"
          >
            Browse games
          </Link>
        </div>
      ) : null}

      <div>
        <h2 className="text-lg font-medium tracking-tight">Browse</h2>
        <p className="text-xs text-faint">
          Steam store rails ranked by popularity, plus PlayStation from IGDB.
        </p>
      </div>

      {rails.map((rail, railIndex) => (
        <GameRail key={rail.id} title={rail.title}>
          {rail.games.map((g, i) => (
            <GameCard
              key={`${rail.id}-${g.id}`}
              catalogId={g.id}
              title={g.title}
              coverUrl={g.coverUrl}
              headerUrl={g.headerUrl}
              priority={railIndex === 0 && i < 6}
            />
          ))}
        </GameRail>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="shrink-0 rounded-full bg-subtle px-3 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="ml-1.5 text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}
