import { createFileRoute, Link } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { GameCard } from "@/components/game-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrary } from "@/hooks/use-library";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";

type LibrarySearch = { status?: Status | "all" | "favorites" };

export const Route = createFileRoute("/library")({
  validateSearch: (search: Record<string, unknown>): LibrarySearch => ({
    status:
      typeof search.status === "string"
        ? (search.status as LibrarySearch["status"])
        : "all",
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { user, isPending } = useCurrentUserState();
  const { status = "all" } = Route.useSearch();
  const library = useLibrary();

  if (isPending) {
    return <LibrarySkeleton />;
  }
  if (!user) return <RedirectToSignIn />;

  const entries = library.data ?? [];
  const filtered = entries.filter((e) => {
    if (status === "favorites") return e.favorite;
    if (status === "all" || !status) return true;
    return e.status === status;
  });

  const filters: { id: LibrarySearch["status"]; label: string }[] = [
    { id: "all", label: "All" },
    { id: "favorites", label: "Favorites" },
    ...STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s] })),
  ];

  return (
    <div className="space-y-4">
      <div className="chip-scroll">
        {filters.map((f) => (
          <Link
            key={f.id}
            to="/library"
            search={{ status: f.id }}
            className={cn(
              "h-9 shrink-0 rounded-full px-3.5 text-sm leading-9 font-medium",
              status === f.id
                ? "bg-accent text-accent-fg"
                : "bg-subtle text-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <p className="text-sm text-muted">
        {filtered.length} title{filtered.length === 1 ? "" : "s"}
      </p>

      {library.isLoading ? <LibrarySkeleton /> : null}

      {!library.isLoading && filtered.length === 0 ? (
        <div className="rounded-xl bg-elevated px-4 py-10 text-center">
          <p className="text-lg font-medium">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted">
            Browse the catalog or add a custom title.
          </p>
          <Link
            to="/search"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg"
          >
            Browse games
          </Link>
        </div>
      ) : (
        <div className="poster-grid">
          {filtered.map((e) => (
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
              size="grid"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="poster-grid">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="aspect-2/3 w-full rounded-lg" />
      ))}
    </div>
  );
}
