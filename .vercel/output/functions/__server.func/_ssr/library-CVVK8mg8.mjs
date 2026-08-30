import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as STATUS_LABEL, t as STATUSES } from "./library-schema-ui95MHqq.mjs";
import { a as cn, i as Route$10, v as RedirectToSignIn, y as useCurrentUserState } from "./router-BQDdMn6j.mjs";
import { t as GameCard } from "./game-card-PFUGUwai.mjs";
import { t as Skeleton } from "./skeleton-Bb7BAWQU.mjs";
import { t as useLibrary } from "./use-library-B4P7rbg8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/library-CVVK8mg8.js
var import_jsx_runtime = require_jsx_runtime();
function LibraryPage() {
	const { user, isPending } = useCurrentUserState();
	const { status = "all" } = Route$10.useSearch();
	const library = useLibrary();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibrarySkeleton, {});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {});
	const filtered = (library.data ?? []).filter((e) => {
		if (status === "favorites") return e.favorite;
		if (status === "all" || !status) return true;
		return e.status === status;
	});
	const filters = [
		{
			id: "all",
			label: "All"
		},
		{
			id: "favorites",
			label: "Favorites"
		},
		...STATUSES.map((s) => ({
			id: s,
			label: STATUS_LABEL[s]
		}))
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "chip-scroll",
				children: filters.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/library",
					search: { status: f.id },
					className: cn("h-9 shrink-0 rounded-full px-3.5 text-sm leading-9 font-medium", status === f.id ? "bg-accent text-accent-fg" : "bg-subtle text-muted"),
					children: f.label
				}, f.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [
					filtered.length,
					" title",
					filtered.length === 1 ? "" : "s"
				]
			}),
			library.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibrarySkeleton, {}) : null,
			!library.isLoading && filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-elevated px-4 py-10 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-lg font-medium",
						children: "Nothing here yet"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Browse the catalog or add a custom title."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/search",
						className: "mt-4 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg",
						children: "Browse games"
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "poster-grid",
				children: filtered.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCard, {
					catalogId: e.catalogId,
					title: e.title,
					coverUrl: e.coverUrl,
					headerUrl: e.headerUrl,
					status: e.status,
					score: e.score,
					hours: e.hours,
					favorite: e.favorite,
					size: "grid"
				}, e.id))
			})
		]
	});
}
function LibrarySkeleton() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "poster-grid",
		children: Array.from({ length: 12 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "aspect-2/3 w-full rounded-lg" }, i))
	});
}
//#endregion
export { LibraryPage as component };
