import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Poster } from "@/components/poster";
import { StatusBadge } from "@/components/status-badge";
import { TrackerPanel } from "@/components/tracker-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrary, useLibraryMutations } from "@/hooks/use-library";
import { getCatalogGame, snapshotFromDetails } from "@/lib/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/types";
import { cn, steamPortraitUrl } from "@/lib/utils";

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
  const portrait = steamPortraitUrl(catalogId);
  const preview = qc.getQueryData<{
    title?: string;
    coverUrl?: string | null;
    headerUrl?: string | null;
  }>(["catalog-preview", catalogId]);

  const details = useQuery({
    queryKey: ["catalog-game", catalogId],
    queryFn: ({ signal }) => getCatalogGame(catalogId, signal),
    enabled: !isCustom,
    staleTime: 10 * 60_000,
  });

  const entry = (library.data ?? []).find((e) => e.catalogId === catalogId);
  const catalog = details.data;
  const title = entry?.title ?? catalog?.title ?? preview?.title;
  const coverUrl = portrait ?? entry?.coverUrl ?? catalog?.coverUrl ?? preview?.coverUrl;
  const headerUrl = entry?.headerUrl ?? catalog?.headerUrl ?? preview?.headerUrl;
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

  async function addWith(status: Status) {
    const snap = snapshotFromDetails({
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
    await add.mutateAsync({ catalogId, status, snapshot: snap });
  }

  return (
    <article className="-mx-3 -mt-2 sm:-mx-5">
      <div className="relative h-44 overflow-hidden bg-elevated min-[600px]:h-56 expanded:h-64 short:h-28">
        {banner ? (
          <img
            src={banner}
            alt=""
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

            {!user && !isPending ? (
              <p className="mt-4 text-sm text-muted">
                <Link to="/login" className="font-medium text-accent">
                  Sign in
                </Link>{" "}
                to add this to your synced library.
              </p>
            ) : null}

            {user && !entry ? (
              <div className="mt-4">
                <p className="mb-2 text-sm text-muted">Add to library</p>
                <div className="flex flex-wrap justify-center gap-1.5 min-[600px]:justify-start">
                  {STATUSES.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={status === "playing" ? "primary" : "secondary"}
                      disabled={add.isPending}
                      onClick={() => void addWith(status)}
                    >
                      {STATUS_LABEL[status]}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 pb-4 expanded:grid-cols-[minmax(0,1fr)_22rem] expanded:items-start">
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
          <section className="pb-4">
            <h2 className="mb-3 text-base font-medium">Screenshots</h2>
            <div className="rail-scroll">
              {screenshots.map((src) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading="lazy"
                  className="h-36 snap-start rounded-lg object-cover sm:h-48"
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </article>
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
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
