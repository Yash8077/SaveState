import { o as __toESM } from "../_runtime.mjs";
import { a as useQueryClient, i as QueryClientProvider, o as require_jsx_runtime, s as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { S as useRouter, _ as createFileRoute, b as Navigate, d as HeadContent, f as useRouterState, g as lazyRouteComponent, h as Outlet, m as createRouter, u as Scripts, v as createRootRoute, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as getServerFnById, c as __exportAll, i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { bn as union, gn as object, hn as number, pn as literal, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { a as authMiddleware, i as addToLibraryInput, o as listLibraryInput, r as addCustomGameInput, s as updateEntryInput } from "./library-schema-ui95MHqq.mjs";
import { i as signOut, t as authClient } from "./client-CVqXY6bk.mjs";
import { n as auth } from "./server-DUCxmiPA.mjs";
import { d as ArrowLeft, i as Search, l as Compass, o as Library, s as House, t as TriangleAlert, u as ChartColumn } from "../_libs/lucide-react.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-current-user-ClOiUQ-z.js
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	const { data, isPending } = authClient.useSession();
	const user = data?.user;
	return {
		user: user ? {
			id: user.id,
			displayName: user.name ?? null,
			primaryEmail: user.email ?? null,
			profileImageUrl: user.image ?? null,
			isDevFallback: false
		} : null,
		isPending
	};
}
/**
* Convenience view of `useCurrentUserState().user` for display (e.g.
* `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
* for redirects/guards use `useCurrentUserState()` and check `isPending`.
*/
function useCurrentUser() {
	return useCurrentUserState().user;
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/router-BQDdMn6j.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-dropped",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-medium",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-muted",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
/**
* Auth state components — plain wrappers around `useCurrentUserState()`.
*
* With auth on, visitors are signed out until they authenticate — in the sandbox
* live preview too, which does real sign-in. The shared dev user appears only
* when auth is disabled (`VITE_AUTH_ENABLED=false`, the shipped default).
* While the session is still resolving, gates that care about signed-out state
* render nothing so there's no signed-out flash on hard reload.
*/
/** Where `RedirectToSignIn` sends signed-out visitors. Create this route. */
var SIGN_IN_PATH = "/login";
/**
* Client-side redirect to the sign-in route (TanStack `<Navigate>` — NOT a full
* `window.location` reload). A hard navigation re-bootstraps the SPA and re-runs
* session loading, which feels like a second "Loading…" on /login.
*
* Guard routes by waiting out `isPending` first (see `use-current-user`), then
* render this.
*/
function RedirectToSignIn({ to = SIGN_IN_PATH }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to });
}
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of).
*/
function UserButton() {
	const user = useCurrentUser();
	const [signingOut, setSigningOut] = (0, import_react.useState)(false);
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "h-8 w-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20",
				children: label.charAt(0).toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: signingOut,
				onClick: () => {
					setSigningOut(true);
					signOut().catch(() => setSigningOut(false));
				},
				className: "cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline",
				children: signingOut ? "Signing out…" : "Sign out"
			})
		]
	});
}
function useMounted() {
	const [mounted, setMounted] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => setMounted(true), []);
	return mounted;
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
async function catalogGet(url, signal) {
	const res = await fetch(url, {
		signal,
		headers: { Accept: "application/json" }
	});
	if (res.status === 429) throw new Error("Too many requests");
	if (!res.ok) throw new Error("Catalog request failed");
	return await res.json();
}
function searchGames(q, signal) {
	return catalogGet(`/api/catalog/search?q=${encodeURIComponent(q)}`, signal);
}
function getCatalogGame(id, signal) {
	return catalogGet(`/api/catalog/game?id=${encodeURIComponent(id)}`, signal);
}
function getFeaturedRails(signal) {
	return catalogGet("/api/catalog/featured", signal);
}
var listLibrary = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(listLibraryInput).handler(createSsrRpc("1bf37280c0c6b80b9ba6963d2a55e75dbde04d0dfd9ece0166e3183f979c25f4"));
var addToLibrary = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(addToLibraryInput).handler(createSsrRpc("8553d862aadfc738536e5d1827229fe51ae785ed85da2cfe154ae61449c5c014"));
var addCustomGame = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(addCustomGameInput).handler(createSsrRpc("c0f29acad5b84303be36bd9c19e197d83a10b99bfce57b0a107beb605871c83a"));
var updateEntry = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(updateEntryInput).handler(createSsrRpc("945a48daea4d7604d324408eb041748924bbc1bbc39724fdef0bc4ec6c28b9e7"));
var removeEntry = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ id: number().int() })).handler(createSsrRpc("120083326ba73d4cade6c2e12dfbbfe8c3f6fe395ac17db5b2f307afcdb041d1"));
function snapshotFromDetails(details) {
	return {
		title: details.title,
		coverUrl: details.coverUrl,
		headerUrl: details.headerUrl,
		summary: details.summary ?? null,
		releaseDate: details.releaseDate ?? null,
		platforms: details.platforms,
		genres: details.genres ?? [],
		metacritic: details.metacritic,
		developers: details.developers ?? [],
		publishers: details.publishers ?? [],
		screenshots: details.screenshots ?? []
	};
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function formatHours(hours) {
	if (hours == null || Number.isNaN(hours)) return "—";
	if (hours === 0) return "0h";
	if (hours < 10) return `${hours.toFixed(1).replace(/\.0$/, "")}h`;
	return `${Math.round(hours)}h`;
}
var STEAM_IMG = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";
function steamPortraitUrl(catalogId) {
	const match = /^steam_(\d+)$/.exec(catalogId);
	return match ? `${STEAM_IMG}/${match[1]}/library_600x900.jpg` : null;
}
var NAV = [
	{
		to: "/",
		label: "Home",
		icon: House
	},
	{
		to: "/discover",
		label: "Discover",
		icon: Compass
	},
	{
		to: "/search",
		label: "Browse",
		icon: Search
	},
	{
		to: "/library",
		label: "Library",
		icon: Library
	},
	{
		to: "/stats",
		label: "Stats",
		icon: ChartColumn
	}
];
var TITLES = {
	"/": "Home",
	"/discover": "Discover",
	"/search": "Browse",
	"/library": "Library",
	"/stats": "Stats"
};
function isActive(pathname, to) {
	if (to === "/") return pathname === "/";
	return pathname === to || pathname.startsWith(`${to}/`);
}
function pageTitle(pathname) {
	if (pathname.startsWith("/game/")) return "Details";
	return TITLES[pathname] ?? "SaveState";
}
function AuthSlot() {
	const mounted = useMounted();
	const { user, isPending } = useCurrentUserState();
	if (!mounted || isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-10 animate-pulse rounded-full bg-subtle" });
	if (user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "max-w-40 [&_span.text-sm]:hidden sm:[&_span.text-sm]:inline [&_img]:size-10 [&_button]:min-h-10 [&_button]:rounded-full [&_button]:px-3 [&_button]:text-xs [&_button]:text-muted hover:[&_button]:text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/login",
		className: "inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-fg",
		children: "Sign in"
	});
}
function NavItem({ to, label, icon: Icon, active, rail }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to,
		className: cn("flex select-none items-center justify-center rounded-xl text-muted transition-colors duration-150", rail ? "h-16 w-16 flex-col gap-0.5" : "min-h-12 flex-1 flex-col gap-0.5", active && "text-fg"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: cn("grid place-items-center rounded-full transition-colors duration-150", rail ? "h-8 w-14" : "h-8 w-16", active && "bg-accent/20 text-accent"),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
				className: "size-5",
				strokeWidth: active ? 2.4 : 1.8
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: cn("text-xs font-medium", active && "text-fg"),
			children: label
		})]
	});
}
function AppShell({ children }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const router = useRouter();
	const qc = useQueryClient();
	const isDetails = pathname.startsWith("/game/");
	(0, import_react.useEffect)(() => {
		qc.prefetchQuery({
			queryKey: ["featured"],
			queryFn: ({ signal }) => getFeaturedRails(signal),
			staleTime: 18e5
		});
	}, [qc]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh bg-bg text-fg pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center gap-1 bg-elevated py-3 min-[600px]:flex short:py-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "mb-2 grid size-12 place-items-center rounded-xl bg-accent text-lg font-medium text-accent-fg",
					"aria-label": "SaveState home",
					children: "S"
				}), NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavItem, {
					...item,
					active: isActive(pathname, item.to),
					rail: true
				}, item.to))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "sticky top-0 z-30 flex min-h-14 shrink-0 items-center gap-1 bg-bg/92 px-1 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:min-h-16 sm:px-3",
					children: [
						isDetails ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-label": "Back",
							onClick: () => router.history.back(),
							className: "grid size-12 place-items-center rounded-full text-fg hover:bg-subtle",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-5" })
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "min-w-0 truncate px-2 text-xl font-medium tracking-tight",
							children: pageTitle(pathname)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ml-auto flex items-center gap-1 pr-1",
							children: [pathname !== "/search" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/search",
								"aria-label": "Search",
								className: "grid size-12 place-items-center rounded-full text-fg hover:bg-subtle",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-5" })
							}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthSlot, {})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "mx-auto w-full max-w-[1400px] flex-1 px-3 pt-2 pb-[5.5rem] sm:px-5 sm:pt-3 min-[600px]:pb-6",
					children
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "fixed inset-x-0 bottom-0 z-30 bg-elevated/95 backdrop-blur-md min-[600px]:hidden",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex w-full px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]",
					children: NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavItem, {
						...item,
						active: isActive(pathname, item.to)
					}, item.to))
				})
			})
		]
	});
}
var styles_default = "/assets/styles-BBUgsOB-.css";
var APP_NAME = "SaveState";
var Route$13 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "A synced game log. Track what you are playing, beating, and still meaning to start."
			},
			{
				name: "theme-color",
				content: "#0f1416"
			},
			{
				name: "mobile-web-app-capable",
				content: "yes"
			},
			{
				name: "apple-mobile-web-app-capable",
				content: "yes"
			},
			{
				name: "apple-mobile-web-app-status-bar-style",
				content: "black-translucent"
			},
			{
				name: "color-scheme",
				content: "dark"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "preconnect",
				href: "https://store.steampowered.com"
			},
			{
				rel: "preconnect",
				href: "https://api.igdb.com"
			},
			{
				rel: "preconnect",
				href: "https://images.igdb.com"
			},
			{
				rel: "preconnect",
				href: "https://id.twitch.tv"
			},
			{
				rel: "preconnect",
				href: "https://shared.akamai.steamstatic.com"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
			}
		]
	}),
	component: RootDocument
});
function RootDocument() {
	const [queryClient] = (0, import_react.useState)(() => new QueryClient({ defaultOptions: { queries: {
		staleTime: 6e5,
		gcTime: 18e5,
		retry: 0,
		refetchOnWindowFocus: false
	} } }));
	const isLogin = useRouterState({ select: (s) => s.location.pathname }) === "/login";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "dark antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "bg-bg text-fg",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(QueryClientProvider, {
					client: queryClient,
					children: [isLogin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
						theme: "dark",
						position: "bottom-center",
						offset: 72,
						toastOptions: { className: "bg-elevated text-fg border border-border rounded-lg" }
					})]
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	});
}
var $$splitComponentImporter$6 = () => import("./routes-ChZNrHIa.mjs");
var Route$12 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./discover-BAJx34Jm.mjs");
var Route$11 = createFileRoute("/discover")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./library-CVVK8mg8.mjs");
var Route$10 = createFileRoute("/library")({
	validateSearch: (search) => ({ status: typeof search.status === "string" ? search.status : "all" }),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("./login-fSwT_EiE.mjs");
var Route$9 = createFileRoute("/login")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./search-BLFWURzw.mjs");
var Route$8 = createFileRoute("/search")({
	validateSearch: (search) => ({ q: typeof search.q === "string" ? search.q : "" }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./stats-Bx2PZGBi.mjs");
var Route$7 = createFileRoute("/stats")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var Route$6 = createFileRoute("/api/library")({ server: { handlers: {
	GET: async ({ request }) => {
		const { requireApiUser, apiErrorResponse, apiJson } = await import("./api-auth.server-2TfEMW9h.mjs");
		try {
			const userId = await requireApiUser(request);
			const { getSql } = await import("./db-DSuCMacl.mjs").then((n) => n.t).then((n) => n.t);
			const { listLibraryPage } = await import("./library.server-DbyPKalJ.mjs");
			const url = new URL(request.url);
			const cursor = url.searchParams.get("cursor");
			const limitRaw = url.searchParams.get("limit");
			const limit = limitRaw ? Number(limitRaw) : 50;
			if (limitRaw && (!Number.isInteger(limit) || limit < 1 || limit > 100)) return apiJson({ error: "Invalid limit" }, 400);
			return apiJson(await listLibraryPage(await getSql(), userId, {
				cursor,
				limit
			}));
		} catch (err) {
			return apiErrorResponse(err);
		}
	},
	POST: async ({ request }) => {
		const { requireApiUser, apiErrorResponse, apiJson } = await import("./api-auth.server-2TfEMW9h.mjs");
		try {
			const userId = await requireApiUser(request);
			const body = await request.json();
			const { getSql } = await import("./db-DSuCMacl.mjs").then((n) => n.t).then((n) => n.t);
			const lib = await import("./library.server-DbyPKalJ.mjs");
			const sql = await getSql();
			const catalog = addToLibraryInput.safeParse(body);
			if (catalog.success) return apiJson(await lib.addToLibraryRow(sql, userId, catalog.data), 201);
			const custom = addCustomGameInput.safeParse(body);
			if (custom.success) return apiJson(await lib.addCustomGameRow(sql, userId, custom.data), 201);
			return apiJson({ error: "Invalid body" }, 400);
		} catch (err) {
			return apiErrorResponse(err);
		}
	}
} } });
var $$splitComponentImporter = () => import("./game._catalogId-C_uqo7qW.mjs");
var Route$5 = createFileRoute("/game/$catalogId")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var Route$4 = createFileRoute("/api/auth/$")({ server: { handlers: {
	GET: ({ request }) => auth.handler(request),
	POST: ({ request }) => auth.handler(request)
} } });
var Route$3 = createFileRoute("/api/catalog/featured")({ server: { handlers: { GET: async ({ request }) => {
	const { catalogRateLimitResponse } = await import("./rate-limit.server-D2oL57C0.mjs");
	const limited = catalogRateLimitResponse(request);
	if (limited) return limited;
	const { catalogJson, fetchFeaturedRails } = await import("./catalog.server-CS5_Aype.mjs");
	return catalogJson(await fetchFeaturedRails(), 300);
} } } });
var Route$2 = createFileRoute("/api/catalog/game")({ server: { handlers: { GET: async ({ request }) => {
	const { catalogRateLimitResponse } = await import("./rate-limit.server-D2oL57C0.mjs");
	const limited = catalogRateLimitResponse(request);
	if (limited) return limited;
	const id = new URL(request.url).searchParams.get("id") ?? "";
	const { catalogJson, fetchCatalogDetails } = await import("./catalog.server-CS5_Aype.mjs");
	return catalogJson(id ? await fetchCatalogDetails(id) : null, 600);
} } } });
var Route$1 = createFileRoute("/api/catalog/search")({ server: { handlers: { GET: async ({ request }) => {
	const { catalogRateLimitResponse } = await import("./rate-limit.server-D2oL57C0.mjs");
	const limited = catalogRateLimitResponse(request);
	if (limited) return limited;
	const q = new URL(request.url).searchParams.get("q") ?? "";
	const { catalogJson, searchCatalog } = await import("./catalog.server-CS5_Aype.mjs");
	return catalogJson(await searchCatalog(q), 120);
} } } });
var Route = createFileRoute("/api/library/$id")({ server: { handlers: {
	PATCH: async ({ request, params }) => {
		const { requireApiUser, apiErrorResponse, apiJson } = await import("./api-auth.server-2TfEMW9h.mjs");
		try {
			const userId = await requireApiUser(request);
			const id = Number(params.id);
			if (!Number.isInteger(id)) return apiJson({ error: "Invalid id" }, 400);
			const body = await request.json();
			const parsed = updateEntryInput.safeParse({
				...typeof body === "object" && body ? body : {},
				id
			});
			if (!parsed.success) return apiJson({ error: "Invalid body" }, 400);
			const { getSql } = await import("./db-DSuCMacl.mjs").then((n) => n.t).then((n) => n.t);
			const { updateEntryRow } = await import("./library.server-DbyPKalJ.mjs");
			return apiJson(await updateEntryRow(await getSql(), userId, parsed.data));
		} catch (err) {
			return apiErrorResponse(err);
		}
	},
	DELETE: async ({ request, params }) => {
		const { requireApiUser, apiErrorResponse, apiJson } = await import("./api-auth.server-2TfEMW9h.mjs");
		try {
			const userId = await requireApiUser(request);
			const id = Number(params.id);
			if (!Number.isInteger(id)) return apiJson({ error: "Invalid id" }, 400);
			const { getSql } = await import("./db-DSuCMacl.mjs").then((n) => n.t).then((n) => n.t);
			const { removeEntryRow } = await import("./library.server-DbyPKalJ.mjs");
			return apiJson(await removeEntryRow(await getSql(), userId, id));
		} catch (err) {
			return apiErrorResponse(err);
		}
	}
} } });
var IndexRoute = Route$12.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$13
});
var DiscoverRoute = Route$11.update({
	id: "/discover",
	path: "/discover",
	getParentRoute: () => Route$13
});
var LibraryRoute = Route$10.update({
	id: "/library",
	path: "/library",
	getParentRoute: () => Route$13
});
var LoginRoute = Route$9.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$13
});
var SearchRoute = Route$8.update({
	id: "/search",
	path: "/search",
	getParentRoute: () => Route$13
});
var StatsRoute = Route$7.update({
	id: "/stats",
	path: "/stats",
	getParentRoute: () => Route$13
});
var ApiLibraryRoute = Route$6.update({
	id: "/api/library",
	path: "/api/library",
	getParentRoute: () => Route$13
});
var GameCatalogIdRoute = Route$5.update({
	id: "/game/$catalogId",
	path: "/game/$catalogId",
	getParentRoute: () => Route$13
});
var ApiAuthSplatRoute = Route$4.update({
	id: "/api/auth/$",
	path: "/api/auth/$",
	getParentRoute: () => Route$13
});
var ApiCatalogFeaturedRoute = Route$3.update({
	id: "/api/catalog/featured",
	path: "/api/catalog/featured",
	getParentRoute: () => Route$13
});
var ApiCatalogGameRoute = Route$2.update({
	id: "/api/catalog/game",
	path: "/api/catalog/game",
	getParentRoute: () => Route$13
});
var ApiCatalogSearchRoute = Route$1.update({
	id: "/api/catalog/search",
	path: "/api/catalog/search",
	getParentRoute: () => Route$13
});
var ApiLibraryRouteChildren = { ApiLibraryIdRoute: Route.update({
	id: "/$id",
	path: "/$id",
	getParentRoute: () => ApiLibraryRoute
}) };
var rootRouteChildren = {
	IndexRoute,
	DiscoverRoute,
	LibraryRoute,
	LoginRoute,
	SearchRoute,
	StatsRoute,
	ApiLibraryRoute: ApiLibraryRoute._addFileChildren(ApiLibraryRouteChildren),
	GameCatalogIdRoute,
	ApiAuthSplatRoute,
	ApiCatalogFeaturedRoute,
	ApiCatalogGameRoute,
	ApiCatalogSearchRoute
};
var routeTree = Route$13._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 3e4,
		defaultPreloadDelay: 50
	});
}
//#endregion
export { useMounted as _, cn as a, addCustomGame as c, getFeaturedRails as d, listLibrary as f, updateEntry as g, snapshotFromDetails as h, Route$10 as i, addToLibrary as l, searchGames as m, Route$5 as n, formatHours as o, removeEntry as p, Route$8 as r, steamPortraitUrl as s, router_exports as t, getCatalogGame as u, RedirectToSignIn as v, useCurrentUserState as y };
