import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Pencil } from "lucide-react";
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
  NameEditor,
  PasswordEditor,
  Sheet,
  readProfile,
} from "@/components/profile-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHours, normalizeArtUrl } from "@/lib/utils";
import type { GameEntry } from "@/lib/types";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

type SheetKind = "avatar" | "name" | "password" | null;

function bannerUrl(entries: GameEntry[]): string | null {
  const pick = [...entries.filter((e) => e.favorite), ...entries].find(
    (e) => e.headerUrl || e.coverUrl,
  );
  return normalizeArtUrl(pick?.headerUrl || pick?.coverUrl);
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
  const art = bannerUrl(entries);

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
          <h2 className="mb-3 text-lg font-medium">Favorites</h2>
          <div className="grid grid-cols-3 gap-3 min-[600px]:grid-cols-4 min-[900px]:grid-cols-6">
            {favorites.map((e) => (
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
          <h2 className="mb-3 text-lg font-medium">Beaten</h2>
          <div className="overflow-hidden rounded-2xl bg-elevated">
            {beaten.map((e, i) => (
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
