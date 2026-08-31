import { useEffect, useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAppearance } from "@/components/appearance-provider";
import { AccountMenu } from "@/components/account-menu";
import { GameCard, GameRail } from "@/components/game-card";
import { useHomeLayout } from "@/components/home-layout-provider";
import { useLibrary } from "@/hooks/use-library";
import { useMounted } from "@/hooks/use-mounted";
import { getBecauseRail, getFeaturedRails, BECAUSE_STALE_MS, FEATURED_REL, FEATURED_STALE_MS } from "@/lib/api";
import { pickBecauseSeeds, sortWishlist } from "@/lib/because";
import { FEATURED_SEED } from "@/lib/catalog-seed";
import { mergeHomeLayout, type HomeSectionPref } from "@/lib/home-layout";
import { tintForCatalog } from "@/lib/tints";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatHours } from "@/lib/utils";
import type { FeaturedRail, GameEntry } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const mounted = useMounted();
  const { user } = useCurrentUserState();
  const library = useLibrary();
  const { appearance, setDynamicAccent } = useAppearance();
  const layout = useHomeLayout();
  const sections = useMemo(
    () => mergeHomeLayout(layout.homeSections),
    [layout.homeSections],
  );
  const wantPlaystation = sections.some(
    (row) => row.id === "playstation" && row.enabled,
  );
  const featured = useQuery({
    queryKey: ["featured", FEATURED_REL],
    queryFn: ({ signal }) => getFeaturedRails(signal),
    staleTime: FEATURED_STALE_MS,
    gcTime: FEATURED_STALE_MS,
    placeholderData: wantPlaystation ? FEATURED_SEED : [],
    enabled: mounted && wantPlaystation,
  });

  const rails = featured.data ?? (wantPlaystation ? FEATURED_SEED : []);
  const entries = library.data ?? [];
  const playing = entries.filter((e) => e.status === "playing");
  const backlog = entries.filter((e) => e.status === "backlog");
  const beaten = entries.filter((e) => e.status === "beaten");
  const favorites = entries.filter((e) => e.favorite);
  const wishlist = sortWishlist(entries.filter((e) => e.status === "wishlist"));
  const hours = entries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
  const signedIn = mounted && Boolean(user);
  const name =
    user?.displayName?.trim().split(/\s+/)[0] ||
    user?.primaryEmail?.split("@")[0];
  const seeds = useMemo(
    () =>
      pickBecauseSeeds(
        entries.map((e) => ({
          catalogId: e.catalogId,
          title: e.title,
          favorite: e.favorite,
          status: e.status,
          score: e.score,
          updatedAt: e.updatedAt,
        })),
      ),
    [entries],
  );
  const wantRecommended =
    signedIn &&
    sections.some((row) => row.id === "recommended" && row.enabled) &&
    seeds.length >= 2;
  const because = useQuery({
    queryKey: ["because", seeds.map((s) => s.catalogId).join(",")],
    queryFn: ({ signal }) =>
      getBecauseRail(
        seeds.map((s) => s.catalogId),
        signal,
      ),
    staleTime: BECAUSE_STALE_MS,
    gcTime: BECAUSE_STALE_MS,
    enabled: wantRecommended,
  });
  const owned = useMemo(
    () => new Set(entries.map((e) => e.catalogId)),
    [entries],
  );
  const recommendedGames = (because.data?.games ?? []).filter(
    (g) => !owned.has(g.id),
  );
  const tintSource =
    playing[0]?.catalogId ?? rails.find((r) => r.id === "playstation")?.games[0]?.id;

  useEffect(() => {
    if (!appearance.dynamic) return;
    if (!tintSource) return;
    setDynamicAccent(tintForCatalog(tintSource));
  }, [appearance.dynamic, tintSource, setDynamicAccent]);

  const railsById = new Map(rails.map((rail) => [rail.id, rail]));

  return (
    <div className="page-in space-y-7">
      <HomeHello name={name} />
      {mounted && !signedIn ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-elevated px-4 py-3">
          <p className="text-sm text-muted">
            Sign in to keep playing, backlog, and wishlist in sync.
          </p>
          <Link
            to="/login"
            className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-fg"
          >
            Sign in
          </Link>
        </div>
      ) : null}
      {sections.map((section) =>
        renderHomeSection(section, {
          signedIn,
          mounted,
          hours,
          playing,
          backlog,
          beaten,
          favorites,
          wishlist,
          recommendedTitle: because.data?.title ?? "Recommended",
          recommendedGames,
          railsById,
        }),
      )}
      {signedIn &&
      !library.isLoading &&
      entries.length === 0 &&
      sections.some(
        (row) => row.enabled && (row.id === "playing" || row.id === "backlog"),
      ) ? (
        <div className="rounded-xl bg-elevated px-4 py-8 text-center">
          <p className="text-lg font-medium">Library is empty</p>
          <p className="mt-1 text-sm text-muted">
            Search Discover and add something you are playing.
          </p>
          <Link
            to="/discover"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg"
          >
            Discover games
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function renderHomeSection(
  section: HomeSectionPref,
  ctx: {
    signedIn: boolean;
    mounted: boolean;
    hours: number;
    playing: GameEntry[];
    backlog: GameEntry[];
    beaten: GameEntry[];
    favorites: GameEntry[];
    wishlist: GameEntry[];
    recommendedTitle: string;
    recommendedGames: FeaturedRail["games"];
    railsById: Map<string, FeaturedRail>;
  },
) {
  if (!section.enabled) return null;
  switch (section.id) {
    case "stats":
      if (!ctx.signedIn) return null;
      return (
        <div key="stats">
          {ctx.hours > 0 ? (
            <p className="mb-2 text-sm text-muted">{formatHours(ctx.hours)} logged</p>
          ) : null}
          <div className="chip-scroll">
            <Stat label="Playing" value={String(ctx.playing.length)} />
            <Stat label="Beaten" value={String(ctx.beaten.length)} />
            <Stat label="Backlog" value={String(ctx.backlog.length)} />
            <Stat label="Favorites" value={String(ctx.favorites.length)} />
          </div>
        </div>
      );
    case "playing":
      if (!ctx.playing.length) return null;
      return (
        <GameRail
          key="playing"
          title="Continue playing"
          action={
            <Link to="/library" className="text-sm font-medium text-accent">
              All
            </Link>
          }
        >
          {ctx.playing.map((e) => (
            <LibraryCard key={e.id} entry={e} />
          ))}
        </GameRail>
      );
    case "backlog":
      if (!ctx.backlog.length) return null;
      return (
        <GameRail
          key="backlog"
          title="Planning to play"
          action={
            <Link to="/library" className="text-sm font-medium text-accent">
              Library
            </Link>
          }
        >
          {ctx.backlog.slice(0, 16).map((e) => (
            <LibraryCard key={e.id} entry={e} />
          ))}
        </GameRail>
      );
    case "wishlist":
      if (!ctx.wishlist.length) return null;
      return (
        <GameRail key="wishlist" title="Wishlist">
          {ctx.wishlist.slice(0, 16).map((e) => (
            <LibraryCard key={e.id} entry={e} />
          ))}
        </GameRail>
      );
    case "recommended":
      if (!ctx.recommendedGames.length) return null;
      return (
        <GameRail key="recommended" title={ctx.recommendedTitle}>
          {ctx.recommendedGames.map((g, i) => (
            <GameCard
              key={g.id}
              catalogId={g.id}
              title={g.title}
              coverUrl={g.coverUrl}
              headerUrl={g.headerUrl}
              capsuleUrl={g.capsuleUrl}
              metacritic={g.metacritic}
              priority={i < 6}
            />
          ))}
        </GameRail>
      );
    case "playstation": {
      const rail = ctx.railsById.get("playstation");
      if (!rail?.games.length) return null;
      return <CatalogRail key="playstation" rail={rail} />;
    }
    default:
      return null;
  }
}

function CatalogRail({ rail }: { rail: FeaturedRail }) {
  return (
    <GameRail title={rail.title}>
      {rail.games.map((g, i) => (
        <GameCard
          key={`${rail.id}-${g.id}`}
          catalogId={g.id}
          title={g.title}
          coverUrl={g.coverUrl}
          headerUrl={g.headerUrl}
          capsuleUrl={g.capsuleUrl}
          metacritic={g.metacritic}
          priority={i < 6}
        />
      ))}
    </GameRail>
  );
}

function LibraryCard({ entry: e }: { entry: GameEntry }) {
  return (
    <GameCard
      catalogId={e.catalogId}
      title={e.title}
      coverUrl={e.coverUrl}
      headerUrl={e.headerUrl}
      status={e.status}
      score={e.score}
      hours={e.hours}
      favorite={e.favorite}
      metacritic={e.metacritic}
    />
  );
}

function HomeHello({
  name,
}: {
  name?: string;
}) {
  const hour = new Date().getHours();
  const hello =
    hour >= 5 && hour < 12
      ? "Rise and shine"
      : hour >= 12 && hour < 17
        ? "Happy snacking"
        : hour >= 17 && hour < 21
          ? "Keep it chill"
          : "You're up late";
  return (
    <div className="flex items-center gap-2">
      <p className="min-w-0 flex-1 truncate text-2xl font-medium tracking-tight">
        {hello}
        {name ? (
          <>
            {" "}
            <span className="text-accent">{name}</span>
          </>
        ) : null}
      </p>
      <Link
        to="/discover"
        search={{ q: "", focus: true }}
        aria-label="Search"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated text-fg"
      >
        <Search className="size-4" />
      </Link>
      <AccountMenu />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="shrink-0 rounded-full bg-subtle px-3 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="ml-1.5 text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}
