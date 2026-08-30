import { o as __toESM } from "../_runtime.mjs";
import { a as useQueryClient, o as require_jsx_runtime, r as useQuery, s as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as STATUS_LABEL, t as STATUSES } from "./library-schema-ui95MHqq.mjs";
import { c as Heart, n as Trash2 } from "../_libs/lucide-react.mjs";
import { a as cn, h as snapshotFromDetails, n as Route$5, s as steamPortraitUrl, u as getCatalogGame, y as useCurrentUserState } from "./router-BQDdMn6j.mjs";
import { n as StatusBadge, t as Poster } from "./status-badge-2RUqgiof.mjs";
import { n as Input, r as Textarea, t as Button } from "./input-CEwoJWnr.mjs";
import { t as Skeleton } from "./skeleton-Bb7BAWQU.mjs";
import { n as useLibraryMutations, t as useLibrary } from "./use-library-B4P7rbg8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/game._catalogId-C_uqo7qW.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function TrackerPanel({ entry, saving, onSave, onRemove }) {
	const [notes, setNotes] = (0, import_react.useState)(entry.notes ?? "");
	const [hours, setHours] = (0, import_react.useState)(entry.hours?.toString() ?? "");
	const [startedAt, setStartedAt] = (0, import_react.useState)(entry.startedAt ?? "");
	const [finishedAt, setFinishedAt] = (0, import_react.useState)(entry.finishedAt ?? "");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl bg-elevated p-4 sm:p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-base font-medium",
					children: "Your log"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => onSave({ favorite: !entry.favorite }),
					className: cn("grid size-11 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-subtle", entry.favorite && "text-accent"),
					"aria-label": entry.favorite ? "Unfavorite" : "Favorite",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: cn("size-5", entry.favorite && "fill-current") })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: STATUSES.map((status) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => onSave({ status }),
					className: cn("h-9 rounded-full px-3.5 text-sm font-medium transition-colors duration-150", entry.status === status ? "bg-accent text-accent-fg" : "bg-subtle text-muted hover:text-fg"),
					children: STATUS_LABEL[status]
				}, status))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-2 text-sm text-muted",
					children: "Score"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-1.5",
					children: Array.from({ length: 10 }, (_, i) => i + 1).map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => onSave({ score: entry.score === n ? null : n }),
						className: cn("grid size-10 place-items-center rounded-full text-sm font-medium tabular-nums transition-colors duration-150", entry.score === n ? "bg-accent text-accent-fg" : "bg-subtle text-muted hover:text-fg"),
						children: n
					}, n))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-5 block text-sm text-muted",
				children: ["Hours played", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					className: "mt-1.5",
					inputMode: "decimal",
					value: hours,
					placeholder: "0",
					onChange: (e) => setHours(e.target.value),
					onBlur: () => {
						const raw = hours.trim();
						if (!raw) {
							if (entry.hours != null) onSave({ hours: null });
							return;
						}
						const n = Number(raw);
						if (!Number.isFinite(n) || n < 0) return;
						if (n !== entry.hours) onSave({ hours: n });
					}
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block text-sm text-muted",
					children: ["Started", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-1.5",
						type: "date",
						value: startedAt,
						onChange: (e) => {
							setStartedAt(e.target.value);
							onSave({ startedAt: e.target.value || null });
						}
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block text-sm text-muted",
					children: ["Finished", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-1.5",
						type: "date",
						value: finishedAt,
						onChange: (e) => {
							setFinishedAt(e.target.value);
							onSave({ finishedAt: e.target.value || null });
						}
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-4 block text-sm text-muted",
				children: ["Notes", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					className: "mt-1.5",
					value: notes,
					placeholder: "What stayed with you?",
					onChange: (e) => setNotes(e.target.value),
					onBlur: () => {
						const next = notes.trim() || null;
						if (next !== (entry.notes ?? null)) onSave({ notes: next });
					}
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-faint",
					children: saving ? "Saving…" : "Synced to your account"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "danger",
					size: "sm",
					onClick: () => void onRemove(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), "Remove"]
				})]
			})
		]
	});
}
function GamePage() {
	const { catalogId } = Route$5.useParams();
	const { user, isPending } = useCurrentUserState();
	const library = useLibrary();
	const { add, update, remove } = useLibraryMutations();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const isCustom = catalogId.startsWith("custom_");
	const portrait = steamPortraitUrl(catalogId);
	const preview = qc.getQueryData(["catalog-preview", catalogId]);
	const details = useQuery({
		queryKey: ["catalog-game", catalogId],
		queryFn: ({ signal }) => getCatalogGame(catalogId, signal),
		enabled: !isCustom,
		staleTime: 6e5
	});
	const entry = (library.data ?? []).find((e) => e.catalogId === catalogId);
	const catalog = details.data;
	const title = entry?.title ?? catalog?.title ?? preview?.title;
	const coverUrl = portrait ?? entry?.coverUrl ?? catalog?.coverUrl ?? preview?.coverUrl;
	const headerUrl = entry?.headerUrl ?? catalog?.headerUrl ?? preview?.headerUrl;
	const summary = plainText(entry?.summary ?? catalog?.summary);
	const genres = (entry?.genres?.length ? entry.genres : catalog?.genres) ?? [];
	const platforms = (entry?.platforms?.length ? entry.platforms : catalog?.platforms) ?? [];
	const developers = (entry?.developers?.length ? entry.developers : catalog?.developers) ?? [];
	const publishers = (entry?.publishers?.length ? entry.publishers : catalog?.publishers) ?? [];
	const screenshots = (entry?.screenshots?.length ? entry.screenshots : catalog?.screenshots) ?? [];
	const releaseDate = entry?.releaseDate ?? catalog?.releaseDate;
	const metacritic = entry?.metacritic ?? catalog?.metacritic;
	const banner = headerUrl || coverUrl;
	const loading = !title && (details.isLoading || library.isLoading || isPending);
	if (!loading && !title) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "py-16 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-2xl font-medium",
				children: "Title not found"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "It may have been removed, or the catalog lookup failed."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/search",
				className: "mt-4 inline-flex h-11 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-fg",
				children: "Back to search"
			})
		]
	});
	async function addWith(status) {
		const snap = snapshotFromDetails({
			title: title ?? "Untitled",
			coverUrl: coverUrl ?? null,
			headerUrl: headerUrl ?? null,
			summary: summary || null,
			releaseDate: releaseDate ?? null,
			platforms,
			genres,
			metacritic: metacritic ?? null,
			developers,
			publishers,
			screenshots
		});
		await add.mutateAsync({
			catalogId,
			status,
			snapshot: snap
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "-mx-3 -mt-2 sm:-mx-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative h-44 overflow-hidden bg-elevated min-[600px]:h-56 expanded:h-64 short:h-28",
			children: [banner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: banner,
				alt: "",
				className: "size-full object-cover object-center"
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/20" })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-10 -mt-16 px-3 sm:-mt-20 sm:px-5 min-[600px]:-mt-24",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid items-end gap-4 min-[600px]:grid-cols-[10.5rem_1fr] expanded:grid-cols-[12.5rem_1fr] expanded:gap-6 short:items-start short:grid-cols-[6.5rem_1fr]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mx-auto w-28 shrink-0 min-[600px]:mx-0 min-[600px]:w-full",
						children: loading && !coverUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "aspect-2/3 w-full rounded-lg" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Poster, {
							title: title ?? "",
							coverUrl,
							headerUrl,
							className: "aspect-2/3 w-full rounded-lg shadow-lg"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 pb-1 text-center min-[600px]:text-left",
						children: [
							loading && !title ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "mx-auto h-8 w-2/3 min-[600px]:mx-0" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-2xl font-medium tracking-tight sm:text-3xl",
								children: title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-muted min-[600px]:justify-start",
								children: [
									entry ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: entry.status }) : null,
									releaseDate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: releaseDate }) : null,
									metacritic ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "tabular-nums",
										children: ["Metacritic ", metacritic]
									}) : null,
									entry?.score ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "tabular-nums",
										children: ["Your score ", entry.score]
									}) : null
								]
							}),
							genres.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-3 flex flex-wrap justify-center gap-1.5 min-[600px]:justify-start",
								children: genres.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded-full bg-subtle px-2.5 py-1 text-xs text-muted",
									children: g
								}, g))
							}) : null,
							!user && !isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-4 text-sm text-muted",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/login",
										className: "font-medium text-accent",
										children: "Sign in"
									}),
									" ",
									"to add this to your synced library."
								]
							}) : null,
							user && !entry ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mb-2 text-sm text-muted",
									children: "Add to library"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-wrap justify-center gap-1.5 min-[600px]:justify-start",
									children: STATUSES.map((status) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: status === "playing" ? "primary" : "secondary",
										disabled: add.isPending,
										onClick: () => void addWith(status),
										children: STATUS_LABEL[status]
									}, status))
								})]
							}) : null
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 grid gap-4 pb-4 expanded:grid-cols-[minmax(0,1fr)_22rem] expanded:items-start",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [summary ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Synopsis, { text: summary }) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
							className: "grid gap-3 text-sm sm:grid-cols-2",
							children: [
								platforms.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Meta, {
									label: "Platforms",
									value: platforms.join(", ")
								}) : null,
								developers.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Meta, {
									label: "Developers",
									value: developers.join(", ")
								}) : null,
								publishers.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Meta, {
									label: "Publishers",
									value: publishers.join(", ")
								}) : null
							]
						})]
					}), entry ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrackerPanel, {
						entry,
						saving: update.isPending,
						onSave: async (patch) => {
							await update.mutateAsync({
								id: entry.id,
								...patch
							});
						},
						onRemove: async () => {
							await remove.mutateAsync(entry.id);
							navigate({ to: "/library" });
						}
					}) : null]
				}),
				screenshots.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "pb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mb-3 text-base font-medium",
						children: "Screenshots"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rail-scroll",
						children: screenshots.map((src) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src,
							alt: "",
							loading: "lazy",
							className: "h-36 snap-start rounded-lg object-cover sm:h-48"
						}, src))
					})]
				}) : null
			]
		})]
	});
}
function Synopsis({ text }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const long = text.length > 220;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: cn("text-sm leading-relaxed text-muted", !open && long && "line-clamp-4"),
		children: text
	}), long ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		className: "mt-1 h-10 text-sm font-medium text-accent",
		onClick: () => setOpen((v) => !v),
		children: open ? "Show less" : "Read more"
	}) : null] });
}
function Meta({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg bg-elevated px-3 py-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-xs text-faint",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "mt-0.5 text-fg",
			children: value
		})]
	});
}
function plainText(html) {
	if (!html) return "";
	return html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, "\"").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
//#endregion
export { GamePage as component };
