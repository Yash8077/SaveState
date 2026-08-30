import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { GameCard } from "@/components/game-card";
import { CustomGameForm } from "@/components/custom-game-form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { searchGames } from "@/lib/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLibrary } from "@/hooks/use-library";
import { StatusBadge } from "@/components/status-badge";

type SearchParams = { q?: string };

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q = "" } = Route.useSearch();
  const [draft, setDraft] = useState(q);
  const [query, setQuery] = useState(q);
  const [showCustom, setShowCustom] = useState(false);
  const { user } = useCurrentUserState();
  const library = useLibrary();
  const navigate = Route.useNavigate();
  const lastWritten = useRef(q);

  useEffect(() => {
    const handle = window.setTimeout(() => setQuery(draft), 180);
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
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: (previous) => previous,
  });

  const games = results.data ?? [];
  const byCatalog = new Map(
    (library.data ?? []).map((e) => [e.catalogId, e] as const),
  );
  const showSkeleton = ready && results.isPending && games.length === 0;

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-faint" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search games"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 rounded-full border-0 bg-subtle pr-4 pl-11"
        />
      </div>

      {showSkeleton ? (
        <div className="poster-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-2/3 w-full rounded-lg" />
          ))}
        </div>
      ) : null}

      {ready && games.length > 0 ? (
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

      {ready && results.isFetched && games.length === 0 ? (
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
    </div>
  );
}
