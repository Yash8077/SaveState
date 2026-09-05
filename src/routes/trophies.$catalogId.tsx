import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, Check, Crown, Gem, Medal, Trophy } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  getGameTrophyProgress,
  type GameTrophyProgressResult,
  type TrophyRow,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/trophies/$catalogId")({
  component: TrophyGamePage,
});

function tierIcon(type: string | null) {
  if (type === "platinum") return Crown;
  if (type === "gold") return Gem;
  if (type === "silver") return Medal;
  return Award;
}

function TierCounts({
  data,
}: {
  data: Extract<GameTrophyProgressResult, { found: true }>;
}) {
  const entries = [
    [Crown, "Platinum", data.platinum.earned],
    [Gem, "Gold", data.gold.earned],
    [Medal, "Silver", data.silver.earned],
    [Award, "Bronze", data.bronze.earned],
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {entries.map(([Icon, label, earned]) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-2xl bg-subtle px-3 py-2.5"
        >
          <Icon className="size-4 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-sm font-semibold tabular-nums">{earned}</p>
            <p className="truncate text-[10px] uppercase tracking-[0.14em] text-faint">
              {label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrophyCard({ trophy }: { trophy: TrophyRow }) {
  const earned = trophy.earned;
  const hidden = Boolean(trophy.trophy_hidden && !earned);
  const name = hidden ? "Secret Trophy" : trophy.trophy_name || "Unnamed Trophy";
  const detail = hidden ? "Hidden trophy" : trophy.trophy_detail || "";
  const Icon = tierIcon(trophy.trophy_type);

  return (
    <article
      className={`rounded-2xl bg-elevated px-4 py-3.5 transition-colors ${
        earned ? "" : "opacity-75"
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-subtle text-accent">
          {trophy.trophy_icon_url && !hidden ? (
            <img
              src={trophy.trophy_icon_url}
              alt=""
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          ) : (
            <Icon className="size-5" />
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
  const query = useQuery({
    queryKey: ["game-trophy-progress", catalogId],
    queryFn: ({ signal }) => getGameTrophyProgress(catalogId, signal),
    enabled: Boolean(user),
    staleTime: 2 * 60_000,
  });

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

  // The API is the canonical ordering source. Do not resort on the client.
  const trophies = data.trophies;
  const percentage = Math.min(100, Math.max(0, data.percentage));

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div>
        <Link
          to="/trophies"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-subtle px-4 text-sm font-medium text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          Trophies
        </Link>
      </div>

      <section className="overflow-hidden rounded-[2rem] bg-elevated">
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                {data.platform}
              </div>
              <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                {data.titleName}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {data.earned} of {data.total} trophies · {data.percentage}%
              </p>
            </div>

            <Link
              to="/game/$catalogId"
              params={{ catalogId }}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg"
            >
              Open game
            </Link>
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
        </div>
      </section>

      <section>
        <div className="mb-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">
            Trophy list
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            {data.earned} earned · {data.total - data.earned} remaining
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trophies.map((trophy) => (
            <TrophyCard key={`${trophy.trophy_id}`} trophy={trophy} />
          ))}
        </div>
      </section>
    </div>
  );
}
