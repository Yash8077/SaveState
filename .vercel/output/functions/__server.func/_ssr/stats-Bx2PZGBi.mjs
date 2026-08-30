import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { n as STATUS_LABEL, t as STATUSES } from "./library-schema-ui95MHqq.mjs";
import { o as formatHours, v as RedirectToSignIn, y as useCurrentUserState } from "./router-BQDdMn6j.mjs";
import { t as Skeleton } from "./skeleton-Bb7BAWQU.mjs";
import { t as useLibrary } from "./use-library-B4P7rbg8.mjs";
import { a as Bar, i as CartesianGrid, n as YAxis, o as ResponsiveContainer, r as XAxis, s as Tooltip, t as BarChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/stats-Bx2PZGBi.js
var import_jsx_runtime = require_jsx_runtime();
function StatsPage() {
	const { user, isPending } = useCurrentUserState();
	const library = useLibrary();
	if (isPending || library.isLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-10 w-48" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-40 w-full" })]
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {});
	const entries = library.data ?? [];
	const hours = entries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
	const scored = entries.filter((e) => e.score != null);
	const avg = scored.length > 0 ? scored.reduce((sum, e) => sum + (e.score ?? 0), 0) / scored.length : 0;
	const beatenThisYear = entries.filter((e) => {
		if (e.status !== "beaten" || !e.finishedAt) return false;
		return e.finishedAt.startsWith(String((/* @__PURE__ */ new Date()).getFullYear()));
	}).length;
	const byStatus = STATUSES.map((status) => ({
		name: STATUS_LABEL[status],
		count: entries.filter((e) => e.status === status).length
	}));
	const genreCounts = /* @__PURE__ */ new Map();
	for (const e of entries) for (const g of e.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
	const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({
		name,
		count
	}));
	const scoreBars = Array.from({ length: 10 }, (_, i) => ({
		name: String(i + 1),
		count: entries.filter((e) => e.score === i + 1).length
	}));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-2 min-[600px]:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Logged",
						value: String(entries.length)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Hours",
						value: formatHours(hours)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Average score",
						value: scored.length ? avg.toFixed(1) : "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Beaten this year",
						value: String(beatenThisYear)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "By status",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
					width: "100%",
					height: 240,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
						data: byStatus,
						barCategoryGap: 12,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
								stroke: "var(--color-border)",
								vertical: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
								dataKey: "name",
								tick: {
									fill: "var(--color-faint)",
									fontSize: 11
								},
								axisLine: false,
								tickLine: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
								allowDecimals: false,
								tick: {
									fill: "var(--color-faint)",
									fontSize: 11
								},
								axisLine: false,
								tickLine: false,
								width: 28
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
								cursor: { fill: "color-mix(in oklab, var(--color-fg) 4%, transparent)" },
								contentStyle: tooltipStyle
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
								dataKey: "count",
								fill: "var(--color-accent)",
								radius: [
									8,
									8,
									0,
									0
								]
							})
						]
					})
				})
			}),
			scored.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Score spread",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
					width: "100%",
					height: 220,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
						data: scoreBars,
						barCategoryGap: 8,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
								stroke: "var(--color-border)",
								vertical: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
								dataKey: "name",
								tick: {
									fill: "var(--color-faint)",
									fontSize: 11
								},
								axisLine: false,
								tickLine: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
								allowDecimals: false,
								tick: {
									fill: "var(--color-faint)",
									fontSize: 11
								},
								axisLine: false,
								tickLine: false,
								width: 28
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
								cursor: { fill: "color-mix(in oklab, var(--color-fg) 4%, transparent)" },
								contentStyle: tooltipStyle
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
								dataKey: "count",
								fill: "var(--color-accent)",
								radius: [
									8,
									8,
									0,
									0
								]
							})
						]
					})
				})
			}) : null,
			topGenres.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Genres",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "space-y-2",
					children: topGenres.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: g.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular-nums text-muted",
							children: g.count
						})]
					}, g.name))
				})
			}) : null
		]
	});
}
var tooltipStyle = {
	background: "var(--color-elevated)",
	border: "1px solid var(--color-border)",
	borderRadius: 12,
	color: "var(--color-fg)",
	fontSize: 12
};
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl bg-elevated px-4 py-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-faint",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-2xl font-medium tabular-nums tracking-tight",
			children: value
		})]
	});
}
function ChartCard({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl bg-elevated p-4 sm:p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mb-4 text-base font-medium",
			children: title
		}), children]
	});
}
//#endregion
export { StatsPage as component };
