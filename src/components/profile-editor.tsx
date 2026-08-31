import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient, getBearerToken } from "@/lib/auth/client";
import { canonicalizeAvatar, sortAvatarSrcs } from "@/lib/avatars";
import { bundledAvatarSrcs } from "@/lib/avatar-files";
import { ThemeAvatar } from "@/components/theme-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ProfileRecord = {
  id: string;
  name: string;
  email: string;
  image: string | null;
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

export function ProfileEditor({ onSaved }: { onSaved?: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: readProfile,
  });
  const bundled = bundledAvatarSrcs();
  const avatars = useQuery({
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
    setImage(canonicalizeAvatar(profile.data.image));
  }, [profile.data]);

  const data = profile.data;
  const preview = canonicalizeAvatar(image);

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await profileRequest("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image }),
      });
      const json = (await res.json()) as ProfileRecord & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save");
      setName(json.name);
      setImage(canonicalizeAvatar(json.image));
      try {
        await authClient.updateUser({
          name: json.name,
          image: json.image ?? undefined,
        });
      } catch {
        /* SQL is source of truth */
      }
      await authClient.getSession({ query: { disableCookieCache: true } });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile saved");
      onSaved?.();
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
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
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
      setPasswordBusy(false);
    }
  }

  async function onPickCustom(file: File | undefined) {
    if (!file) return;
    try {
      setImage(await resizeImage(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not use that image");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium">Avatar</p>
        <div className="mt-3 grid grid-cols-4 gap-3 min-[500px]:grid-cols-5">
          {(avatars.data ?? []).map((src) => {
            const selected = preview === src;
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

      <label className="block text-sm text-muted">
        Display name
        <Input
          className="mt-1.5"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <Button disabled={saving} onClick={() => void saveProfile()}>
        {saving ? "Saving…" : "Save profile"}
      </Button>

      <div className="border-t border-border pt-4">
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
    </div>
  );
}
