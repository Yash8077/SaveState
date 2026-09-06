import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Trophy } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  getGameTrophyProgress,
  type GameTrophyProgressResult,
  type TrophyRow,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { TrophyTierCount, TrophyTierIcon, trophyTiers, type TrophyTier } from "@/components/trophy-tier";
import { sortTrophies, TROPHY_SORTS, type TrophySort } from "@/lib/trophy-sort";

export const Route = createFileRoute("/trophies/$catalogId")({
  component: TrophyGamePage,
});

function TierCounts({
  data,
}: {
  data: Extract<GameTrophyProgressResult, { found: true }>;
}) {
  return (
    <div className="flex max-w-md gap-6">
      {trophyTiers.map((type: TrophyTier) => (
        <TrophyTierCount
          key={type}
          type={type}
          value={data[type].earned}
          size={34}
          stacked
          className="text-sm"
        />
      ))}
    </div>
  );
}

function TrophyCard({ trophy }: { trophy: TrophyRow }) {
  const earned = trophy.earned;
  const hidden = Boolean(trophy.trophy_hidden && !earned);
  const name = hidden ? "Secret Trophy" : trophy.trophy_name || "Unnamed Trophy";
  const detail = hidden ? "Hidden trophy" : trophy.trophy_detail || "";

  return (
    <article
      className={`rounded-2xl bg-elevated px-4 py-3.5 transition-colors ${
        earned ? "" : "opacity-75"
      }`}
    >
      <div className="flex items-center gap-3.5">
        <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-subtle text-accent">
          {trophy.trophy_icon_url && !hidden ? (
            <img
              src={trophy.trophy_icon_url}
              alt=""
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          ) : (
            <TrophyTierIcon type={trophy.trophy_type} size={28} faded={!earned} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{name}</p>
              {detail ? (
                <p className="mt-0.5 line-clamp-2 text-sm leading-5 text-muted">
                  {detail}
                </p>
              ) : null}
            </div>

            {earned ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                <Check className="size-3" />
                Earned
              </span>
            ) : null}
          </div>

          {earned && trophy.earned_at ? (
            <p className="mt-2 text-xs text-faint">
              {new Date(trophy.earned_at).toLocaleDateString()}
            </p>
          ) : null}
        </div>

        <TrophyTierIcon type={trophy.trophy_type} size={36} faded={!earned} />
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-28 rounded-full" />
      <Skeleton className="h-52 w-full rounded-[2rem]" />
      <Skeleton className="h-24 w-full rounded-3xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function TrophyGamePage() {
  const { catalogId } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [sort, setSort] = useState<TrophySort>("default");
  const query = useQuery({
    queryKey: ["game-trophy-progress", catalogId],
    queryFn: ({ signal }) => getGameTrophyProgress(catalogId, signal),
    enabled: Boolean(user),
    staleTime: 2 * 60_000,
  });
  const trophies = useMemo(
    () => (query.data?.found ? sortTrophies(query.data.trophies, sort) : []),
    [query.data, sort],
  );

  if (isPending || (user && query.isLoading)) return <LoadingState />;
  if (!user) return <RedirectToSignIn />;

  if (query.isError) {
    return (
      <div className="rounded-[2rem] bg-elevated p-10 text-center">
        <Trophy className="mx-auto size-9 text-faint" />
        <p className="mt-3 text-lg font-semibold">Couldn’t load trophies</p>
        <p className="mt-1 text-sm text-muted">
          Try again after signing in.
        </p>
      </div>
    );
  }

  const data = query.data;
  if (!data?.found) {
    return (
      <div className="py-16 text-center">
        <Trophy className="mx-auto size-10 text-faint" />
        <h1 className="mt-4 text-xl font-semibold">No synced trophies</h1>
        <p className="mt-1 text-sm text-muted">
          This game does not have recovered trophy data yet.
        </p>
        <Link
          to="/game/$catalogId"
          params={{ catalogId }}
          className="mt-5 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg"
        >
          Open game
        </Link>
      </div>
    );
  }

  const percentage = Math.min(100, Math.max(0, data.percentage));

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12 min-[720px]:max-w-none">
      <div>
        <Link
          to="/trophies"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-subtle px-4 text-sm font-medium text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          Trophies
        </Link>
      </div>

      <div className="min-[720px]:grid min-[720px]:grid-cols-[22rem_minmax(0,1fr)] min-[720px]:items-start min-[720px]:gap-6">
        <section className="overflow-hidden rounded-[2rem] bg-elevated min-[720px]:sticky min-[720px]:top-4">
          <div className="relative h-40 overflow-hidden bg-subtle sm:h-52">
            {data.headerUrl || data.coverUrl ? (
              <img
                src={data.headerUrl || data.coverUrl || undefined}
                alt=""
                referrerPolicy="no-referrer"
                className="size-full object-cover object-center"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/35 to-transparent" />
          </div>

          <div className="relative -mt-10 px-5 pb-5 sm:px-6">
            <div className="min-w-0">
              <div className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                {data.platform}
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {data.titleName}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {data.earned} of {data.total} trophies · {data.percentage}%
              </p>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-subtle">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>

            <div className="mt-4">
              <TierCounts data={data} />
            </div>

            <Link
              to="/game/$catalogId"
              params={{ catalogId }}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg"
            >
              Open game
            </Link>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">
                Trophy list
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {data.earned} earned · {data.total - data.earned} remaining
              </h2>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              Sort
              <select
                className="h-9 rounded-full bg-subtle px-3 text-sm text-fg"
                value={sort}
                onChange={(e) => setSort(e.target.value as TrophySort)}
              >
                {TROPHY_SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-2">
            {trophies.map((trophy) => (
              <TrophyCard key={`${trophy.trophy_id}`} trophy={trophy} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
