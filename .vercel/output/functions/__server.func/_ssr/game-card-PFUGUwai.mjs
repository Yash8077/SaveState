import { a as useQueryClient, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as Star } from "../_libs/lucide-react.mjs";
import { a as cn, o as formatHours, u as getCatalogGame } from "./router-BQDdMn6j.mjs";
import { n as StatusBadge, t as Poster } from "./status-badge-2RUqgiof.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/game-card-PFUGUwai.js
var import_jsx_runtime = require_jsx_runtime();
function GameRail({ title, action, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "space-y-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-base font-medium",
				children: title
			}), action]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "rail-scroll",
			children
		})]
	});
}
function GameCard({ catalogId, title, coverUrl, headerUrl, status, score, hours, favorite, size = "rail", priority = false }) {
	const qc = useQueryClient();
	function prefetch() {
		if (catalogId.startsWith("custom_")) return;
		qc.setQueryData(["catalog-preview", catalogId], {
			title,
			coverUrl: coverUrl ?? null,
			headerUrl: headerUrl ?? null
		});
		qc.prefetchQuery({
			queryKey: ["catalog-game", catalogId],
			queryFn: ({ signal }) => getCatalogGame(catalogId, signal),
			staleTime: 6e5
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/game/$catalogId",
		params: { catalogId },
		preload: "intent",
		onPointerEnter: prefetch,
		onFocus: prefetch,
		className: cn("group relative block shrink-0 snap-start outline-none", "transition-transform duration-150 ease-[var(--ease-smooth-out)]", "active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent/60", size === "rail" ? "w-[7.25rem] sm:w-[8.25rem] expanded:w-[9rem]" : "w-full"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Poster, {
				title,
				coverUrl,
				headerUrl,
				priority,
				className: "aspect-2/3 w-full rounded-lg"
			}),
			favorite ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-bg/75 text-accent",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: "size-3.5 fill-current" })
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1.5 line-clamp-2 text-xs font-medium leading-snug text-fg",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-1 flex flex-wrap items-center gap-1",
				children: [
					status && size === "rail" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status }) : null,
					score ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-xs tabular-nums text-muted",
						children: [score, "/10"]
					}) : null,
					hours != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs tabular-nums text-faint",
						children: formatHours(hours)
					}) : null
				]
			})
		]
	});
}
//#endregion
export { GameRail as n, GameCard as t };
