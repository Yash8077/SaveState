import { o as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, r as useQuery, s as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as STATUS_LABEL, t as STATUSES } from "./library-schema-ui95MHqq.mjs";
import { r as searchSeed } from "./catalog-seed-GyIvdhCE.mjs";
import { a as Plus, i as Search } from "../_libs/lucide-react.mjs";
import { a as cn, m as searchGames, r as Route$8, y as useCurrentUserState } from "./router-BQDdMn6j.mjs";
import { n as StatusBadge } from "./status-badge-2RUqgiof.mjs";
import { t as GameCard } from "./game-card-PFUGUwai.mjs";
import { n as Input, r as Textarea, t as Button } from "./input-CEwoJWnr.mjs";
import { t as Skeleton } from "./skeleton-Bb7BAWQU.mjs";
import { n as useLibraryMutations, t as useLibrary } from "./use-library-B4P7rbg8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/search-BLFWURzw.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CustomGameForm({ onDone }) {
	const [title, setTitle] = (0, import_react.useState)("");
	const [status, setStatus] = (0, import_react.useState)("backlog");
	const [notes, setNotes] = (0, import_react.useState)("");
	const { custom } = useLibraryMutations();
	const navigate = useNavigate();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "space-y-4",
		onSubmit: (e) => {
			e.preventDefault();
			const trimmed = title.trim();
			if (!trimmed) return;
			custom.mutateAsync({
				title: trimmed,
				status,
				notes: notes.trim() || void 0
			}).then((entry) => {
				onDone?.();
				navigate({
					to: "/game/$catalogId",
					params: { catalogId: entry.catalogId }
				});
			});
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block text-xs font-medium text-faint",
				children: ["Title", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					className: "mt-1.5",
					value: title,
					onChange: (e) => setTitle(e.target.value),
					placeholder: "A game that is not in the catalog",
					required: true
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-1.5 text-xs font-medium text-faint",
				children: "Status"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-1.5",
				children: STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setStatus(s),
					className: cn("h-9 rounded-full px-3 text-sm", status === s ? "bg-accent text-accent-fg" : "bg-subtle text-muted"),
					children: STATUS_LABEL[s]
				}, s))
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block text-xs font-medium text-faint",
				children: ["Notes", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					className: "mt-1.5",
					value: notes,
					onChange: (e) => setNotes(e.target.value),
					placeholder: "Optional"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "submit",
				disabled: custom.isPending || !title.trim(),
				children: custom.isPending ? "Adding…" : "Add to library"
			})
		]
	});
}
function pickGames(live, seed) {
	if (live && live.length) return live;
	if (seed.length) return seed;
	return live ?? [];
}
function SearchPage() {
	const { q = "" } = Route$8.useSearch();
	const [draft, setDraft] = (0, import_react.useState)(q);
	const [debounced, setDebounced] = (0, import_react.useState)(q);
	const [showCustom, setShowCustom] = (0, import_react.useState)(false);
	const { user } = useCurrentUserState();
	const library = useLibrary();
	const navigate = Route$8.useNavigate();
	(0, import_react.useEffect)(() => {
		setDraft(q);
		setDebounced(q);
	}, [q]);
	(0, import_react.useEffect)(() => {
		const handle = window.setTimeout(() => setDebounced(draft), 120);
		return () => window.clearTimeout(handle);
	}, [draft]);
	(0, import_react.useEffect)(() => {
		const handle = window.setTimeout(() => {
			if (debounced !== q) navigate({
				search: { q: debounced },
				replace: true
			});
		}, 280);
		return () => window.clearTimeout(handle);
	}, [
		debounced,
		q,
		navigate
	]);
	const local = (0, import_react.useMemo)(() => searchSeed(debounced), [debounced]);
	const ready = debounced.trim().length >= 2;
	const results = useQuery({
		queryKey: ["search", debounced],
		queryFn: ({ signal }) => searchGames(debounced, signal),
		enabled: ready,
		staleTime: 6e5,
		gcTime: 18e5,
		placeholderData: (previous) => previous
	});
	const games = pickGames(results.data, local);
	const byCatalog = new Map((library.data ?? []).map((e) => [e.catalogId, e]));
	const showSkeleton = ready && results.isPending && games.length === 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-faint" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: draft,
					onChange: (e) => setDraft(e.target.value),
					placeholder: "Search games",
					autoFocus: true,
					className: "h-12 rounded-full border-0 bg-subtle pr-4 pl-11"
				})]
			}),
			showSkeleton ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "poster-grid",
				children: Array.from({ length: 12 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "aspect-2/3 w-full rounded-lg" }, i))
			}) : null,
			ready && games.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "poster-grid",
				children: games.map((g, i) => {
					const entry = byCatalog.get(g.id);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCard, {
							catalogId: g.id,
							title: g.title,
							coverUrl: g.coverUrl,
							headerUrl: g.headerUrl,
							status: entry?.status,
							score: entry?.score,
							size: "grid",
							priority: i < 6
						}), entry ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "pointer-events-none absolute top-1.5 left-1.5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: entry.status })
						}) : null]
					}, g.id);
				})
			}) : null,
			ready && results.isFetched && games.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [
					"No matches for “",
					debounced,
					"”."
				]
			}) : null,
			user ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl bg-elevated p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex min-h-12 w-full items-center gap-3 text-left",
					onClick: () => setShowCustom((v) => !v),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "grid size-10 place-items-center rounded-full bg-accent/20 text-accent",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-5" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block font-medium",
						children: "Add a custom title"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-sm text-muted",
						children: "Not in the catalog? Log it anyway."
					})] })]
				}), showCustom ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomGameForm, { onDone: () => setShowCustom(false) })
				}) : null]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/login",
						className: "font-medium text-accent",
						children: "Sign in"
					}),
					" ",
					"to save titles."
				]
			})
		]
	});
}
//#endregion
export { SearchPage as component };
