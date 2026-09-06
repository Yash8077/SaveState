import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  getTrophyProgress,
  type TrophyCounts,
  type TrophyGameProgress,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { TrophyTierCount, TrophyTierIcon, trophyTiers, type TrophyTier } from "@/components/trophy-tier";

export const Route = createFileRoute("/trophies")({ component: TrophiesPage });

function TypeStat({ type, count }: { type: TrophyTier; count: TrophyCounts }) {
  return (
    <TrophyTierCount
      type={type}
      value={count.earned}
      size={34}
      stacked
      className="text-sm"
    />
  );
}

function TrophyGameCard({ game }: { game: TrophyGameProgress }) {
  const card = (
    <div className="group overflow-hidden rounded-3xl bg-elevated transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex gap-4 p-4 sm:p-5">
        <div className="size-24 shrink-0 overflow-hidden rounded-2xl bg-subtle sm:size-28">
          {game.coverUrl ? (
            <img src={game.coverUrl} alt="" referrerPolicy="no-referrer" className="size-full object-cover transition duration-500 group-hover:scale-105" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold sm:text-lg">{game.title}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-faint">{game.platform}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-semibold tabular-nums text-accent">{game.earned}/{game.total}</p>
              <p className="text-[11px] text-muted">{game.percentage}%</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, game.percentage))}%` }} />
          </div>
          <div className="mt-4 flex max-w-sm gap-5">
            {trophyTiers.map((type) => (
              <TypeStat key={type} type={type} count={game[type]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return game.catalogId ? (
    <Link to="/trophies/$catalogId" params={{ catalogId: game.catalogId }} className="block">
      {card}
    </Link>
  ) : (
    <div aria-disabled="true">{card}</div>
  );
}

function TrophiesPage() {
  const { user, isPending } = useCurrentUserState();
  const query = useQuery({
    queryKey: ["trophy-progress"],
    queryFn: ({ signal }) => getTrophyProgress(signal),
    enabled: Boolean(user),
    staleTime: 2 * 60_000,
  });

  if (isPending || (user && query.isLoading)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-3xl" />)}
        </div>
      </div>
    );
  }

  if (!user) return <RedirectToSignIn />;
  if (query.isError) {
    return (
      <div className="rounded-3xl bg-elevated p-8 text-center">
        <Trophy className="mx-auto size-9 text-faint" />
        <p className="mt-3 text-lg font-medium">Couldn’t load trophies</p>
        <p className="mt-1 text-sm text-muted">Try again after signing in.</p>
      </div>
    );
  }

  const games = (query.data?.games ?? []) as TrophyGameProgress[];
  const summary = query.data?.summary ?? {
    total: 0, earned: 0, platinum: 0, gold: 0, silver: 0, bronze: 0, percentage: 0, games: 0,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-12 min-[720px]:max-w-none">
      <header className="flex items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent"><Trophy className="size-6" /></div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Trophies</h1>
          <p className="mt-1 text-sm text-muted">Your recovered PlayStation trophy progress.</p>
        </div>
      </header>

      <div className="min-[720px]:grid min-[720px]:grid-cols-[22rem_minmax(0,1fr)] min-[720px]:items-start min-[720px]:gap-6">
        <section className="rounded-[2rem] bg-elevated p-5 sm:p-6 min-[720px]:sticky min-[720px]:top-4 min-[720px]:min-h-[calc(100dvh-7rem)]">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">Overall progress</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{summary.earned}/{summary.total}</p>
          <p className="mt-1 text-sm text-muted">{summary.percentage}% across {summary.games} game{summary.games === 1 ? "" : "s"}</p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-accent" style={{ width: `${summary.percentage}%` }} /></div>
          <div className="mt-5 flex gap-5">
            {trophyTiers.map((type) => (
              <Metric key={type} type={type} value={summary[type]} />
            ))}
          </div>
        </section>

        {games.length ? (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">Your games</p><h2 className="mt-1 text-xl font-semibold">Trophy progress</h2></div>
              <p className="text-sm text-muted">{games.length} tracked</p>
            </div>
            <div className="grid gap-4">{games.map((game) => <TrophyGameCard key={`${game.platform}-${game.titleId}`} game={game} />)}</div>
          </section>
        ) : (
          <div className="rounded-3xl bg-elevated p-8 text-center">
            <Trophy className="mx-auto size-9 text-faint" />
            <p className="mt-3 text-lg font-medium">No trophies synced yet</p>
            <p className="mt-1 text-sm text-muted">Launch the SaveState PS5 payload once to import locally earned trophies.</p>
            <Link to="/library" className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg">Open library</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ type, value }: { type: TrophyTier; value: number }) {
  return (
    <div className="flex min-w-14 flex-col items-center gap-1">
      <TrophyTierIcon type={type} size={36} />
      <p className="text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
