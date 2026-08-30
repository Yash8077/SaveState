import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { authClient, authEnabled } from "@/lib/auth/client";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({ component: Login });

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.72.12-1.41.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.47 1.18 4.93l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
      />
    </svg>
  );
}

function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const config = useQuery({
    queryKey: ["public-config"],
    queryFn: async () => {
      const res = await fetch("/api/config");
      if (!res.ok) return { google: false };
      return (await res.json()) as { google?: boolean };
    },
    staleTime: 60_000,
  });
  const googleOn = Boolean(config.data?.google);

  async function onGoogle() {
    setError(null);
    setBusy(true);
    try {
      const { error: fail, data } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
      if (fail) throw new Error(fail.message || "Google sign-in failed");
      if (data?.url) window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await authClient.signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0] || "Player",
          callbackURL: "/",
        });
        if (res.error) throw new Error(res.error.message || "Could not create account");
      } else {
        const res = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/",
        });
        if (res.error) throw new Error(res.error.message || "Could not sign in");
      }
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-bg px-5 py-10 text-fg pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <Link
        to="/"
        className="grid size-14 place-items-center rounded-2xl bg-subtle"
        aria-label="SaveState home"
      >
        <BrandMark className="size-10" title="SaveState" />
      </Link>
      <h1 className="mt-5 text-3xl font-medium tracking-tight">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Your library syncs with this account. No Steam or PSN login.
      </p>

      {authEnabled && googleOn ? (
        <div className="mt-6">
          <Button
            variant="secondary"
            className="w-full gap-2"
            disabled={busy}
            onClick={() => void onGoogle()}
          >
            <GoogleMark />
            Continue with Google
          </Button>
        </div>
      ) : null}

      <div className="my-5 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-border" />
        or email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form className="space-y-3" onSubmit={onEmail}>
        {mode === "signup" ? (
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        ) : null}
        <Input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Input
          type="password"
          required
          minLength={8}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {error ? <p className="text-sm text-dropped">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in with email"
              : "Create account"}
        </Button>
      </form>

      <button
        type="button"
        className="mt-4 min-h-12 text-sm text-muted hover:text-fg"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
      >
        {mode === "signin"
          ? "Need an account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
