import { useEffect, useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAppearance } from "@/components/appearance-provider";
import { GameCard, GameRail } from "@/components/game-card";
import { HeroCarousel } from "@/components/hero-carousel";
import { useHomeLayout } from "@/components/home-layout-provider";
import { useLibrary } from "@/hooks/use-library";
import { useMounted } from "@/hooks/use-mounted";
import { getFeaturedRails } from "@/lib/api";
import { FEATURED_SEED } from "@/lib/catalog-seed";
import { heroSlides } from "@/lib/hero";
import {
  isCatalogSection,
  mergeHomeLayout,
  type HomeSectionPref,
} from "@/lib/home-layout";
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
  const featured = useQuery({
    queryKey: ["featured", "rel-19"],
    queryFn: ({ signal }) => getFeaturedRails(signal),
    staleTime: 30 * 60_000,
    placeholderData: FEATURED_SEED,
    enabled: mounted,
  });

  const entries = library.data ?? [];
  const playing = entries.filter((e) => e.status === "playing");
  const backlog = entries.filter((e) => e.status === "backlog");
  const beaten = entries.filter((e) => e.status === "beaten");
  const favorites = entries.filter((e) => e.favorite);
  const hours = entries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
  const signedIn = mounted && Boolean(user);
  const name =
    user?.displayName?.trim().split(/\s+/)[0] ||
    user?.primaryEmail?.split("@")[0];
  const rails = featured.data ?? FEATURED_SEED;
  const slides = heroSlides(mounted ? playing : [], rails);
  const tintSource = playing[0]?.catalogId ?? slides[0]?.id;
  const sections = useMemo(
    () => mergeHomeLayout(layout.sections, rails.map((rail) => rail.id)),
    [layout.sections, rails],
  );

  useEffect(() => {
    if (!appearance.dynamic) return;
    if (!tintSource) return;
    setDynamicAccent(tintForCatalog(tintSource));
  }, [appearance.dynamic, tintSource, setDynamicAccent]);

  const railsById = new Map(rails.map((rail) => [rail.id, rail]));
  const firstCatalogId =
    sections.find(
      (row) =>
        row.enabled &&
        (isCatalogSection(row.id) || railsById.has(row.id)) &&
        (railsById.get(row.id)?.games.length ?? 0) > 0,
    )?.id ?? null;

  return (
    <div className="page-in space-y-7">
      {sections.map((section) =>
        renderHomeSection(section, {
          signedIn,
          mounted,
          name,
          avatar: user?.profileImageUrl,
          hours,
          playing,
          backlog,
          beaten,
          favorites,
          slides,
          railsById,
          firstCatalogId,
          autoplay: layout.autoplay,
        }),
      )}
      {signedIn &&
      !library.isLoading &&
      entries.length === 0 &&
      sections.some((row) => row.enabled && (row.id === "playing" || row.id === "backlog")) ? (
        <div className="rounded-xl bg-elevated px-4 py-8 text-center">
          <p className="text-lg font-medium">Library is empty</p>
          <p className="mt-1 text-sm text-muted">
            Search the catalog and add something you are playing.
          </p>
          <Link
            to="/search"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg"
          >
            Browse games
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
    name?: string;
    avatar?: string | null;
    hours: number;
    playing: GameEntry[];
    backlog: GameEntry[];
    beaten: GameEntry[];
    favorites: GameEntry[];
    slides: ReturnType<typeof heroSlides>;
    railsById: Map<string, FeaturedRail>;
    firstCatalogId: string | null;
    autoplay: boolean;
  },
) {
  if (!section.enabled) return null;
  switch (section.id) {
    case "hero":
      return ctx.slides.length ? (
        <div key="hero" className="space-y-3">
          <HomeHello name={ctx.name} avatar={ctx.avatar} />
          <HeroCarousel games={ctx.slides} autoplay={ctx.autoplay} />
        </div>
      ) : null;
    case "stats":
      if (!ctx.signedIn && ctx.mounted) {
        return (
          <header key="guest">
            <h2 className="text-2xl font-medium tracking-tight">Your games</h2>
            <p className="mt-1 text-sm text-muted">
              Log what you play. Syncs across phones and tablets.
            </p>
          </header>
        );
      }
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
    default: {
      if (!isCatalogSection(section.id) && !ctx.railsById.has(section.id)) {
        return null;
      }
      const rail = ctx.railsById.get(section.id);
      if (!rail?.games.length) return null;
      const heading =
        section.id === ctx.firstCatalogId ? (
          <div key="browse-head">
            <h2 className="text-lg font-medium tracking-tight">Browse</h2>
            <p className="text-xs text-faint">
              Steam charts by popularity, plus PlayStation 5.
            </p>
          </div>
        ) : null;
      return (
        <div key={rail.id} className="space-y-7">
          {heading}
          <CatalogRail rail={rail} />
        </div>
      );
    }
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
  avatar,
}: {
  name?: string;
  avatar?: string | null;
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
  const initial = name?.charAt(0).toUpperCase() || "S";
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
        to="/search"
        aria-label="Search"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated text-fg"
      >
        <Search className="size-4" />
      </Link>
      <Link
        to={name ? "/profile" : "/login"}
        aria-label={name ? "Profile" : "Sign in"}
        className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent/20 text-sm font-semibold text-accent"
      >
        {avatar ? (
          <img src={avatar} alt="" className="size-full object-cover" />
        ) : (
          initial
        )}
      </Link>
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
