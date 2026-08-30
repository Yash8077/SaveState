import { o as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { n as STATUS_LABEL } from "./library-schema-ui95MHqq.mjs";
import { a as cn } from "./router-BQDdMn6j.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/status-badge-2RUqgiof.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Poster({ title, coverUrl, headerUrl, className, priority = false }) {
	const primary = coverUrl || headerUrl || null;
	const fallback = coverUrl && headerUrl && coverUrl !== headerUrl ? headerUrl : null;
	const [src, setSrc] = (0, import_react.useState)(primary);
	(0, import_react.useEffect)(() => {
		setSrc(primary);
	}, [primary]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("relative isolate overflow-hidden bg-subtle", className),
		children: src ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src,
			alt: "",
			loading: priority ? "eager" : "lazy",
			fetchPriority: priority ? "high" : "low",
			decoding: "async",
			className: "size-full object-cover object-center outline outline-1 -outline-offset-1 outline-white/10",
			onError: () => {
				if (fallback && src !== fallback) setSrc(fallback);
				else setSrc(null);
			}
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex size-full items-end bg-elevated p-2.5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium leading-tight text-fg/90",
				children: title
			})
		})
	});
}
var TONE = {
	playing: "text-playing bg-playing/12",
	beaten: "text-beaten bg-beaten/12",
	backlog: "text-backlog bg-backlog/12",
	hold: "text-hold bg-hold/12",
	dropped: "text-dropped bg-dropped/12",
	wishlist: "text-wishlist bg-wishlist/12"
};
function StatusBadge({ status, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex h-6 items-center rounded-full px-2 text-xs font-medium", TONE[status], className),
		children: STATUS_LABEL[status]
	});
}
//#endregion
export { StatusBadge as n, Poster as t };
