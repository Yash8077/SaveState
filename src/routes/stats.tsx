import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLibrary } from "@/hooks/use-library";
import { getActivity, type WebActivityGame } from "@/lib/web-activity";
import { STATUS_LABEL, STATUSES } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/stats")({ component: StatsPage });

function duration(seconds: number): string {
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

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function prettyDay(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function openGame(game: {
  catalogId: string | null;
  titleName: string | null;
}) {
  if (game.catalogId) {
    window.location.href = `/game/${encodeURIComponent(game.catalogId)}`;
    return;
  }
  window.location.href = `/discover?q=${encodeURIComponent(game.titleName ?? "")}`;
}

function ArtCard({
  game,
  rank,
  totalSeconds,
}: {
  game: WebActivityGame;
  rank: number;
  totalSeconds: number;
}) {
  const share =
    totalSeconds > 0
      ? Math.max(0.08, Math.min(1, game.seconds / totalSeconds))
      : 0;

  return (
    <button
      type="button"
      onClick={() => openGame(game)}
      className="group relative aspect-[4/5] min-w-36 overflow-hidden rounded-2xl bg-subtle text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:min-w-40"
    >
      {game.coverUrl ? (
        <img
          src={game.coverUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent/30 to-subtle" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      <div className="absolute left-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
        #{rank}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-white">
          {game.titleName}
        </p>
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/75">
          <span>{duration(game.seconds)}</span>
          <span>{game.sessions} sessions</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${share * 100}%` }}
          />
        </div>
      </div>
    </button>
  );
}

function StatsPage() {
  const { user, isPending } = useCurrentUserState();
  const library = useLibrary();
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const month = monthKey(monthCursor);

  const activity = useQuery({
    queryKey: ["play-history", month],
    queryFn: ({ signal }) => getActivity(signal, month),
    enabled: Boolean(user),
    staleTime: 2 * 60_000,
  });

  useEffect(() => {
    if (!selectedDate || !selectedDate.startsWith(month)) {
      setSelectedDate(
        month === monthKey(new Date())
          ? dateKey(new Date())
          : `${month}-01`,
      );
    }
  }, [month, selectedDate]);

  if (isPending || library.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!user) return <RedirectToSignIn />;

  const data = activity.data;
  const totals = data?.totals ?? {
    seconds: 0,
    sessions: 0,
    games: 0,
    days: 0,
  };

  const games = data?.games ?? [];
  const daily = data?.daily ?? [];

  const byDay = useMemo(() => {
    const map = new Map<
      string,
      { seconds: number; sessions: number; top: WebActivityGame | null }
    >();

    for (const row of daily) {
      const game = games.find((candidate) => candidate.titleId === row.titleId);
      const existing = map.get(row.date) ?? {
        seconds: 0,
        sessions: 0,
        top: null,
      };

      existing.seconds += row.seconds;
      existing.sessions += row.sessions;

      if (!existing.top || row.seconds > existing.top.seconds) {
        existing.top = game
          ? { ...game, seconds: row.seconds }
          : {
              titleId: row.titleId,
              titleName: row.titleName,
              seconds: row.seconds,
              sessions: row.sessions,
              lastPlayed: row.date,
              platform: row.platform,
              libraryGameId: null,
              catalogId: row.catalogId,
              coverUrl: row.coverUrl,
              headerUrl: row.headerUrl,
            };
      }

      map.set(row.date, existing);
    }

    return map;
  }, [daily, games]);

  const selectedRows = selectedDate
    ? daily
        .filter((row) => row.date === selectedDate)
        .sort((a, b) => b.seconds - a.seconds)
    : [];

  const maxDaySeconds = Math.max(
    1,
    ...[...byDay.values()].map((day) => day.seconds),
  );

  const first = new Date(
    monthCursor.getFullYear(),
    monthCursor.getMonth(),
    1,
  );
  const leading = (first.getDay() + 6) % 7;
  const totalDays = new Date(
    monthCursor.getFullYear(),
    monthCursor.getMonth() + 1,
    0,
  ).getDate();

  const libraryEntries = library.data ?? [];
  const beaten = libraryEntries.filter(
    (entry) => entry.status === "beaten",
  ).length;
  const scored = libraryEntries.filter((entry) => entry.score != null);
  const averageScore = scored.length
    ? (
        scored.reduce((sum, entry) => sum + (entry.score ?? 0), 0) /
        scored.length
      ).toFixed(1)
    : "—";

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-faint">
          Play history
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Your gaming life, recorded.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Actual PlayStation sessions now power playtime. Your library no longer
          needs hand-entered hours.
        </p>
      </header>

      <section className="relative overflow-hidden rounded-[2rem] bg-elevated p-5 sm:p-7">
        {games[0]?.headerUrl ? (
          <img
            src={games[0].headerUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full object-cover opacity-25 blur-[1px]"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-elevated via-elevated/90 to-elevated/55" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">
              All-time
            </p>
            <p className="mt-2 text-5xl font-semibold tracking-[-0.04em] text-accent sm:text-6xl">
              {duration(totals.seconds)}
            </p>
            <p className="mt-2 text-sm text-muted">
              across {totals.games} games · {totals.sessions} sessions ·{" "}
              {totals.days} active days
            </p>
          </div>

          {games[0] ? (
            <button
              type="button"
              onClick={() => openGame(games[0])}
              className="group flex items-center gap-3 rounded-2xl bg-black/20 p-2 text-left backdrop-blur-sm"
            >
              {games[0].coverUrl ? (
                <img
                  src={games[0].coverUrl}
                  alt=""
                  className="h-20 w-14 rounded-xl object-cover shadow-lg"
                />
              ) : null}
              <div className="pr-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">
                  Most played
                </p>
                <p className="mt-1 max-w-44 text-sm font-semibold text-white">
                  {games[0].titleName}
                </p>
                <p className="mt-1 text-xs text-white/65">
                  {duration(games[0].seconds)}
                </p>
              </div>
            </button>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">
              Your rotation
            </p>
            <h2 className="mt-1 text-lg font-medium">Most played</h2>
          </div>
        </div>

        {games.length ? (
          <div className="rail-scroll gap-3">
            {games.slice(0, 8).map((game, index) => (
              <ArtCard
                key={game.titleId}
                game={game}
                rank={index + 1}
                totalSeconds={totals.seconds}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-subtle p-8 text-center text-sm text-muted">
            Run the SaveState PS5 activity logger after a session to build this
            timeline.
          </div>
        )}
      </section>

      <section className="rounded-[2rem] bg-elevated p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">
              Timeline
            </p>
            <h2 className="mt-1 text-xl font-medium">{monthLabel(monthCursor)}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setMonthCursor(
                  new Date(
                    monthCursor.getFullYear(),
                    monthCursor.getMonth() - 1,
                    1,
                  ),
                )
              }
              className="grid size-10 place-items-center rounded-full bg-subtle text-lg text-muted transition hover:bg-border hover:text-fg"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                setMonthCursor(
                  new Date(
                    monthCursor.getFullYear(),
                    monthCursor.getMonth() + 1,
                    1,
                  ),
                )
              }
              className="grid size-10 place-items-center rounded-full bg-subtle text-lg text-muted transition hover:bg-border hover:text-fg"
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <div
              key={`${day}-${index}`}
              className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-faint"
            >
              {day}
            </div>
          ))}

          {Array.from({ length: leading }).map((_, index) => (
            <div key={`empty-${index}`} />
          ))}

          {Array.from({ length: totalDays }, (_, index) => {
            const day = index + 1;
            const date = `${month}-${String(day).padStart(2, "0")}`;
            const info = byDay.get(date);
            const intensity = info
              ? Math.max(0.18, Math.min(1, info.seconds / maxDaySeconds))
              : 0;
            const selected = selectedDate === date;

            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={[
                  "group relative aspect-square overflow-hidden rounded-xl border bg-subtle text-left transition sm:rounded-2xl",
                  selected
                    ? "border-accent ring-2 ring-accent/30"
                    : "border-transparent hover:border-border",
                ].join(" ")}
              >
                {info?.top?.coverUrl ? (
                  <img
                    src={info.top.coverUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 size-full object-cover"
                    style={{ opacity: 0.12 + intensity * 0.72 }}
                  />
                ) : null}
                <div
                  className="absolute inset-x-0 bottom-0 h-1 bg-accent"
                  style={{ opacity: info ? intensity : 0.08 }}
                />
                <div className="relative flex h-full flex-col justify-between p-2 sm:p-2.5">
                  <span
                    className={[
                      "text-xs font-semibold",
                      selected ? "text-accent" : "text-fg",
                    ].join(" ")}
                  >
                    {day}
                  </span>
                  {info ? (
                    <span className="text-[10px] font-medium text-muted">
                      {duration(info.seconds)}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] bg-elevated p-4 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">
            Selected day
          </p>
          <h2 className="mt-1 text-xl font-medium">
            {selectedDate ? prettyDay(selectedDate) : "Pick a day"}
          </h2>

          <div className="mt-5 space-y-2">
            {selectedRows.length ? (
              selectedRows.map((row) => (
                <button
                  key={`${row.date}-${row.titleId}`}
                  type="button"
                  onClick={() => openGame(row)}
                  className="group flex w-full items-center gap-3 rounded-2xl bg-subtle p-2 text-left transition hover:bg-border"
                >
                  {row.coverUrl ? (
                    <img
                      src={row.coverUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="size-14 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="size-14 rounded-xl bg-accent/10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {row.titleName}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {row.sessions} session{row.sessions === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{duration(row.seconds)}</p>
                    <p className="mt-1 text-[10px] text-accent">Open game →</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl bg-subtle p-8 text-center">
                <p className="text-sm font-medium">No tracked play</p>
                <p className="mt-1 text-xs text-muted">
                  There are no imported game sessions for this date.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] bg-elevated p-4 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">
            Library
          </p>
          <h2 className="mt-1 text-xl font-medium">Your collection</h2>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Metric label="Games" value={String(libraryEntries.length)} />
            <Metric label="Beaten" value={String(beaten)} />
            <Metric label="Avg. score" value={averageScore} />
            <Metric
              label="Tracked playtime"
              value={duration(totals.seconds)}
            />
          </div>

          <p className="mt-5 text-xs leading-5 text-faint">
            Playtime shown by SaveState is imported from PlayStation activity.
            Manual hour estimates are no longer used for these stats.
          </p>
        </section>
      </section>

      {activity.error ? (
        <p className="text-center text-xs text-muted">
          Activity data is temporarily unavailable.
        </p>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-subtle p-4">
      <p className="text-[11px] uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
