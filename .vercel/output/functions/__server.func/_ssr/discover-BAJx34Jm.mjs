import { o as require_jsx_runtime, r as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { t as FEATURED_SEED } from "./catalog-seed-GyIvdhCE.mjs";
import { _ as useMounted, d as getFeaturedRails } from "./router-BQDdMn6j.mjs";
import { n as GameRail, t as GameCard } from "./game-card-PFUGUwai.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/discover-BAJx34Jm.js
var import_jsx_runtime = require_jsx_runtime();
function Discover() {
	const mounted = useMounted();
	const featured = useQuery({
		queryKey: ["featured"],
		queryFn: ({ signal }) => getFeaturedRails(signal),
		staleTime: 18e5,
		placeholderData: FEATURED_SEED,
		enabled: mounted
	});
	const rails = featured.data ?? FEATURED_SEED;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-7",
		children: [featured.isError && rails.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-dropped",
			children: "Catalog is unavailable. Try Browse, or add a custom title."
		}) : null, rails.map((rail, railIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameRail, {
			title: rail.title,
			children: rail.games.map((g, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCard, {
				catalogId: g.id,
				title: g.title,
				coverUrl: g.coverUrl,
				headerUrl: g.headerUrl,
				priority: railIndex === 0 && i < 6
			}, `${rail.id}-${g.id}`))
		}, rail.id))]
	});
}
//#endregion
export { Discover as component };
