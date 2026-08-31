import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { authClient, getBearerToken, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLibrary } from "@/hooks/use-library";
import { canonicalizeAvatar } from "@/lib/avatars";
import { ThemeAvatar } from "@/components/theme-avatar";
import { GameCard, GameRail } from "@/components/game-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatHours } from "@/lib/utils";
import type { GameEntry } from "@/lib/types";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

type Profile = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  hasPassword: boolean;
};

async function profileRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const token = getBearerToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers, credentials: "include" });
}

async function readProfile(): Promise<Profile> {
  const res = await profileRequest("/api/profile");
  if (!res.ok) throw new Error("Could not load profile");
  return (await res.json()) as Profile;
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const raw = new Image();
    const url = URL.createObjectURL(file);
    raw.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("No canvas"));
        return;
      }
      const side = Math.min(raw.width, raw.height);
      const sx = (raw.width - side) / 2;
      const sy = (raw.height - side) / 2;
      ctx.drawImage(raw, sx, sy, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    raw.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    raw.src = url;
  });
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

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const qc = useQueryClient();
  const library = useLibrary();
  const fileRef = useRef<HTMLInputElement>(null);
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: readProfile,
    enabled: Boolean(user),
  });
  const avatars = useQuery({
    queryKey: ["avatars"],
    queryFn: async () => {
      const res = await fetch("/api/config");
      const json = (await res.json()) as { avatars?: string[] };
      return json.avatars ?? [];
    },
  });
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.name);
    setImage(canonicalizeAvatar(profile.data.image));
  }, [profile.data]);

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

  const data = profile.data;
  const preview = canonicalizeAvatar(image) || user.profileImageUrl;

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await profileRequest("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image }),
      });
      const json = (await res.json()) as Profile & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save");
      setName(json.name);
      setImage(canonicalizeAvatar(json.image));
      try {
        await authClient.updateUser({
          name: json.name,
          image: json.image ?? undefined,
        });
      } catch {
        /* SQL is source of truth; session refresh is best-effort */
      }
      await authClient.getSession({
        query: { disableCookieCache: true },
      });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    if (newPassword.length < 8) {
      toast.error("New password needs at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setPasswordBusy(true);
    try {
      const res = await profileRequest("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not change password");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function onPickCustom(file: File | undefined) {
    if (!file) return;
    try {
      const next = await resizeImage(file);
      setImage(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not use that image");
    }
  }

  const identity = (
    <section className="overflow-hidden rounded-2xl bg-elevated">
      <div className="h-24 bg-[color-mix(in_oklab,var(--color-accent)_42%,#071016)]" />
      <div className="px-5 pb-5">
        <div className="-mt-10 flex items-end gap-4">
          <ThemeAvatar src={preview} name={name} className="size-20 ring-4 ring-elevated" />
          <div className="min-w-0 pb-1">
            <p className="truncate text-xl font-medium">{name || "Player"}</p>
            <p className="truncate text-sm text-muted">
              {data?.email ?? user.primaryEmail}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Chip label="Logged" value={String(entries.length)} />
          <Chip label="Hours" value={formatHours(hours)} />
          <Chip label="Avg score" value={avg == null ? "—" : avg.toFixed(1)} />
          <Chip label="Beaten this year" value={String(beatenThisYear)} />
        </div>
        <Link
          to="/stats"
          className="mt-4 inline-flex h-10 items-center text-sm font-medium text-accent hover:underline"
        >
          Full stats
        </Link>
      </div>
    </section>
  );

  const shelves = (
    <div className="space-y-6 min-w-0">
      {playing.length ? (
        <GameRail title="Currently playing">
          {playing.map((e) => (
            <LibraryCard key={e.id} entry={e} />
          ))}
        </GameRail>
      ) : (
        <EmptyShelf
          title="Currently playing"
          hint="Nothing in progress. Add a game from search."
        />
      )}
      {favorites.length ? (
        <GameRail title="Favorites">
          {favorites.map((e) => (
            <LibraryCard key={e.id} entry={e} />
          ))}
        </GameRail>
      ) : (
        <EmptyShelf title="Favorites" hint="Star a game to pin it here." />
      )}
      {beaten.length ? (
        <GameRail title="Recently beaten">
          {beaten.map((e) => (
            <LibraryCard key={e.id} entry={e} />
          ))}
        </GameRail>
      ) : (
        <EmptyShelf title="Recently beaten" hint="Finish something and it lands here." />
      )}
    </div>
  );

  const account = (
    <section className="rounded-2xl bg-elevated p-5">
      <p className="text-base font-medium">Account</p>
      <p className="mt-1 text-sm text-muted">Name, avatar, and password.</p>

      <div className="mt-4 flex items-center gap-3">
        <ThemeAvatar src={preview} name={name} className="size-16" />
        <Button type="button" variant="secondary" onClick={() => setPickerOpen(true)}>
          Change avatar
        </Button>
      </div>

      <label className="mt-4 block text-sm text-muted">
        Display name
        <Input
          className="mt-1.5"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <Button className="mt-3" disabled={saving} onClick={() => void saveProfile()}>
        {saving ? "Saving…" : "Save profile"}
      </Button>

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-sm font-medium">Password</p>
        {data && !data.hasPassword ? (
          <p className="mt-2 text-sm text-muted">
            You signed in with Google, so there is no password to change here.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="block text-sm text-muted">
              Current password
              <Input
                className="mt-1.5"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label className="block text-sm text-muted">
              New password
              <Input
                className="mt-1.5"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label className="block text-sm text-muted">
              Confirm new password
              <Input
                className="mt-1.5"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            <Button disabled={passwordBusy} onClick={() => void savePassword()}>
              {passwordBusy ? "Updating…" : "Update password"}
            </Button>
          </div>
        )}
      </div>

      <Button
        className="mt-5"
        variant="ghost"
        disabled={signingOut}
        onClick={() => {
          setSigningOut(true);
          void signOut("/").catch(() => setSigningOut(false));
        }}
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </section>
  );

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <div className="grid items-start gap-5 min-[900px]:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
        <div className="order-1 min-[900px]:col-start-1">{identity}</div>
        <div className="order-3 min-[900px]:order-2 min-[900px]:col-start-1 min-[900px]:row-start-2">
          {account}
        </div>
        <div className="order-2 min-[900px]:order-3 min-[900px]:col-start-2 min-[900px]:row-start-1 min-[900px]:row-span-2">
          {shelves}
        </div>
      </div>
      {pickerOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="flex max-h-[min(36rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-elevated shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="avatar-picker-title"
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
              <h2 id="avatar-picker-title" className="text-lg font-medium">
                Choose avatar
              </h2>
              <button
                type="button"
                className="text-sm text-muted hover:text-fg"
                onClick={() => setPickerOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              <div className="grid grid-cols-4 gap-3 min-[500px]:grid-cols-5">
                {(avatars.data ?? []).map((src) => {
                  const selected = canonicalizeAvatar(image) === src;
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setImage(src)}
                      className={cn(
                        "overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-elevated",
                        selected ? "ring-accent" : "ring-transparent hover:ring-border",
                      )}
                      aria-label={src}
                    >
                      <ThemeAvatar
                        src={src}
                        name="Avatar"
                        className="aspect-square w-full"
                      />
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => fileRef.current?.click()}
                >
                  Custom photo
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void onPickCustom(e.target.files?.[0])}
                />
                <Button type="button" onClick={() => setPickerOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-subtle px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-faint">{label}</p>
      <p className="text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

function EmptyShelf({ title, hint }: { title: string; hint: string }) {
  return (
    <section className="rounded-2xl bg-elevated px-4 py-5">
      <h2 className="text-base font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </section>
  );
}
