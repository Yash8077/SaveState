import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { authClient, getBearerToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { DEFAULT_AVATARS, defaultAvatarSrc } from "@/lib/avatars";
import { ThemeAvatar } from "@/components/theme-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: readProfile,
    enabled: Boolean(user),
  });
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.name);
    setImage(profile.data.image);
  }, [profile.data]);

  if (isPending) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!user) return <RedirectToSignIn />;

  const data = profile.data;
  const preview = image || user.profileImageUrl;

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
      setImage(json.image);
      await authClient.getSession();
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

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-faint">Account</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted">{data?.email ?? user.primaryEmail}</p>
      </div>

      <section className="rounded-2xl bg-elevated p-5">
        <div className="flex items-center gap-4">
          <ThemeAvatar
            src={preview}
            name={name}
            className="size-20"
          />
          <div className="min-w-0">
            <p className="text-lg font-medium truncate">{name || "Player"}</p>
            <p className="text-sm text-muted">Pick a badge or upload a photo.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {DEFAULT_AVATARS.map((avatar) => {
            const src = defaultAvatarSrc(avatar.id);
            const selected = image === src;
            return (
              <button
                key={avatar.id}
                type="button"
                onClick={() => setImage(src)}
                className={cn(
                  "overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-elevated",
                  selected ? "ring-accent" : "ring-transparent hover:ring-border",
                )}
                aria-label={avatar.name}
                title={avatar.name}
              >
                <ThemeAvatar src={src} name={avatar.name} className="aspect-square w-full" />
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
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
        </div>

        <label className="mt-5 block text-sm text-muted">
          Display name
          <Input
            className="mt-1.5"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <Button className="mt-4" disabled={saving} onClick={() => void saveProfile()}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </section>

      <section className="rounded-2xl bg-elevated p-5">
        <p className="text-base font-medium">Password</p>
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
            <Button
              disabled={passwordBusy}
              onClick={() => void savePassword()}
            >
              {passwordBusy ? "Updating…" : "Update password"}
            </Button>
          </div>
        )}
      </section>

      <p className="text-sm text-muted">
        Want the charts?{" "}
        <Link to="/stats" className="text-accent hover:underline">
          Open stats
        </Link>
      </p>
    </div>
  );
}
