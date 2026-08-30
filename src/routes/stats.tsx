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
import { STATUS_LABEL, STATUSES } from "@/lib/types";
import { formatHours } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/stats")({ component: StatsPage });

function StatsPage() {
  const { user, isPending } = useCurrentUserState();
  const library = useLibrary();

  if (isPending || library.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  const entries = library.data ?? [];
  const hours = entries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
  const scored = entries.filter((e) => e.score != null);
  const avg =
    scored.length > 0
      ? scored.reduce((sum, e) => sum + (e.score ?? 0), 0) / scored.length
      : 0;
  const beatenThisYear = entries.filter((e) => {
    if (e.status !== "beaten" || !e.finishedAt) return false;
    return e.finishedAt.startsWith(String(new Date().getFullYear()));
  }).length;

  const byStatus = STATUSES.map((status) => ({
    name: STATUS_LABEL[status],
    count: entries.filter((e) => e.status === status).length,
  }));

  const genreCounts = new Map<string, number>();
  for (const e of entries) {
    for (const g of e.genres) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const scoreBars = Array.from({ length: 10 }, (_, i) => ({
    name: String(i + 1),
    count: entries.filter((e) => e.score === i + 1).length,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 min-[600px]:grid-cols-4">
        <Stat label="Logged" value={String(entries.length)} />
        <Stat label="Hours" value={formatHours(hours)} />
        <Stat label="Average score" value={scored.length ? avg.toFixed(1) : "—"} />
        <Stat label="Beaten this year" value={String(beatenThisYear)} />
      </div>

      <ChartCard title="By status">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byStatus} barCategoryGap={12}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--color-faint)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--color-faint)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: "color-mix(in oklab, var(--color-fg) 4%, transparent)" }}
              contentStyle={tooltipStyle}
            />
            <Bar dataKey="count" fill="var(--color-accent)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {scored.length > 0 ? (
        <ChartCard title="Score spread">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreBars} barCategoryGap={8}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--color-faint)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--color-faint)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "color-mix(in oklab, var(--color-fg) 4%, transparent)" }}
                contentStyle={tooltipStyle}
              />
              <Bar dataKey="count" fill="var(--color-accent)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}

      {topGenres.length > 0 ? (
        <ChartCard title="Genres">
          <ul className="space-y-2">
            {topGenres.map((g) => (
              <li
                key={g.name}
                className="flex items-center justify-between text-sm"
              >
                <span>{g.name}</span>
                <span className="tabular-nums text-muted">{g.count}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : null}
    </div>
  );
}

const tooltipStyle = {
  background: "var(--color-elevated)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  color: "var(--color-fg)",
  fontSize: 12,
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-elevated px-4 py-3">
      <p className="text-xs text-faint">{label}</p>
      <p className="mt-1 text-2xl font-medium tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-elevated p-4 sm:p-5">
      <h2 className="mb-4 text-base font-medium">{title}</h2>
      {children}
    </section>
  );
}
