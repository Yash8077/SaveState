import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Heart, Plus } from "lucide-react";
import { Poster } from "@/components/poster";
import { StatusBadge } from "@/components/status-badge";
import { TrackerPanel } from "@/components/tracker-panel";
import { ListEditor, type ListEditorValue } from "@/components/list-editor";
import { GameCard, GameRail } from "@/components/game-card";
import {
  ScreenshotLightbox,
  ScreenshotThumb,
} from "@/components/screenshot-lightbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrary, useLibraryMutations } from "@/hooks/use-library";
import {
  catalogGameQueryKey,
  CATALOG_GAME_STALE_MS,
  getCatalogGame,
  snapshotFromDetails,
} from "@/lib/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { seedRelated } from "@/lib/catalog-seed";
import {
  flattenRelated,
  RELATED_RAIL_IDS,
  SEQUEL_DLC_RAIL_IDS,
} from "@/lib/related";
import { STATUS_LABEL, type Status } from "@/lib/types";
import { cn, pickPortraitCover } from "@/lib/utils";

export const Route = createFileRoute("/game/$catalogId")({
  component: GamePage,
});

function GamePage() {
  const { catalogId } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const library = useLibrary();
  const { add, update, remove } = useLibraryMutations();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isCustom = catalogId.startsWith("custom_");
  const preview = qc.getQueryData<{
    title?: string;
    coverUrl?: string | null;
    headerUrl?: string | null;
    capsuleUrl?: string | null;
  }>(["catalog-preview", catalogId]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [favoriteHint, setFavoriteHint] = useState(false);
  const [shotIndex, setShotIndex] = useState<number | null>(null);

  const details = useQuery({
    queryKey: catalogGameQueryKey(catalogId),
    queryFn: ({ signal }) => getCatalogGame(catalogId, signal),
    enabled: !isCustom,
    staleTime: CATALOG_GAME_STALE_MS,
  });

  const entry = (library.data ?? []).find((e) => e.catalogId === catalogId);
  const catalog = details.data;
  const title = entry?.title ?? catalog?.title ?? preview?.title;
  const coverUrl = pickPortraitCover(
    catalog?.coverUrl,
    entry?.coverUrl,
    preview?.coverUrl,
    catalog?.capsuleUrl,
    preview?.capsuleUrl,
  );
  const headerUrl =
    catalog?.headerUrl ?? entry?.headerUrl ?? preview?.headerUrl ?? null;
  const capsuleUrl = catalog?.capsuleUrl ?? preview?.capsuleUrl ?? null;
  const summary = plainText(entry?.summary ?? catalog?.summary);
  const genres = (entry?.genres?.length ? entry.genres : catalog?.genres) ?? [];
  const platforms =
    (entry?.platforms?.length ? entry.platforms : catalog?.platforms) ?? [];
  const developers =
    (entry?.developers?.length ? entry.developers : catalog?.developers) ?? [];
  const publishers =
    (entry?.publishers?.length ? entry.publishers : catalog?.publishers) ?? [];
  const screenshots =
    (entry?.screenshots?.length ? entry.screenshots : catalog?.screenshots) ??
    [];
  const relatedRails =
    catalog?.related?.length ? catalog.related : seedRelated(catalogId);
  const sequelDlc = flattenRelated(relatedRails, SEQUEL_DLC_RAIL_IDS);
  const relatedSimilar = flattenRelated(relatedRails, RELATED_RAIL_IDS);
  const relatedLoading = details.isLoading && !isCustom;
  const releaseDate = entry?.releaseDate ?? catalog?.releaseDate;
  const metacritic = entry?.metacritic ?? catalog?.metacritic;
  const banner = headerUrl || coverUrl;

  const loading = !title && (details.isLoading || library.isLoading || isPending);

  if (!loading && !title) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-medium">Title not found</h1>
        <p className="mt-2 text-sm text-muted">
          It may have been removed, or the catalog lookup failed.
        </p>
        <Link
          to="/search"
          className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-fg"
        >
          Back to search
        </Link>
      </div>
    );
  }

  function snapshot() {
    return snapshotFromDetails({
      title: title ?? "Untitled",
      coverUrl: coverUrl ?? null,
      headerUrl: headerUrl ?? null,
      summary: summary || null,
      releaseDate: releaseDate ?? null,
      platforms,
      genres,
      metacritic: metacritic ?? null,
      developers,
      publishers,
      screenshots,
    });
  }

  function openEditor(opts?: { favorite?: boolean }) {
    setFavoriteHint(Boolean(opts?.favorite));
    setEditorOpen(true);
  }

  async function saveEditor(value: ListEditorValue) {
    if (entry) {
      await update.mutateAsync({
        id: entry.id,
        status: value.status,
        score: value.score,
        favorite: value.favorite,
        startedAt: value.startedAt,
        finishedAt: value.finishedAt,
      });
    } else {
      await add.mutateAsync({
        catalogId,
        status: value.status,
        snapshot: snapshot(),
        score: value.score,
        favorite: value.favorite,
        startedAt: value.startedAt,
        finishedAt: value.finishedAt,
      });
    }
    setEditorOpen(false);
  }

  async function toggleFavorite() {
    if (entry) {
      await update.mutateAsync({ id: entry.id, favorite: !entry.favorite });
      return;
    }
    openEditor({ favorite: true });
  }

  const busy = add.isPending || update.isPending || remove.isPending;

  return (
    <article className="page-in -mx-3 -mt-2 sm:-mx-5">
      <div className="relative h-44 overflow-hidden bg-elevated hero-bloom min-[600px]:h-56 expanded:h-64 short:h-28">
        {banner ? (
          <img
            src={banner}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-cover object-center"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/20" />
      </div>

      <div className="relative z-10 -mt-16 px-3 sm:-mt-20 sm:px-5 min-[600px]:-mt-24">
        <div className="grid items-end gap-4 min-[600px]:grid-cols-[10.5rem_1fr] expanded:grid-cols-[12.5rem_1fr] expanded:gap-6 short:items-start short:grid-cols-[6.5rem_1fr]">
          <div className="mx-auto w-28 shrink-0 min-[600px]:mx-0 min-[600px]:w-full">
            {loading && !coverUrl ? (
              <Skeleton className="aspect-2/3 w-full rounded-lg" />
            ) : (
              <Poster
                title={title ?? ""}
                coverUrl={coverUrl}
                headerUrl={headerUrl}
                capsuleUrl={capsuleUrl}
                className="aspect-2/3 w-full rounded-lg shadow-lg"
              />
            )}
          </div>

          <div className="min-w-0 pb-1 text-center min-[600px]:text-left">
            {loading && !title ? (
              <Skeleton className="mx-auto h-8 w-2/3 min-[600px]:mx-0" />
            ) : (
              <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
                {title}
              </h1>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-muted min-[600px]:justify-start">
              {entry ? <StatusBadge status={entry.status} /> : null}
              {releaseDate ? <span>{releaseDate}</span> : null}
              {metacritic ? (
                <span className="tabular-nums">Metacritic {metacritic}</span>
              ) : null}
              {entry?.score ? (
                <span className="tabular-nums">Your score {entry.score}</span>
              ) : null}
            </div>

            {genres.length ? (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5 min-[600px]:justify-start">
                {genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full bg-subtle px-2.5 py-1 text-xs text-muted"
                  >
                    {g}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {!user && !isPending ? (
          <p className="mt-5 text-center text-sm text-muted min-[600px]:text-left">
            <Link to="/login" className="font-medium text-accent">
              Sign in
            </Link>{" "}
            to add this to your synced library.
          </p>
        ) : null}

        {user ? (
          <div className="mt-5 flex h-12 overflow-hidden rounded-2xl">
            <button
              type="button"
              disabled={busy}
              onClick={() => openEditor()}
              className="flex min-w-0 flex-[3] items-center justify-center gap-2 bg-accent/15 text-accent"
            >
              {entry ? (
                <Check className="size-4 shrink-0" />
              ) : (
                <Plus className="size-4 shrink-0" />
              )}
              <span className="truncate text-xs font-semibold uppercase tracking-[0.08em]">
                {entry
                  ? STATUS_LABEL[entry.status as Status]
                  : "Add to library"}
              </span>
            </button>
            <div className="w-1 shrink-0 bg-bg" />
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleFavorite()}
              className={cn(
                "flex min-w-0 flex-[2] items-center justify-center gap-2",
                entry?.favorite
                  ? "bg-accent/15 text-accent"
                  : "bg-subtle text-fg",
              )}
            >
              <Heart
                className={cn("size-4 shrink-0", entry?.favorite && "fill-current")}
              />
              <span className="truncate text-xs font-semibold uppercase tracking-[0.08em]">
                {entry?.favorite ? "Favorited" : "Favorite"}
              </span>
            </button>
          </div>
        ) : null}

        {sequelDlc.length ? (
          <RelatedRail title="Prequels, sequels & DLC" cards={sequelDlc} />
        ) : relatedLoading ? (
          <RelatedSkeleton title="Prequels, sequels & DLC" />
        ) : null}

        <div className="mt-6 grid gap-4 pb-4 expanded:grid-cols-[minmax(0,1fr)_20rem] expanded:items-start">
          <div className="space-y-4">
            {summary ? <Synopsis text={summary} /> : null}

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {platforms.length ? (
                <Meta label="Platforms" value={platforms.join(", ")} />
              ) : null}
              {developers.length ? (
                <Meta label="Developers" value={developers.join(", ")} />
              ) : null}
              {publishers.length ? (
                <Meta label="Publishers" value={publishers.join(", ")} />
              ) : null}
            </dl>

            {screenshots.length > 0 ? (
              <section className="hidden expanded:block">
                <h2 className="mb-3 text-base font-medium">Screenshots</h2>
                <div className="rail-scroll">
                  {screenshots.map((src, i) => (
                    <ScreenshotThumb
                      key={src}
                      src={src}
                      index={i}
                      onOpen={setShotIndex}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {entry ? (
            <TrackerPanel
              entry={entry}
              saving={update.isPending}
              onSave={async (patch) => {
                await update.mutateAsync({ id: entry.id, ...patch });
              }}
              onRemove={async () => {
                await remove.mutateAsync(entry.id);
                void navigate({ to: "/library" });
              }}
            />
          ) : null}
        </div>

        {screenshots.length > 0 ? (
          <section className="pb-4 expanded:hidden">
            <h2 className="mb-3 text-base font-medium">Screenshots</h2>
            <div className="rail-scroll">
              {screenshots.map((src, i) => (
                <ScreenshotThumb
                  key={src}
                  src={src}
                  index={i}
                  onOpen={setShotIndex}
                />
              ))}
            </div>
          </section>
        ) : null}

        {relatedSimilar.length ? (
          <RelatedRail title="Similar games" cards={relatedSimilar} />
        ) : relatedLoading ? (
          <RelatedSkeleton title="Similar games" />
        ) : null}
      </div>

      {shotIndex != null && screenshots[shotIndex] ? (
        <ScreenshotLightbox
          shots={screenshots}
          index={shotIndex}
          onIndex={setShotIndex}
          onClose={() => setShotIndex(null)}
        />
      ) : null}

      {editorOpen ? (
        <ListEditor
          key={entry ? `edit-${entry.id}` : `add-${favoriteHint}`}
          title={title ?? "Game"}
          initial={
            entry
              ? {
                  status: entry.status,
                  score: entry.score,
                  favorite: entry.favorite,
                  startedAt: entry.startedAt,
                  finishedAt: entry.finishedAt,
                }
              : { status: "playing", favorite: favoriteHint }
          }
          saving={busy}
          onClose={() => setEditorOpen(false)}
          onSave={saveEditor}
          onRemove={
            entry
              ? async () => {
                  await remove.mutateAsync(entry.id);
                  setEditorOpen(false);
                }
              : undefined
          }
        />
      ) : null}
    </article>
  );
}

function RelatedRail({
  title,
  cards,
}: {
  title: string;
  cards: ReturnType<typeof flattenRelated>;
}) {
  return (
    <section className="mt-6 pb-4">
      <GameRail title={title}>
        {cards.map((g) => (
          <GameCard
            key={`${g.relationId}-${g.id}`}
            catalogId={g.id}
            title={g.title}
            coverUrl={g.coverUrl}
            headerUrl={g.headerUrl}
            capsuleUrl={g.capsuleUrl}
            badge={g.relation}
          />
        ))}
      </GameRail>
    </section>
  );
}

function RelatedSkeleton({ title }: { title: string }) {
  return (
    <section className="mt-6 space-y-3 pb-4">
      <h2 className="text-base font-medium">{title}</h2>
      <div className="rail-scroll">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton
            key={i}
            className="h-36 w-[7.25rem] shrink-0 rounded-lg sm:w-[8.25rem]"
          />
        ))}
      </div>
    </section>
  );
}

function Synopsis({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 220;
  return (
    <div>
      <p
        className={cn(
          "text-sm leading-relaxed text-muted",
          !open && long && "line-clamp-4",
        )}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          className="mt-1 h-10 text-sm font-medium text-accent"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-elevated px-3 py-2.5">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-0.5 text-fg">{value}</dd>
    </div>
  );
}

function plainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
