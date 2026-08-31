import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, KeyRound, Pencil } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLibrary } from "@/hooks/use-library";
import { canonicalizeAvatar } from "@/lib/avatars";
import { isoToDmy } from "@/lib/date-format";
import { ThemeAvatar } from "@/components/theme-avatar";
import { GameCard, RatingBadge } from "@/components/game-card";
import { Poster } from "@/components/poster";
import {
  AvatarPicker,
  BannerPicker,
  NameEditor,
  PasswordEditor,
  Sheet,
  readProfile,
} from "@/components/profile-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHours, upgradeHeroUrl } from "@/lib/utils";
import type { GameEntry } from "@/lib/types";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

type SheetKind = "avatar" | "name" | "password" | "banner" | null;
const BEATEN_PREVIEW = 6;
const FAVORITES_PREVIEW = 8;

function autoBanner(entries: GameEntry[]): string | null {
  const pick = [...entries.filter((e) => e.favorite), ...entries].find(
    (e) => e.headerUrl || e.coverUrl || /^steam_/.test(e.catalogId),
  );
  return upgradeHeroUrl(pick?.headerUrl || pick?.coverUrl, pick?.catalogId);
}

function displayBanner(saved: string | null | undefined, entries: GameEntry[]): string | null {
  if (saved?.startsWith("data:")) return saved;
  if (saved) return upgradeHeroUrl(saved);
  return autoBanner(entries);
}

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const library = useLibrary();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: readProfile,
    enabled: Boolean(user),
  });

  const entries = library.data ?? [];
  const hours = entries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
  const scored = entries.filter((e) => e.score != null);
  const avg =
    scored.length > 0
      ? scored.reduce((sum, e) => sum + (e.score ?? 0), 0) / scored.length
      : null;
  const beatenThisYear = entries.filter((e) => {
    if (e.status !== "beaten" || !e.finishedAt) return false;
    return e.finishedAt.startsWith(String(new Date().getFullYear()));
  }).length;
  const favorites = entries.filter((e) => e.favorite);
  const beaten = useMemo(
    () =>
      entries
        .filter((e) => e.status === "beaten")
        .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "")),
    [entries],
  );
  const favoritePreview = favorites.slice(0, FAVORITES_PREVIEW);
  const beatenPreview = beaten.slice(0, BEATEN_PREVIEW);
  const art = displayBanner(profile.data?.banner, entries);

  if (isPending) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!user) return <RedirectToSignIn />;

  const name = profile.data?.name || user.displayName || "Player";
  const email = profile.data?.email || user.primaryEmail || "";
  const avatar = canonicalizeAvatar(profile.data?.image || user.profileImageUrl);
  const hasPassword = profile.data?.hasPassword === true;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <section className="overflow-hidden rounded-3xl bg-elevated">
        <div className="relative h-36 min-[700px]:h-44">
          {art ? (
            <img src={art} alt="" className="size-full object-cover" />
          ) : (
            <div className="size-full bg-subtle" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-elevated via-elevated/55 to-transparent" />
          <button
            type="button"
            onClick={() => setSheet("banner")}
            className="absolute top-3 right-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-bg/70 px-3 text-xs font-medium backdrop-blur-sm"
            aria-label="Change banner"
          >
            <ImageIcon className="size-3.5" />
            Banner
          </button>
        </div>
        <div className="relative -mt-12 flex flex-wrap items-end gap-4 px-5 pb-5">
          <button
            type="button"
            onClick={() => setSheet("avatar")}
            className="relative shrink-0"
            aria-label="Change avatar"
          >
            <ThemeAvatar
              src={avatar}
              name={name}
              className="size-24 ring-4 ring-elevated"
            />
            <span className="absolute right-0 bottom-0 grid size-7 place-items-center rounded-full bg-accent text-accent-fg">
              <Pencil className="size-3.5" />
            </span>
          </button>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate text-2xl font-medium tracking-tight">{name}</h1>
              <button
                type="button"
                aria-label="Change name"
                onClick={() => setSheet("name")}
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-subtle hover:text-fg"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
            <p className="truncate text-sm text-muted">{email}</p>
            {hasPassword ? (
              <button
                type="button"
                onClick={() => setSheet("password")}
                className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-subtle px-3 text-xs font-medium"
              >
                <KeyRound className="size-3.5" />
                Change password
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <Link
        to="/stats"
        className="grid grid-cols-2 gap-2 min-[700px]:grid-cols-4"
      >
        <Chip label="Logged" value={String(entries.length)} />
        <Chip label="Hours" value={formatHours(hours)} />
        <Chip label="Avg score" value={avg == null ? "—" : avg.toFixed(1)} />
        <Chip label="Beaten this year" value={String(beatenThisYear)} />
      </Link>

      {favorites.length ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-medium">Favorites</h2>
            {favorites.length > FAVORITES_PREVIEW ? (
              <Link
                to="/library"
                search={{ status: "favorites" }}
                className="text-sm font-medium text-accent"
              >
                See all {favorites.length} →
              </Link>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-3 min-[600px]:grid-cols-4 min-[900px]:grid-cols-6">
            {favoritePreview.map((e) => (
              <GameCard
                key={e.id}
                catalogId={e.catalogId}
                title={e.title}
                coverUrl={e.coverUrl}
                headerUrl={e.headerUrl}
                status={e.status}
                score={e.score}
                hours={e.hours}
                favorite={e.favorite}
                metacritic={e.metacritic}
                size="grid"
              />
            ))}
          </div>
        </section>
      ) : null}

      {beaten.length ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-medium">Beaten</h2>
            {beaten.length > BEATEN_PREVIEW ? (
              <Link
                to="/library"
                search={{ status: "beaten" }}
                className="text-sm font-medium text-accent"
              >
                See all {beaten.length} →
              </Link>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-2xl bg-elevated">
            {beatenPreview.map((e, i) => (
              <Link
                key={e.id}
                to="/game/$catalogId"
                params={{ catalogId: e.catalogId }}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-subtle"
                style={i > 0 ? { borderTop: "1px solid var(--color-border)" } : undefined}
              >
                <span className="relative h-[4.5rem] w-12 shrink-0 overflow-hidden rounded-lg">
                  <Poster
                    coverUrl={e.coverUrl}
                    headerUrl={e.headerUrl}
                    title={e.title}
                    className="size-full"
                  />
                  <RatingBadge score={e.metacritic ?? e.score} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.title}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {[
                      e.score != null ? `${e.score}/10` : null,
                      e.hours != null ? formatHours(e.hours) : null,
                      isoToDmy(e.finishedAt) || null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {sheet === "avatar" ? (
        <Sheet title="Change avatar" onClose={() => setSheet(null)}>
          <AvatarPicker
            value={avatar}
            persist
            onSaved={() => setSheet(null)}
          />
        </Sheet>
      ) : null}
      {sheet === "banner" ? (
        <Sheet title="Change banner" onClose={() => setSheet(null)}>
          <BannerPicker
            value={profile.data?.banner ?? null}
            games={entries}
            onSaved={() => setSheet(null)}
          />
        </Sheet>
      ) : null}
      {sheet === "name" ? (
        <Sheet title="Change name" onClose={() => setSheet(null)}>
          <NameEditor value={name} persist onSaved={() => setSheet(null)} />
        </Sheet>
      ) : null}
      {sheet === "password" ? (
        <Sheet title="Change password" onClose={() => setSheet(null)}>
          <PasswordEditor />
        </Sheet>
      ) : null}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-elevated px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-faint">{label}</p>
      <p className="text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}