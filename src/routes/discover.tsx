import { useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { GameCard, GameRail } from "@/components/game-card";
import { CustomGameForm } from "@/components/custom-game-form";
import { HeroCarousel } from "@/components/hero-carousel";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { useHomeLayout } from "@/components/home-layout-provider";
import { useLibrary } from "@/hooks/use-library";
import { useMounted } from "@/hooks/use-mounted";
import { getFeaturedRails, searchGames, FEATURED_REL, FEATURED_STALE_MS, SEARCH_STALE_MS } from "@/lib/api";
import { FEATURED_SEED } from "@/lib/catalog-seed";
import { heroSlides } from "@/lib/hero";
import { homeSectionTitle, mergeDiscoverLayout } from "@/lib/home-layout";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { FeaturedRail } from "@/lib/types";

type SearchParams = { q?: string; focus?: boolean };

export const Route = createFileRoute("/discover")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" ? search.q : "",
    focus: search.focus === true || search.focus === "1" || search.focus === "true",
  }),
  component: Discover,
});

function Discover() {
  const { q = "", focus } = Route.useSearch();
  const [draft, setDraft] = useState(q);
  const [query, setQuery] = useState(q);
  const [showCustom, setShowCustom] = useState(false);
  const { user } = useCurrentUserState();
  const library = useLibrary();
  const navigate = Route.useNavigate();
  const lastWritten = useRef(q);
  const mounted = useMounted();
  const layout = useHomeLayout();

  useEffect(() => {
    const handle = window.setTimeout(() => setQuery(draft), 320);
    return () => window.clearTimeout(handle);
  }, [draft]);

  useEffect(() => {
    if (query === lastWritten.current) return;
    lastWritten.current = query;
    void navigate({ search: { q: query }, replace: true });
  }, [query, navigate]);

  useEffect(() => {
    if (q === lastWritten.current) return;
    lastWritten.current = q;
    setDraft(q);
    setQuery(q);
  }, [q]);

  const ready = query.trim().length >= 2;
  const results = useQuery({
    queryKey: ["search", query],
    queryFn: ({ signal }) => searchGames(query, signal),
    enabled: ready,
    staleTime: SEARCH_STALE_MS,
    gcTime: 30 * 60_000,
    placeholderData: (previous) => previous,
  });
  const featured = useQuery({
    queryKey: ["featured", FEATURED_REL],
    queryFn: ({ signal }) => getFeaturedRails(signal),
    staleTime: FEATURED_STALE_MS,
    gcTime: FEATURED_STALE_MS,
    placeholderData: FEATURED_SEED,
    enabled: mounted && !ready,
  });

  const games = results.data ?? [];
  const byCatalog = new Map(
    (library.data ?? []).map((e) => [e.catalogId, e] as const),
  );
  const showSkeleton = ready && results.isPending && games.length === 0;
  const rails = featured.data ?? FEATURED_SEED;
  const sections = useMemo(
    () => mergeDiscoverLayout(layout.discoverSections, rails.map((r) => r.id)),
    [layout.discoverSections, rails],
  );
  const railsById = new Map(rails.map((rail) => [rail.id, rail]));
  const slides = heroSlides([], rails);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Discover</h1>
        <p className="mt-1 text-sm text-muted">Find your next game.</p>
      </header>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-faint" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search games"
          autoFocus={Boolean(focus) && !q}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 rounded-full border-0 bg-subtle pr-4 pl-11"
        />
      </div>

      {ready ? (
        <>
          {showSkeleton ? (
            <div className="poster-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-2/3 w-full rounded-lg" />
              ))}
            </div>
          ) : null}
          {games.length > 0 ? (
            <div className="poster-grid">
              {games.map((g, i) => {
                const entry = byCatalog.get(g.id);
                return (
                  <div key={g.id} className="relative">
                    <GameCard
                      catalogId={g.id}
                      title={g.title}
                      coverUrl={g.coverUrl}
                      headerUrl={g.headerUrl}
                      capsuleUrl={g.capsuleUrl}
                      status={entry?.status}
                      score={entry?.score}
                      metacritic={g.metacritic}
                      size="grid"
                      priority={i < 6}
                    />
                    {entry ? (
                      <div className="pointer-events-none absolute top-1.5 left-1.5">
                        <StatusBadge status={entry.status} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
          {results.isFetched && games.length === 0 ? (
            <p className="text-sm text-muted">No matches for “{query}”.</p>
          ) : null}
          {user ? (
            <section className="rounded-xl bg-elevated p-4">
              <button
                type="button"
                className="flex min-h-12 w-full items-center gap-3 text-left"
                onClick={() => setShowCustom((v) => !v)}
              >
                <span className="grid size-10 place-items-center rounded-full bg-accent/20 text-accent">
                  <Plus className="size-5" />
                </span>
                <span>
                  <span className="block font-medium">Add a custom title</span>
                  <span className="block text-sm text-muted">
                    Not in the catalog? Log it anyway.
                  </span>
                </span>
              </button>
              {showCustom ? (
                <div className="mt-4">
                  <CustomGameForm onDone={() => setShowCustom(false)} />
                </div>
              ) : null}
            </section>
          ) : (
            <p className="text-sm text-muted">
              <Link to="/login" className="font-medium text-accent">
                Sign in
              </Link>{" "}
              to save titles.
            </p>
          )}
        </>
      ) : (
        <div className="space-y-7">
          {featured.isError && rails.length === 0 ? (
            <p className="text-sm text-dropped">
              Catalog is unavailable. Try searching, or add a custom title.
            </p>
          ) : null}
          {sections.map((section) => {
            if (!section.enabled) return null;
            if (section.id === "hero") {
              return slides.length ? (
                <HeroCarousel
                  key="hero"
                  games={slides}
                  autoplay={layout.autoplay}
                />
              ) : null;
            }
            const rail = railsById.get(section.id);
            if (!rail?.games.length) return null;
            return <CatalogRail key={rail.id} rail={rail} />;
          })}
        </div>
      )}
    </div>
  );
}

function CatalogRail({ rail }: { rail: FeaturedRail }) {
  const title = homeSectionTitle(rail.id) || rail.title;
  return (
    <GameRail title={title}>
      {rail.games.map((g, i) => (
        <GameCard
          key={`${rail.id}-${g.id}`}
          catalogId={g.id}
          title={g.title}
          coverUrl={g.coverUrl}
          headerUrl={g.headerUrl}
          capsuleUrl={g.capsuleUrl}
          metacritic={g.metacritic}
          priority={i < 6}
        />
      ))}
    </GameRail>
  );
}
