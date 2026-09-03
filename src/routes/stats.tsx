import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLibrary } from "@/hooks/use-library";
import { getActivity } from "@/lib/web-activity";
import { STATUS_LABEL, STATUSES } from "@/lib/types";
import { formatHours } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/stats")({ component: StatsPage });

function formatActivityTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function StatsPage() {
  const { user, isPending } = useCurrentUserState();
  const library = useLibrary();
  const activity = useQuery({
    queryKey: ["ps5-activity", 100],
    queryFn: ({ signal }) => getActivity(signal),
    enabled: Boolean(user),
    staleTime: 2 * 60_000,
  });

  if (isPending || library.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-40 w-full" /></div>;
  }
  if (!user) return <RedirectToSignIn />;

  const entries = library.data ?? [];
  const hours = entries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
  const scored = entries.filter((e) => e.score != null);
  const avg = scored.length ? scored.reduce((sum, e) => sum + (e.score ?? 0), 0) / scored.length : 0;
  const beatenThisYear = entries.filter((e) => e.status === "beaten" && e.finishedAt?.startsWith(String(new Date().getFullYear()))).length;
  const byStatus = STATUSES.map((status) => ({ name: STATUS_LABEL[status], count: entries.filter((e) => e.status === status).length }));
  const genreCounts = new Map<string, number>();
  for (const e of entries) for (const g of e.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
  const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  const scoreBars = Array.from({ length: 10 }, (_, i) => ({ name: String(i + 1), count: entries.filter((e) => e.score === i + 1).length }));

  const activityData = activity.data ?? null;
  const totals = activityData?.totals ?? { seconds: 0, sessions: 0, games: 0, days: 0 };
  const topActivity = activityData?.games?.slice(0, 5) ?? [];
  const daily = activityData?.daily ?? [];
  const dailyByDate = new Map<string, number>();
  for (const row of daily) {
    dailyByDate.set(row.date, (dailyByDate.get(row.date) ?? 0) + row.seconds);
  }
  const dailyChart = [...dailyByDate.entries()]
    .map(([date, seconds]) => ({ date, minutes: Math.round(seconds / 60) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 min-[600px]:grid-cols-4">
        <Stat label="Logged" value={String(entries.length)} />
        <Stat label="Hours" value={formatHours(hours)} />
        <Stat label="Average score" value={scored.length ? avg.toFixed(1) : "—"} />
        <Stat label="Beaten this year" value={String(beatenThisYear)} />
      </div>

      <ChartCard title="PS5 Game Activity">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="Play time" value={formatActivityTime(totals.seconds)} />
          <MiniStat label="Games" value={String(totals.games)} />
          <MiniStat label="Sessions" value={String(totals.sessions)} />
          <MiniStat label="Days played" value={String(totals.days)} />
        </div>
        {activity.isLoading ? <p className="mt-4 text-sm text-muted">Loading PS5 activity…</p> : null}
        {activity.error ? <p className="mt-4 text-sm text-muted">PS5 activity is temporarily unavailable.</p> : null}
        {!activity.isLoading && !activity.error && !topActivity.length ? (
          <p className="mt-4 text-sm text-muted">Run the PS5 activity payload to start building your play history.</p>
        ) : null}
        {topActivity.length ? (
          <div className="mt-5 space-y-3">
            {topActivity.map((game) => {
              const share = totals.seconds > 0 ? Math.max(0.02, game.seconds / totals.seconds) : 0;
              return (
                <div key={game.titleId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{game.titleName}</span>
                    <span className="shrink-0 tabular-nums text-muted">{formatActivityTime(game.seconds)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-subtle">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, share * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </ChartCard>

      {dailyChart.length ? (
        <ChartCard title="PS5 play time">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyChart} barCategoryGap={6}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "var(--color-faint)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--color-faint)", fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}m`, "Play time"]} />
              <Bar dataKey="minutes" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}

      <ChartCard title="By status">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byStatus} barCategoryGap={12}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--color-faint)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--color-faint)", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
            <Tooltip cursor={{ fill: "color-mix(in oklab, var(--color-fg) 4%, transparent)" }} contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="var(--color-accent)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {scored.length > 0 ? (
        <ChartCard title="Score spread">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreBars} barCategoryGap={8}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--color-faint)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--color-faint)", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip cursor={{ fill: "color-mix(in oklab, var(--color-fg) 4%, transparent)" }} contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--color-accent)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}

      {topGenres.length > 0 ? (
        <ChartCard title="Genres">
          <ul className="space-y-2">
            {topGenres.map((g) => <li key={g.name} className="flex items-center justify-between text-sm"><span>{g.name}</span><span className="tabular-nums text-muted">{g.count}</span></li>)}
          </ul>
        </ChartCard>
      ) : null}
    </div>
  );
}

const tooltipStyle = { background: "var(--color-elevated)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-fg)", fontSize: 12 };

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-elevated px-4 py-3"><p className="text-xs text-faint">{label}</p><p className="mt-1 text-2xl font-medium tabular-nums tracking-tight">{value}</p></div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-subtle px-3 py-3"><p className="text-[11px] text-faint">{label}</p><p className="mt-1 text-lg font-medium tabular-nums tracking-tight">{value}</p></div>;
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl bg-elevated p-4 sm:p-5"><h2 className="mb-4 text-base font-medium">{title}</h2>{children}</section>;
}
