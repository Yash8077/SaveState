import { useState } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppearanceProvider } from "@/components/appearance-provider";
import { CatalogProviderGate } from "@/components/catalog-provider";
import { AppShell } from "@/components/app-shell";
import appCss from "../styles.css?url";

const APP_NAME = "SaveState";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
      },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "A synced game log. Track what you are playing, beating, and still meaning to start.",
      },
      { name: "theme-color", content: "#0f1416" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "color-scheme", content: "dark" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      { rel: "preconnect", href: "https://store.steampowered.com" },
      { rel: "preconnect", href: "https://api.igdb.com" },
      { rel: "preconnect", href: "https://images.igdb.com" },
      { rel: "preconnect", href: "https://id.twitch.tv" },
      {
        rel: "preconnect",
        href: "https://shared.akamai.steamstatic.com",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 60_000,
            gcTime: 30 * 60_000,
            retry: 0,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLogin = pathname === "/login";

  return (
    <html lang="en" className="dark antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <AppearanceProvider>
        <CatalogProviderGate>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            {isLogin ? (
              <Outlet />
            ) : (
              <AppShell>
                <Outlet />
              </AppShell>
            )}
            <Toaster
              theme="dark"
              position="bottom-center"
              offset={72}
              toastOptions={{
                className: "bg-elevated text-fg border border-border rounded-lg",
              }}
            />
          </QueryClientProvider>
        </AuthProvider>
        </CatalogProviderGate>
        </AppearanceProvider>
        <Scripts />
      </body>
    </html>
  );
}
