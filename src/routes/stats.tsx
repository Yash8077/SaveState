import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLibrary } from "@/hooks/use-library";
import { getActivity } from "@/lib/web-activity";
import { STATUS_LABEL, STATUSES } from "@/lib/types";
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

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function dayLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function StatsPage() {
  const { user, isPending } = useCurrentUserState();
  const library = useLibrary();
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const month = monthKey(monthCursor);
  const activity = useQuery({
    queryKey: ["ps5-activity", 200, month],
    queryFn: ({ signal }) => getActivity(signal, month),
    enabled: Boolean(user),
    staleTime: 2 * 60_000,
  });

  useEffect(() => {
    if (!selectedDate || !selectedDate.startsWith(month)) {
      setSelectedDate(month === monthKey(new Date()) ? new Date().toISOString().slice(0, 10) : `${month}-01`);
    }
  }, [month, selectedDate]);

  if (isPending || library.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  const entries = library.data ?? [];
  const scored = entries.filter((e) => e.score != null);
  const avg = scored.length
    ? scored.reduce((sum, e) => sum + (e.score ?? 0), 0) / scored.length
    : 0;
  const beatenThisYear = entries.filter(
    (e) =>
      e.status === "beaten" &&
      e.finishedAt?.startsWith(String(new Date().getFullYear())),
  ).length;
  const byStatus = STATUSES.map((status) => ({
    name: STATUS_LABEL[status],
    count: entries.filter((e) => e.status === status).length,
  }));

  const data = activity.data;
  const totals = data?.totals ?? { seconds: 0, sessions: 0, games: 0, days: 0 };
  const daily = data?.daily ?? [];

  const days = new Map<string, { seconds: number; games: number; sessions: number }>();
  for (const row of daily) {
    const current = days.get(row.date) ?? { seconds: 0, games: 0, sessions: 0 };
    current.seconds += row.seconds;
    current.games += 1;
    current.sessions += row.sessions;
    days.set(row.date, current);
  }

  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const leading = (first.getDay() + 6) % 7;
  const totalDays = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();

  const selectedRows = selectedDate
    ? daily.filter((row) => row.date === selectedDate).sort((a, b) => b.seconds - a.seconds)
    : [];

  const topGames = data?.games?.slice(0, 6) ?? [];

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">Your play history</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Stats & activity</h1>
        <p className="max-w-2xl text-sm text-muted">
          SaveState now derives playtime from your PlayStation activity logs, so there is no need to maintain game hours manually.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Play time" value={formatActivityTime(totals.seconds)} emphasis />
        <Stat label="Games played" value={String(totals.games)} />
        <Stat label="Sessions" value={String(totals.sessions)} />
        <Stat label="Days active" value={String(totals.days)} />
      </section>

      <section className="rounded-2xl bg-elevated p-4 sm:p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-faint">Activity calendar</p>
            <h2 className="mt-1 text-lg font-medium">{monthLabel(monthCursor)}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-full bg-subtle text-muted transition hover:bg-border hover:text-fg"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-full bg-subtle text-muted transition hover:bg-border hover:text-fg"
            >
              ›
            </button>
          </div>
        </div>

        {activity.isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : activity.error ? (
          <p className="py-16 text-center text-sm text-muted">PS5 activity is temporarily unavailable.</p>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="pb-1 text-center text-[10px] font-medium uppercase tracking-wider text-faint">
                {day}
              </div>
            ))}
            {Array.from({ length: leading }).map((_, index) => <div key={`blank-${index}`} />)}
            {Array.from({ length: totalDays }, (_, index) => {
              const day = index + 1;
              const date = `${month}-${String(day).padStart(2, "0")}`;
              const detail = days.get(date);
              const isSelected = selectedDate === date;
              const intensity = detail ? Math.min(1, Math.max(0.14, detail.seconds / Math.max(1, ...[...days.values()].map((d) => d.seconds)))) : 0;
              return (
                <button
                  type="button"
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={[
                    "group relative min-h-16 rounded-xl border p-2 text-left transition sm:min-h-20",
                    isSelected ? "border-accent bg-accent/10 ring-1 ring-accent/40" : "border-transparent bg-subtle hover:border-border hover:bg-elevated",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className={isSelected ? "text-sm font-semibold text-accent" : "text-sm font-medium"}>{day}</span>
                    {detail ? <span className="text-[10px] tabular-nums text-muted">{Math.round(detail.seconds / 60)}m</span> : null}
                  </div>
                  {detail ? (
                    <div className="mt-3 flex items-end gap-1">
                      {Array.from({ length: Math.min(5, Math.max(1, Math.ceil(intensity * 5))) }).map((_, bar) => (
                        <span key={bar} className="h-1 flex-1 rounded-full bg-accent" />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 h-1 rounded-full bg-border/60" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2 text-[11px] text-faint">
          <span>Less</span>
          {[1, 2, 3, 4].map((level) => (
            <span key={level} className="h-2.5 w-2.5 rounded-sm bg-accent" style={{ opacity: level / 4 }} />
          ))}
          <span>More</span>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl bg-elevated p-4 sm:p-5">
          <div className="mb-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-faint">Day detail</p>
            <h2 className="mt-1 text-lg font-medium">{selectedDate ? dayLabel(selectedDate) : "Select a day"}</h2>
          </div>

          {selectedRows.length ? (
            <div className="space-y-2">
              {selectedRows.map((row) => {
                const ratio = totals.seconds > 0 ? Math.max(0.03, row.seconds / totals.seconds) : 0;
                return (
                  <div key={`${row.date}-${row.titleId}`} className="rounded-xl bg-subtle p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium">{row.titleName}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatActivityTime(row.seconds)}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                    </div>
                    <p className="mt-2 text-[11px] text-faint">{row.sessions} session{row.sessions === 1 ? "" : "s"}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center rounded-xl bg-subtle px-6 text-center">
              <div>
                <p className="text-sm font-medium">No tracked play on this day</p>
                <p className="mt-1 text-xs text-muted">Pick another date to see the games and time recorded.</p>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-elevated p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-faint">Most played</p>
          <h2 className="mt-1 text-lg font-medium">Your games</h2>
          <div className="mt-5 space-y-3">
            {topGames.map((game, index) => (
              <div key={game.titleId} className="flex items-center gap-3">
                <span className="w-5 text-xs tabular-nums text-faint">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{game.titleName}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">{formatActivityTime(game.seconds)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${totals.seconds ? Math.max(4, (game.seconds / totals.seconds) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {!topGames.length && (
              <p className="py-8 text-center text-sm text-muted">Run the PS5 activity logger to start building your play history.</p>
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-4 sm:grid-cols-4">
        <Stat label="Library games" value={String(entries.length)} />
        <Stat label="Beaten this year" value={String(beatenThisYear)} />
        <Stat label="Average score" value={scored.length ? avg.toFixed(1) : "—"} />
        <Stat label="Playing" value={String(byStatus.find((x) => x.name === STATUS_LABEL.playing)?.count ?? 0)} />
      </section>

      {!data?.games?.length && !activity.isLoading ? (
        <section className="rounded-2xl border border-dashed border-border bg-subtle p-6 text-center">
          <p className="text-sm font-medium">Your PS5 timeline is ready</p>
          <p className="mt-1 text-sm text-muted">
            Run the SaveState activity logger after you finish a session. SaveState will import the session automatically.
          </p>
        </section>
      ) : null}
    </div>
  );
}


function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-elevated px-4 py-4">
      <p className="text-xs text-faint">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${emphasis ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}
