import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { GameCard } from "@/components/game-card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrary } from "@/hooks/use-library";
import { STATUSES, STATUS_LABEL, type GameEntry, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";

type LibrarySearch = { status?: Status | "all" | "favorites" };
type LibrarySort = "name-asc" | "name-desc" | "hours-desc" | "hours-asc";

const SORTS: { id: LibrarySort; label: string }[] = [
  { id: "name-asc", label: "Name A–Z" },
  { id: "name-desc", label: "Name Z–A" },
  { id: "hours-desc", label: "Hours high–low" },
  { id: "hours-asc", label: "Hours low–high" },
];

function sortEntries(entries: GameEntry[], sort: LibrarySort): GameEntry[] {
  const list = [...entries];
  list.sort((a, b) => {
    if (sort === "name-asc") return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    if (sort === "name-desc") return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
    const ah = a.hours;
    const bh = b.hours;
    if (ah == null && bh == null) return 0;
    if (ah == null) return 1;
    if (bh == null) return -1;
    return sort === "hours-desc" ? bh - ah : ah - bh;
  });
  return list;
}

export const Route = createFileRoute("/library")({
  validateSearch: (search: Record<string, unknown>): LibrarySearch => ({
    status:
      typeof search.status === "string"
        ? (search.status as LibrarySearch["status"])
        : "all",
  }),
  component: LibraryPage,
});

const PAGE_SIZE = 60;

function LibraryPage() {
  const { user, isPending } = useCurrentUserState();
  const { status = "all" } = Route.useSearch();
  const library = useLibrary();
  const [sort, setSort] = useState<LibrarySort>("name-asc");
  const [titleQuery, setTitleQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const entries = library.data ?? [];
  const filtered = useMemo(() => {
    const needle = titleQuery.trim().toLowerCase();
    const next = entries.filter((e) => {
      if (status === "favorites") {
        if (!e.favorite) return false;
      } else if (status && status !== "all") {
        if (e.status !== status) return false;
      }
      if (needle && !e.title.toLowerCase().includes(needle)) return false;
      return true;
    });
    return sortEntries(next, sort);
  }, [entries, status, sort, titleQuery]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [status, sort, titleQuery]);

  if (isPending) {
    return <LibrarySkeleton />;
  }
  if (!user) return <RedirectToSignIn />;

  const filters: { id: LibrarySearch["status"]; label: string }[] = [
    { id: "all", label: "All" },
    { id: "favorites", label: "Favorites" },
    ...STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s] })),
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Library</h1>
        <p className="mt-1 text-sm text-muted">Every game you own, one shelf.</p>
      </header>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-faint" />
        <Input
          value={titleQuery}
          onChange={(e) => setTitleQuery(e.target.value)}
          placeholder="Search your library"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 rounded-full border-0 bg-subtle pr-4 pl-11"
        />
      </div>
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {filtered.length} title{filtered.length === 1 ? "" : "s"}
        </p>
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort
          <select
            className="h-9 rounded-full bg-subtle px-3 text-sm text-fg"
            value={sort}
            onChange={(e) => setSort(e.target.value as LibrarySort)}
          >
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {library.isLoading ? <LibrarySkeleton /> : null}

      {!library.isLoading && filtered.length === 0 ? (
        <div className="rounded-xl bg-elevated px-4 py-10 text-center">
          <p className="text-lg font-medium">
            {entries.length === 0 ? "Nothing here yet" : "No matching titles"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {entries.length === 0
              ? "Browse Discover or add a custom title."
              : "Try another name or clear the search."}
          </p>
          {entries.length === 0 ? (
          <Link
            to="/discover"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg"
          >
            Discover games
          </Link>
          ) : null}
        </div>
      ) : (
        <>
        <div className="poster-grid">
          {filtered.slice(0, visible).map((e) => (
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
              metacritic={e.metacritic}
              size="grid"
            />
          ))}
        </div>
        {visible < filtered.length ? (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setVisible((n) => n + PAGE_SIZE)}
              className="h-11 rounded-full bg-subtle px-5 text-sm font-medium"
            >
              Load more ({filtered.length - visible} left)
            </button>
          </div>
        ) : null}
        </>
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
