import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, LogIn, LogOut, Settings, UserRound } from "lucide-react";
import { ThemeAvatar } from "@/components/theme-avatar";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMounted } from "@/hooks/use-mounted";
import { GUEST_AVATAR } from "@/lib/avatars";
import { cn } from "@/lib/utils";

export function AccountMenu({ className }: { className?: string }) {
  const mounted = useMounted();
  const { user, isPending } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const name =
    user?.displayName?.trim() || user?.primaryEmail || "Guest";

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!mounted || isPending) {
    return <div className={cn("size-10 animate-pulse rounded-full bg-subtle", className)} />;
  }

  const close = () => setOpen(false);

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        aria-label="Account"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="size-10 overflow-hidden rounded-full"
      >
        <ThemeAvatar
          src={user?.profileImageUrl || GUEST_AVATAR}
          name={name}
          className="size-10"
        />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close account menu"
            className="fixed inset-0 z-40 bg-black/45"
            onClick={close}
          />
          <div className="fixed inset-x-3 bottom-[5.5rem] z-50 overflow-hidden rounded-3xl bg-elevated p-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)] min-[600px]:inset-auto min-[600px]:top-16 min-[600px]:right-4 min-[600px]:bottom-auto min-[600px]:w-[22rem]">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-subtle"
              onClick={() => {
                close();
                if (user) {
                  if (authEnabled) {
                    setSigningOut(true);
                    void signOut().catch(() => setSigningOut(false));
                  }
                } else {
                  void navigate({ to: "/login" });
                }
              }}
            >
              <ThemeAvatar
                src={user?.profileImageUrl || GUEST_AVATAR}
                name={name}
                className="size-12"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{name}</span>
                <span className="block text-xs text-faint">
                  {user
                    ? signingOut
                      ? "Signing out…"
                      : "Tap to log out"
                    : "Sign in to sync your library"}
                </span>
              </span>
            </button>
            <div className="mt-2 overflow-hidden rounded-2xl bg-subtle">
              {user ? (
                <MenuRow
                  icon={UserRound}
                  label="View profile"
                  to="/profile"
                  onClick={close}
                />
              ) : (
                <MenuRow
                  icon={LogIn}
                  label="Sign in"
                  to="/login"
                  onClick={close}
                />
              )}
              <MenuRow
                icon={Settings}
                label="Settings"
                to="/settings"
                onClick={close}
              />
              {user && authEnabled ? (
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => {
                    setSigningOut(true);
                    void signOut().catch(() => setSigningOut(false));
                  }}
                  className="flex min-h-12 w-full items-center gap-3 border-t border-border px-3 text-left text-sm font-medium text-dropped hover:bg-bg/40 disabled:opacity-60"
                >
                  <LogOut className="size-4" />
                  {signingOut ? "Signing out…" : "Log out"}
                  <ChevronRight className="ml-auto size-4 text-faint" />
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  to,
  onClick,
}: {
  icon: typeof Settings;
  label: string;
  to: "/profile" | "/settings" | "/login";
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex min-h-12 items-center gap-3 border-t border-border px-3 text-sm font-medium first:border-t-0 hover:bg-bg/40"
    >
      <Icon className="size-4 text-muted" />
      {label}
      <ChevronRight className="ml-auto size-4 text-faint" />
    </Link>
  );
}
