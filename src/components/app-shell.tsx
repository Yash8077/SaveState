import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  Compass,
  House,
  Library,
  Search,
} from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMounted } from "@/hooks/use-mounted";
import { getFeaturedRails } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: House },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/search", label: "Browse", icon: Search },
  { to: "/library", label: "Library", icon: Library },
  { to: "/stats", label: "Stats", icon: BarChart3 },
] as const;

const TITLES: Record<string, string> = {
  "/": "Home",
  "/discover": "Discover",
  "/search": "Browse",
  "/library": "Library",
  "/stats": "Stats",
};

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function pageTitle(pathname: string) {
  if (pathname.startsWith("/game/")) return "Details";
  return TITLES[pathname] ?? "SaveState";
}

function AuthSlot() {
  const mounted = useMounted();
  const { user, isPending } = useCurrentUserState();
  if (!mounted || isPending) {
    return <div className="size-10 animate-pulse rounded-full bg-subtle" />;
  }
  if (user) {
    return (
      <div className="max-w-40 [&_span.text-sm]:hidden sm:[&_span.text-sm]:inline [&_img]:size-10 [&_button]:min-h-10 [&_button]:rounded-full [&_button]:px-3 [&_button]:text-xs [&_button]:text-muted hover:[&_button]:text-fg">
        <UserButton />
      </div>
    );
  }
  return (
    <Link
      to="/login"
      className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-fg"
    >
      Sign in
    </Link>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  rail,
}: {
  to: string;
  label: string;
  icon: typeof House;
  active: boolean;
  rail?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex select-none items-center justify-center rounded-xl text-muted transition-colors duration-150",
        rail ? "h-16 w-16 flex-col gap-0.5" : "min-h-12 flex-1 flex-col gap-0.5",
        active && "text-fg",
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-full transition-colors duration-150",
          rail ? "h-8 w-14" : "h-8 w-16",
          active && "bg-accent/20 text-accent",
        )}
      >
        <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
      </span>
      <span className={cn("text-xs font-medium", active && "text-fg")}>
        {label}
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });
  const router = useRouter();
  const qc = useQueryClient();
  const isDetails = pathname.startsWith("/game/");

  useEffect(() => {
    void qc.prefetchQuery({
      queryKey: ["featured"],
      queryFn: ({ signal }) => getFeaturedRails(signal),
      staleTime: 30 * 60_000,
    });
  }, [qc]);

  return (
    <div className="flex min-h-dvh bg-bg text-fg pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center gap-1 bg-elevated py-3 min-[600px]:flex short:py-1">
        <Link
          to="/"
          className="mb-2 grid size-12 place-items-center rounded-xl bg-accent text-lg font-medium text-accent-fg"
          aria-label="SaveState home"
        >
          S
        </Link>
        {NAV.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            active={isActive(pathname, item.to)}
            rail
          />
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center gap-1 bg-bg/92 px-1 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:min-h-16 sm:px-3">
          {isDetails ? (
            <button
              type="button"
              aria-label="Back"
              onClick={() => router.history.back()}
              className="grid size-12 place-items-center rounded-full text-fg hover:bg-subtle"
            >
              <ArrowLeft className="size-5" />
            </button>
          ) : null}
          <h1 className="min-w-0 truncate px-2 text-xl font-medium tracking-tight">
            {pageTitle(pathname)}
          </h1>
          <div className="ml-auto flex items-center gap-1 pr-1">
            {pathname !== "/search" ? (
              <Link
                to="/search"
                aria-label="Search"
                className="grid size-12 place-items-center rounded-full text-fg hover:bg-subtle"
              >
                <Search className="size-5" />
              </Link>
            ) : null}
            <AuthSlot />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 pt-2 pb-[5.5rem] sm:px-5 sm:pt-3 min-[600px]:pb-6">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 bg-elevated/95 backdrop-blur-md min-[600px]:hidden">
        <div className="flex w-full px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
          {NAV.map((item) => (
            <NavItem
              key={item.to}
              {...item}
              active={isActive(pathname, item.to)}
            />
          ))}
        </div>
      </nav>
    </div>
  );
}
