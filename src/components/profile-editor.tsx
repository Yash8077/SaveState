import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient, getBearerToken } from "@/lib/auth/client";
import { canonicalizeAvatar, sortAvatarSrcs } from "@/lib/avatars";
import { bundledAvatarSrcs } from "@/lib/avatar-files";
import { ThemeAvatar } from "@/components/theme-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, upgradeHeroUrl } from "@/lib/utils";
import type { GameEntry } from "@/lib/types";

export type ProfileRecord = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  banner: string | null;
  hasPassword: boolean;
};

export async function profileRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const token = getBearerToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers, credentials: "include" });
}

export async function readProfile(): Promise<ProfileRecord> {
  const res = await profileRequest("/api/profile");
  if (!res.ok) throw new Error("Could not load profile");
  return (await res.json()) as ProfileRecord;
}

async function refreshSession(qc: ReturnType<typeof useQueryClient>) {
  try {
    await authClient.getSession({ query: { disableCookieCache: true } });
  } catch {
    /* cookie refresh is best-effort */
  }
  void qc.invalidateQueries({ queryKey: ["profile"] });
}

export async function patchProfile(fields: {
  name?: string;
  image?: string | null;
  banner?: string | null;
}): Promise<ProfileRecord> {
  const res = await profileRequest("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const json = (await res.json()) as ProfileRecord & { error?: string };
  if (!res.ok) throw new Error(json.error || "Could not save");
  try {
    await authClient.updateUser({
      name: json.name,
      image: json.image ?? undefined,
    });
  } catch {
    /* SQL is source of truth */
  }
  return json;
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
      ctx.drawImage(
        raw,
        (raw.width - side) / 2,
        (raw.height - side) / 2,
        side,
        side,
        0,
        0,
        256,
        256,
      );
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

function resizeBanner(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const raw = new Image();
    const url = URL.createObjectURL(file);
    raw.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("No canvas"));
        return;
      }
      const target = 1600 / 500;
      const source = raw.width / raw.height;
      let sx = 0;
      let sy = 0;
      let sw = raw.width;
      let sh = raw.height;
      if (source > target) {
        sw = raw.height * target;
        sx = (raw.width - sw) / 2;
      } else {
        sh = raw.width / target;
        sy = (raw.height - sh) / 2;
      }
      ctx.drawImage(raw, sx, sy, sw, sh, 0, 0, 1600, 500);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    raw.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    raw.src = url;
  });
}

function useAvatarSrcs() {
  const bundled = bundledAvatarSrcs();
  return useQuery({
    queryKey: ["avatars"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/config");
        const json = (await res.json()) as { avatars?: string[] };
        if (json.avatars?.length) {
          return sortAvatarSrcs([...new Set([...json.avatars, ...bundled])]);
        }
      } catch {
        /* bundled list still works */
      }
      return bundled;
    },
    initialData: bundled,
  });
}

