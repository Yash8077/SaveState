import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLibrary } from "@/hooks/use-library";
import { canonicalizeAvatar } from "@/lib/avatars";
import { ThemeAvatar } from "@/components/theme-avatar";
import { GameCard, GameRail } from "@/components/game-card";
import { ProfileEditor, readProfile } from "@/components/profile-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHours } from "@/lib/utils";
import type { GameEntry } from "@/lib/types";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

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

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const library = useLibrary();
  const [editing, setEditing] = useState(false);
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
  const playing = entries.filter((e) => e.status === "playing");
  const favorites = entries.filter((e) => e.favorite);
  const beaten = useMemo(
    () =>
      entries
        .filter((e) => e.status === "beaten")
        .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))
        .slice(0, 12),
    [entries],
  );

  if (isPending) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!user) return <RedirectToSignIn />;

  const name = profile.data?.name || user.displayName || "Player";
  const email = profile.data?.email || user.primaryEmail || "";
  const avatar = canonicalizeAvatar(profile.data?.image || user.profileImageUrl);

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-8">
      <section className="flex flex-wrap items-start gap-4">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="relative shrink-0"
          aria-label="Edit profile"
        >
          <ThemeAvatar src={avatar} name={name} className="size-20 sm:size-24" />
          <span className="absolute right-0 bottom-0 grid size-7 place-items-center rounded-full bg-accent text-accent-fg">
            <Pencil className="size-3.5" />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-medium tracking-tight">{name}</h1>
              <p className="truncate text-sm text-muted">{email}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-9 items-center rounded-full bg-elevated px-3 text-sm font-medium"
            >
              Edit
            </button>
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

      {playing.length ? (
        <GameRail title="Currently playing">
          {playing.map((e) => (
            <LibraryCard key={e.id} entry={e} />
          ))}
        </GameRail>
      ) : null}
      {favorites.length ? (
        <GameRail title="Favorites">
          {favorites.map((e) => (
            <LibraryCard key={e.id} entry={e} />
          ))}
        </GameRail>
      ) : null}
      {beaten.length ? (
        <GameRail title="Recently beaten">
          {beaten.map((e) => (
            <LibraryCard key={e.id} entry={e} />
          ))}
        </GameRail>
      ) : null}

      {editing ? (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/55 p-0 min-[600px]:place-items-center min-[600px]:p-4"
          onClick={() => setEditing(false)}
        >
          <div
            className="max-h-[min(40rem,92vh)] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-elevated p-5 shadow-2xl min-[600px]:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="edit-profile-title"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="edit-profile-title" className="text-lg font-medium">
                Edit profile
              </h2>
              <button
                type="button"
                className="text-sm text-muted hover:text-fg"
                onClick={() => setEditing(false)}
              >
                Done
              </button>
            </div>
            <ProfileEditor />
          </div>
        </div>
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
