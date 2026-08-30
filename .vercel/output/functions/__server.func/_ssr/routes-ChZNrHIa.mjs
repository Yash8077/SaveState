import { o as require_jsx_runtime, r as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as FEATURED_SEED } from "./catalog-seed-GyIvdhCE.mjs";
import { _ as useMounted, d as getFeaturedRails, o as formatHours, y as useCurrentUserState } from "./router-BQDdMn6j.mjs";
import { n as GameRail, t as GameCard } from "./game-card-PFUGUwai.mjs";
import { t as useLibrary } from "./use-library-B4P7rbg8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-ChZNrHIa.js
var import_jsx_runtime = require_jsx_runtime();
function Home() {
	const mounted = useMounted();
	const { user } = useCurrentUserState();
	const library = useLibrary();
	const featured = useQuery({
		queryKey: ["featured"],
		queryFn: ({ signal }) => getFeaturedRails(signal),
		staleTime: 18e5,
		placeholderData: FEATURED_SEED,
		enabled: mounted
	});
	const entries = library.data ?? [];
	const playing = entries.filter((e) => e.status === "playing");
	const backlog = entries.filter((e) => e.status === "backlog");
	const beaten = entries.filter((e) => e.status === "beaten");
	const favorites = entries.filter((e) => e.favorite);
	const hours = entries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
	const signedIn = mounted && Boolean(user);
	const name = user?.displayName?.split(" ")[0];
	const rails = featured.data ?? FEATURED_SEED;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-7",
		children: [
			!signedIn && mounted ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-2xl font-medium tracking-tight",
				children: "Your games"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Log what you play. Syncs across phones and tablets."
			})] }) : null,
			signedIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [name ? `Welcome back, ${name}` : "Welcome back", hours > 0 ? ` · ${formatHours(hours)} logged` : ""]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "chip-scroll mt-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Playing",
						value: String(playing.length)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Beaten",
						value: String(beaten.length)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Backlog",
						value: String(backlog.length)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Favorites",
						value: String(favorites.length)
					})
				]
			})] }) : null,
			playing.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameRail, {
				title: "Continue playing",
				action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/library",
					className: "text-sm font-medium text-accent",
					children: "All"
				}),
				children: playing.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCard, {
					catalogId: e.catalogId,
					title: e.title,
					coverUrl: e.coverUrl,
					headerUrl: e.headerUrl,
					status: e.status,
					score: e.score,
					hours: e.hours,
					favorite: e.favorite
				}, e.id))
			}) : null,
			backlog.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameRail, {
				title: "Backlog",
				children: backlog.slice(0, 16).map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCard, {
					catalogId: e.catalogId,
					title: e.title,
					coverUrl: e.coverUrl,
					headerUrl: e.headerUrl,
					status: e.status,
					favorite: e.favorite
				}, e.id))
			}) : null,
			beaten.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameRail, {
				title: "Recently beaten",
				children: beaten.slice(0, 12).map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCard, {
					catalogId: e.catalogId,
					title: e.title,
					coverUrl: e.coverUrl,
					headerUrl: e.headerUrl,
					status: e.status,
					score: e.score
				}, e.id))
			}) : null,
			signedIn && !library.isLoading && entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-elevated px-4 py-8 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-lg font-medium",
						children: "Library is empty"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Search the catalog and add something you are playing."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/search",
						className: "mt-4 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg",
						children: "Browse games"
					})
				]
			}) : null,
			rails.map((rail, railIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameRail, {
				title: rail.title,
				children: rail.games.map((g, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCard, {
					catalogId: g.id,
					title: g.title,
					coverUrl: g.coverUrl,
					headerUrl: g.headerUrl,
					priority: railIndex === 0 && i < 6
				}, `${rail.id}-${g.id}`))
			}, rail.id))
		]
	});
}
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "shrink-0 rounded-full bg-elevated px-3.5 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-sm font-medium tabular-nums",
			children: value
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "ml-1.5 text-sm text-muted",
			children: label
		})]
	});
}
//#endregion
export { Home as component };
