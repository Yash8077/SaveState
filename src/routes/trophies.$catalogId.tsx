import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Crown, Gem, Medal, Trophy } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getGameTrophyProgress, type GameTrophyProgressResult, type TrophyRow } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/trophies/$catalogId")({ component: TrophyGamePage });

const TIER_ORDER: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

function sortedTrophies(trophies: TrophyRow[]) {
  return [...trophies].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    const tier = (TIER_ORDER[a.trophy_type ?? ""] ?? 99) - (TIER_ORDER[b.trophy_type ?? ""] ?? 99);
    if (tier !== 0) return tier;
    if (a.earned && b.earned) {
      const ad = a.earned_at ? Date.parse(a.earned_at) : 0;
      const bd = b.earned_at ? Date.parse(b.earned_at) : 0;
      if (ad !== bd) return bd - ad;
    }
    return a.trophy_id - b.trophy_id;
  });
}

function tierIcon(type: string | null) {
  if (type === "platinum") return Crown;
  if (type === "gold") return Gem;
  if (type === "silver") return Medal;
  return Award;
}

function TierCounts({ data }: { data: Extract<GameTrophyProgressResult, { found: true }> }) {
  const entries = [
    [Crown, "P", data.platinum],
    [Gem, "G", data.gold],
    [Medal, "S", data.silver],
    [Award, "B", data.bronze],
  ] as const;
  return (
    <div className="grid grid-cols-4 gap-2">
      {entries.map(([Icon, label, count]) => (
        <div key={label} className="rounded-2xl bg-subtle p-3 text-center">
          <Icon className="mx-auto size-4 text-accent" />
          <p className="mt-1 text-sm font-semibold tabular-nums">{count.earned}/{count.total}</p>
          <p className="text-[10px] uppercase tracking-wider text-faint">{label}</p>
        </div>
      ))}
    </div>
  );
}

function TrophyCard({ trophy }: { trophy: TrophyRow }) {
  const hidden = Boolean(trophy.trophy_hidden && !trophy.earned);
  const name = hidden ? "Secret Trophy" : trophy.trophy_name || "Unnamed Trophy";
  const detail = hidden ? "???" : trophy.trophy_detail || "";
  const Icon = tierIcon(trophy.trophy_type);
  return (
    <div className={`rounded-3xl bg-elevated p-4 ${trophy.earned ? "" : "opacity-60"}`}>
      <div className="flex gap-3">
        <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-subtle text-accent">
          {trophy.trophy_icon_url ? (
            <img src={trophy.trophy_icon_url} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            <Icon className="size-6" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{name}</p>
              {detail ? <p className="mt-1 text-sm leading-5 text-muted">{detail}</p> : null}
            </div>
            {trophy.earned ? <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">Earned</span> : null}
          </div>
          {trophy.earned_at ? <p className="mt-3 text-xs text-faint">{new Date(trophy.earned_at).toLocaleDateString()}</p> : null}
        </div>
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

  if (isPending || (user && query.isLoading)) {
    return <div className="space-y-4"><Skeleton className="h-48 w-full rounded-3xl" /><Skeleton className="h-24 w-full rounded-3xl" /><Skeleton className="h-96 w-full rounded-3xl" /></div>;
  }
  if (!user) return <RedirectToSignIn />;
  if (query.isError) return <div className="rounded-3xl bg-elevated p-8 text-center"><Trophy className="mx-auto size-9 text-faint" /><p className="mt-3 text-lg font-medium">Couldn’t load trophies</p><p className="mt-1 text-sm text-muted">Try again after signing in.</p></div>;

  const data = query.data;
  if (!data?.found) {
    return (
      <div className="py-16 text-center">
        <Trophy className="mx-auto size-10 text-faint" />
        <h1 className="mt-4 text-xl font-semibold">No synced trophies</h1>
        <p className="mt-1 text-sm text-muted">This game does not have recovered trophy data yet.</p>
        <Link to="/game/$catalogId" params={{ catalogId }} className="mt-5 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg">Open game</Link>
      </div>
    );
  }

  const trophies = sortedTrophies(data.trophies);
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <section className="overflow-hidden rounded-[2rem] bg-elevated">
        <div className="relative h-48 overflow-hidden bg-subtle">
          {data.headerUrl || data.coverUrl ? (
            <img
              src={data.headerUrl || data.coverUrl || undefined}
              alt=""
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-bg/95 via-bg/30 to-transparent" />
        </div>
        <div className="-mt-12 relative px-5 pb-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent">{data.platform}</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{data.titleName}</h1>
              <p className="mt-1 text-sm text-muted">{data.earned}/{data.total} trophies · {data.percentage}%</p>
            </div>
            <Link to="/game/$catalogId" params={{ catalogId }} className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">Open game</Link>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, data.percentage))}%` }} /></div>
          <div className="mt-4"><TierCounts data={data} /></div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">Trophy list</p><h2 className="mt-1 text-xl font-semibold">{data.earned} earned · {data.total - data.earned} remaining</h2></div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trophies.map((trophy) => <TrophyCard key={trophy.trophy_id} trophy={trophy} />)}
        </div>
      </section>
    </div>
  );
}