export function AvatarPicker({
  value,
  persist,
  onSaved,
}: {
  value: string | null;
  persist?: boolean;
  onSaved?: (image: string) => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const avatars = useAvatarSrcs();
  const [image, setImage] = useState(canonicalizeAvatar(value));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setImage(canonicalizeAvatar(value));
  }, [value]);

  async function pick(next: string) {
    setImage(next);
    if (!persist) {
      onSaved?.(next);
      return;
    }
    setBusy(true);
    try {
      const json = await patchProfile({ image: next });
      const saved = canonicalizeAvatar(json.image) || next;
      setImage(saved);
      await refreshSession(qc);
      onSaved?.(saved);
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save avatar");
    } finally {
      setBusy(false);
    }
  }

  async function onPickCustom(file: File | undefined) {
    if (!file) return;
    try {
      await pick(await resizeImage(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not use that image");
    }
  }

  return (
    <div className={cn(busy && "pointer-events-none opacity-70")}>
      <div className="grid grid-cols-4 gap-3 min-[500px]:grid-cols-5">
        {(avatars.data ?? []).map((src) => {
          const selected = image === src;
          return (
            <button
              key={src}
              type="button"
              onClick={() => void pick(src)}
              className={cn(
                "overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-elevated",
                selected ? "ring-accent" : "ring-transparent hover:ring-border",
              )}
              aria-label={src}
            >
              <ThemeAvatar src={src} name="Avatar" className="aspect-square w-full" />
            </button>
          );
        })}
      </div>
      <div className="mt-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
          Custom photo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void onPickCustom(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

export function BannerPicker({
  value,
  games,
  onSaved,
}: {
  value: string | null;
  games: GameEntry[];
  onSaved?: (banner: string | null) => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const ranked = [
    ...games.filter((game) => game.favorite),
    ...games,
  ];
  const options = ranked
    .map((game) => ({
      id: game.catalogId,
      title: game.title,
      src: upgradeHeroUrl(game.headerUrl, game.catalogId),
    }))
    .filter((row): row is { id: string; title: string; src: string } => Boolean(row.src));
  const unique = options.filter(
    (row, i, list) => list.findIndex((item) => item.src === row.src) === i,
  );

  async function pick(next: string | null) {
    setBusy(true);
    try {
      const json = await patchProfile({ banner: next });
      await refreshSession(qc);
      onSaved?.(json.banner);
      toast.success(next ? "Banner updated" : "Using automatic banner");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save banner");
    } finally {
      setBusy(false);
    }
  }

  async function onPickCustom(file: File | undefined) {
    if (!file) return;
    try {
      await pick(await resizeBanner(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not use that image");
    }
  }

  return (
    <div className={cn("space-y-4", busy && "pointer-events-none opacity-70")}>
      <p className="text-sm text-muted">
        Pick a game hero, upload a photo, or reset to the automatic favorite art.
      </p>
      {unique.length ? (
        <div className="grid grid-cols-2 gap-2 min-[500px]:grid-cols-3">
          {unique.slice(0, 12).map((row) => {
            const selected = value === row.src;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => void pick(row.src)}
                className={cn(
                  "overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-elevated",
                  selected ? "ring-accent" : "ring-transparent hover:ring-border",
                )}
              >
                <img src={row.src} alt={row.title} className="aspect-[16/5] w-full object-cover" />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted">Add games to your library to use their artwork.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
          Custom photo
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void pick(null)}>
          Automatic
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void onPickCustom(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

export function NameEditor({
  value,
  persist,
  onSaved,
}: {
  value: string;
  persist?: boolean;
  onSaved?: (name: string) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(value);
  const [busy, setBusy] = useState(false);

  useEffect(() => setName(value), [value]);

  async function save() {
    const next = name.trim();
    if (!next || next.length > 40) {
      toast.error("Name must be 1–40 characters");
      return;
    }
    if (!persist) {
      onSaved?.(next);
      return;
    }
    setBusy(true);
    try {
      const json = await patchProfile({ name: next });
      setName(json.name);
      await refreshSession(qc);
      onSaved?.(json.name);
      toast.success("Name updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save name");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm text-muted">
        Display name
        <Input
          className="mt-1.5"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <Button disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save name"}
      </Button>
    </div>
  );
}

export function PasswordEditor() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (newPassword.length < 8) {
      toast.error("New password needs at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await profileRequest("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not update password");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
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
      <Button disabled={busy} onClick={() => void save()}>
        {busy ? "Updating…" : "Update password"}
      </Button>
    </div>
  );
}

export function ProfileEditor({ onSaved }: { onSaved?: () => void }) {
  const profile = useQuery({ queryKey: ["profile"], queryFn: readProfile });
  const [name, setName] = useState(profile.data?.name ?? "");
  const [image, setImage] = useState<string | null>(
    canonicalizeAvatar(profile.data?.image),
  );
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.name);
    setImage(canonicalizeAvatar(profile.data.image));
  }, [profile.data]);

  async function save() {
    setSaving(true);
    try {
      const json = await patchProfile({ name, image });
      setName(json.name);
      setImage(canonicalizeAvatar(json.image));
      await refreshSession(qc);
      toast.success("Profile saved");
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium">Avatar</p>
        <div className="mt-3">
          <AvatarPicker value={image} onSaved={setImage} />
        </div>
      </div>
      <label className="block text-sm text-muted">
        Display name
        <Input
          className="mt-1.5"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <Button disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save profile"}
      </Button>
      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium">Password</p>
        {profile.data && !profile.data.hasPassword ? (
          <p className="mt-2 text-sm text-muted">
            You signed in with Google, so there is no password to change here.
          </p>
        ) : (
          <div className="mt-3">
            <PasswordEditor />
          </div>
        )}
      </div>
    </div>
  );
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/55 p-0 min-[600px]:place-items-center min-[600px]:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[min(40rem,92vh)] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-elevated p-5 shadow-2xl min-[600px]:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="sheet-title"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="sheet-title" className="text-lg font-medium">
            {title}
          </h2>
          <button
            type="button"
            className="text-sm text-muted hover:text-fg"
            onClick={onClose}
          >
            Done
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
