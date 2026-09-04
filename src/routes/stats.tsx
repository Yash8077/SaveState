import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLibrary } from "@/hooks/use-library";
import { getActivity, type WebActivity, type WebActivityGame } from "@/lib/web-activity";
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

// Calendar cells intentionally use a compact duration. Exact hour-plus
// values are shown in the selected-day panel instead of being squeezed into
// the small cell.
function calendarDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h+`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function prettyDay(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function openGame(game: { catalogId: string | null; titleName: string | null }) {
  const id = game.catalogId;
  window.location.href = id
    ? `/game/${encodeURIComponent(id)}`
    : `/discover?q=${encodeURIComponent(game.titleName ?? "")}`;
}

function ArtCard({ game, rank }: { game: WebActivityGame; rank: number }) {
  return (
    <button
      type="button"
      onClick={() => openGame(game)}
      className="group relative aspect-[4/5] min-w-36 overflow-hidden rounded-2xl bg-subtle text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:min-w-40"
    >
      {game.coverUrl ? <img src={game.coverUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-gradient-to-br from-accent/30 to-subtle" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      <div className="absolute left-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">#{rank}</div>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-white">{game.titleName}</p>
        <div className="mt-2 flex items-center justify-between text-xs text-white/80"><span className="font-semibold">{duration(game.seconds)}</span><span>{game.sessions} sessions</span></div>
      </div>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-subtle p-4"><p className="text-[11px] uppercase tracking-wider text-faint">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>;
}

function Calendar({
  monthCursor,
  month,
  byDay,
  selectedDate,
  onSelect,
}: {
  monthCursor: Date;
  month: string;
  byDay: Map<string, { seconds: number; sessions: number; top: WebActivityGame | null }>;
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const leading = (first.getDay() + 6) % 7;
  const totalDays = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  const maxSeconds = Math.max(1, ...[...byDay.values()].map((v) => v.seconds));

  return (
    <div>
      <div className="mb-3 grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-faint">
        {['M','T','W','T','F','S','S'].map((d, i) => <div key={`${d}-${i}`}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: leading }).map((_, i) => <div key={`empty-${i}`} aria-hidden="true" />)}
        {Array.from({ length: totalDays }, (_, i) => {
          const day = i + 1;
          const key = `${month}-${String(day).padStart(2, '0')}`;
          const info = byDay.get(key);
          const intensity = info ? Math.max(0.12, Math.min(1, info.seconds / maxSeconds)) : 0;
          const selected = selectedDate === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-label={`${prettyDay(key)}${info ? `, ${duration(info.seconds)} played` : ''}`}
              className={`group relative min-h-12 overflow-hidden rounded-xl border px-2 py-1.5 text-left transition sm:min-h-14 sm:rounded-2xl ${selected ? 'border-2 border-accent' : 'border border-transparent hover:border-border'}`}
            >
              {info?.top?.coverUrl ? <img src={info.top.coverUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" style={{ opacity: 0.10 + intensity * 0.66 }} /> : null}
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" style={{ opacity: info ? intensity : 0.05 }} />
              <div className="relative flex h-full min-h-9 flex-col justify-between">
                <span className={`text-xs font-semibold ${selected ? 'text-accent' : 'text-fg'}`}>{day}</span>
                {info ? <span className="truncate text-[9px] font-medium text-muted sm:text-[10px]">{calendarDuration(info.seconds)}</span> : <span className="text-[9px] text-faint">·</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayGames({ rows, selectedDate, loading }: { rows: WebActivity['daily']; selectedDate: string; loading: boolean }) {
  const selectedRows = rows.filter((row) => row.date === selectedDate).sort((a, b) => b.seconds - a.seconds);
  const total = selectedRows.reduce((sum, row) => sum + row.seconds, 0);
  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">Selected day</p>
          <h3 className="mt-1 text-lg font-semibold">{prettyDay(selectedDate)}</h3>
        </div>
        <p className="shrink-0 text-xs text-muted">{selectedRows.length ? duration(total) : 'No play'}</p>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="flex h-16 items-center gap-3 rounded-2xl bg-subtle px-3"><Skeleton className="size-10 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-2.5 w-1/3" /></div></div>)}
        </div>
      ) : (
      <div className="min-h-0 space-y-2 overflow-y-auto pr-1 lg:max-h-[320px]">
        {selectedRows.length ? selectedRows.map((row) => (
          <button key={`${row.date}-${row.titleId}`} type="button" onClick={() => openGame(row)} className="group flex w-full items-center gap-3 rounded-2xl bg-subtle p-2.5 text-left transition hover:bg-border">
            {row.coverUrl ? <img src={row.coverUrl} alt="" referrerPolicy="no-referrer" className="size-12 shrink-0 rounded-xl object-cover" /> : <div className="size-12 shrink-0 rounded-xl bg-accent/10" />}
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{row.titleName}</p><p className="mt-1 text-[11px] text-muted">{row.sessions} session{row.sessions === 1 ? '' : 's'}</p></div>
            <div className="shrink-0 text-right"><p className="text-sm font-semibold">{duration(row.seconds)}</p><p className="mt-1 text-[10px] font-medium text-accent">Open →</p></div>
          </button>
        )) : <div className="rounded-2xl bg-subtle p-6 text-center"><p className="text-sm font-medium">Nothing tracked</p><p className="mt-1 text-xs text-muted">Pick a day with activity to see the games you played.</p></div>}
      </div>
      )}
    </div>
  );
}

function Timeline({ monthCursor, setMonthCursor, month, byDay, selectedDate, setSelectedDate, daily, loading }: {
  monthCursor: Date; setMonthCursor: (date: Date) => void; month: string;
  byDay: Map<string, { seconds: number; sessions: number; top: WebActivityGame | null }>;
  selectedDate: string; setSelectedDate: (date: string) => void; daily: WebActivity['daily']; loading: boolean;
}) {
  return (
    <section className="rounded-[2rem] bg-elevated p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">Timeline</p><h2 className="mt-1 text-xl font-semibold">{monthLabel(monthCursor)}</h2></div>
        <div className="flex items-center gap-2">
          {loading ? <span className="size-2 animate-pulse rounded-full bg-accent" aria-label="Updating month" /> : null}
          <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Previous month" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} className="grid size-9 place-items-center rounded-full bg-subtle text-lg text-muted transition hover:bg-border hover:text-fg">‹</button>
          <button type="button" aria-label="Next month" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} className="grid size-9 place-items-center rounded-full bg-subtle text-lg text-muted transition hover:bg-border hover:text-fg">›</button>
          </div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)] lg:items-stretch">
        <div className="rounded-3xl bg-subtle/70 p-3 sm:p-4"><Calendar monthCursor={monthCursor} month={month} byDay={byDay} selectedDate={selectedDate} onSelect={setSelectedDate} /></div>
        <div className="rounded-3xl bg-subtle/45 p-4 sm:p-5"><DayGames rows={daily} selectedDate={selectedDate} loading={loading} /></div>
      </div>
    </section>
  );
}

function StatsPage() {
  const { user, isPending } = useCurrentUserState();
  const library = useLibrary();
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => dateKey(new Date()));
  const month = monthKey(monthCursor);
  const summaryActivity = useQuery({ queryKey: ["play-history-summary"], queryFn: ({ signal }) => getActivity(signal), enabled: Boolean(user), staleTime: 2 * 60_000 });
  const monthActivity = useQuery({ queryKey: ["play-history-month", month], queryFn: ({ signal }) => getActivity(signal, month), enabled: Boolean(user), staleTime: 2 * 60_000 });

  useEffect(() => {
    if (!selectedDate.startsWith(month)) setSelectedDate(month === monthKey(new Date()) ? dateKey(new Date()) : `${month}-01`);
  }, [month, selectedDate]);

  if (isPending || library.isLoading || summaryActivity.isPending) return <div className="space-y-5"><Skeleton className="h-48 w-full rounded-3xl" /><Skeleton className="h-52 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (!user) return <RedirectToSignIn />;

  const summary = summaryActivity.data;
  const monthly = monthActivity.data;
  const totals = summary?.totals ?? { seconds: 0, sessions: 0, games: 0, days: 0 };
  const games = summary?.games ?? [];
  const daily = monthly?.daily ?? [];
  const byDay = new Map<string, { seconds: number; sessions: number; top: WebActivityGame | null }>();
  const gameMap = new Map(games.map((game) => [game.titleId, game]));
  for (const row of daily) {
    const existing = byDay.get(row.date) ?? { seconds: 0, sessions: 0, top: null };
    existing.seconds += row.seconds;
    existing.sessions += row.sessions;
    const game = gameMap.get(row.titleId);
    if (!existing.top || row.seconds > existing.top.seconds) {
      existing.top = game ? { ...game, seconds: row.seconds } : {
        titleId: row.titleId, titleName: row.titleName, seconds: row.seconds, sessions: row.sessions,
        lastPlayed: row.date, platform: row.platform, libraryGameId: null, catalogId: row.catalogId,
        coverUrl: row.coverUrl, headerUrl: row.headerUrl,
      };
    }
    byDay.set(row.date, existing);
  }
  const libraryEntries = library.data ?? [];
  const beaten = libraryEntries.filter((entry) => entry.status === 'beaten').length;
  const scored = libraryEntries.filter((entry) => entry.score != null);
  const averageScore = scored.length ? (scored.reduce((sum, entry) => sum + (entry.score ?? 0), 0) / scored.length).toFixed(1) : '—';

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-12">
      <header><p className="text-xs font-medium uppercase tracking-[0.2em] text-faint">Play history</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your gaming life, recorded.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Actual PlayStation sessions power your playtime, dates, and activity timeline.</p></header>
      <section className="relative overflow-hidden rounded-[2rem] bg-elevated p-5 sm:p-7">
        {games[0]?.headerUrl ? <img src={games[0].headerUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover opacity-20 blur-[1px]" /> : null}
        <div className="absolute inset-0 bg-gradient-to-r from-elevated via-elevated/90 to-elevated/55" />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">All-time</p><p className="mt-2 text-5xl font-semibold tracking-[-0.04em] text-accent sm:text-6xl">{duration(totals.seconds)}</p><p className="mt-2 text-sm text-muted">{totals.games} games · {totals.sessions} sessions · {totals.days} active days</p></div>{games[0] ? <button type="button" onClick={() => openGame(games[0])} className="group flex items-center gap-3 rounded-2xl bg-black/20 p-2 text-left backdrop-blur-sm">{games[0].coverUrl ? <img src={games[0].coverUrl} alt="" className="h-20 w-14 rounded-xl object-cover shadow-lg" /> : null}<div className="pr-3"><p className="text-[10px] uppercase tracking-[0.16em] text-white/60">Most played</p><p className="mt-1 max-w-44 text-sm font-semibold text-white">{games[0].titleName}</p><p className="mt-1 text-xs text-white/65">{duration(games[0].seconds)}</p></div></button> : null}</div>
      </section>
      <section><div className="mb-3"><p className="text-xs font-medium uppercase tracking-[0.18em] text-faint">Your rotation</p><h2 className="mt-1 text-lg font-medium">Most played</h2></div>{games.length ? <div className="rail-scroll gap-3">{games.slice(0, 8).map((game, index) => <ArtCard key={game.titleId} game={game} rank={index + 1} />)}</div> : <div className="rounded-2xl bg-subtle p-8 text-center text-sm text-muted">Run the SaveState PS5 activity logger after a session to build this timeline.</div>}</section>
      <Timeline monthCursor={monthCursor} setMonthCursor={setMonthCursor} month={month} byDay={byDay} selectedDate={selectedDate} setSelectedDate={setSelectedDate} daily={daily} loading={monthActivity.isFetching} />
      <section className="grid gap-4 sm:grid-cols-4"><Metric label="Games" value={String(libraryEntries.length)} /><Metric label="Beaten" value={String(beaten)} /><Metric label="Avg. score" value={averageScore} /><Metric label="Tracked playtime" value={duration(totals.seconds)} /></section>
      {summaryActivity.error ? <p className="text-center text-xs text-muted">Activity summary is temporarily unavailable.</p> : null}
      {monthActivity.error ? <p className="text-center text-xs text-muted">This month's calendar data is temporarily unavailable.</p> : null}
    </div>
  );
}
