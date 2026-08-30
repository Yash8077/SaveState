import { n as createMiddleware } from "./ssr.mjs";
import { cn as _enum, dn as boolean, gn as object, hn as number, un as array, yn as string } from "../_libs/@better-auth/core+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/library-schema-ui95MHqq.js
/**
* Auth middleware for server functions — the standard way to get the caller's
* verified user id. When deployed the session cookie is same-origin and rides
* along automatically. In the live preview the client also forwards the bearer
* token (partitioned cookies) via the `.client` hook below — call sites do not
* thread it themselves.
*
*   import { createServerFn } from "@tanstack/react-start";
*   import { getSql } from "@/lib/db";
*   import { authMiddleware } from "@/lib/auth/middleware";
*
*   export const listTodos = createServerFn({ method: "GET" })
*     .middleware([authMiddleware])
*     .handler(async ({ context }) => {
*       const sql = await getSql();
*       return sql`select * from todos where user_id = ${context.userId}`;
*     });
*
* Signed out with auth on (live preview included) -> throws `UnauthorizedError`
* (see `verify.server.ts`). With auth disabled (`VITE_AUTH_ENABLED=false`, the
* shipped default) it resolves the shared dev user — but throws instead when a
* `DATABASE_URL` is also set, so an app without sign-in must not use this at
* all. On the auth-on path, use it on every server function that touches
* per-user data and scope every query by `context.userId`.
*/
var authMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
	const { getBearerToken } = await import("./client-CVqXY6bk.mjs").then((n) => n.n);
	return next({ sendContext: { bearerToken: getBearerToken() ?? void 0 } });
}).server(async ({ next, context }) => {
	const { assertSameSiteRequest } = await import("./isolation.server-CGNg1r0B.mjs");
	const { requireUserId } = await import("./verify.server-BdLQhVky.mjs");
	assertSameSiteRequest();
	return next({ context: { userId: await requireUserId(context.bearerToken) } });
});
var STATUSES = [
	"playing",
	"beaten",
	"backlog",
	"hold",
	"dropped",
	"wishlist"
];
var STATUS_LABEL = {
	playing: "Playing",
	beaten: "Beaten",
	backlog: "Backlog",
	hold: "On hold",
	dropped: "Dropped",
	wishlist: "Wishlist"
};
var statusSchema = _enum(STATUSES);
var snapshotSchema = object({
	title: string().min(1),
	coverUrl: string().nullable(),
	headerUrl: string().nullable(),
	summary: string().nullable(),
	releaseDate: string().nullable(),
	platforms: array(string()),
	genres: array(string()),
	metacritic: number().nullable(),
	developers: array(string()),
	publishers: array(string()),
	screenshots: array(string())
});
var addToLibraryInput = object({
	catalogId: string().min(1),
	status: statusSchema.optional(),
	snapshot: snapshotSchema
});
var addCustomGameInput = object({
	title: string().trim().min(1).max(160),
	status: statusSchema.optional(),
	notes: string().max(4e3).optional()
});
var updateEntryInput = object({
	id: number().int(),
	status: statusSchema.optional(),
	score: number().int().min(1).max(10).nullable().optional(),
	hours: number().min(0).max(1e4).nullable().optional(),
	favorite: boolean().optional(),
	notes: string().max(4e3).nullable().optional(),
	startedAt: string().nullable().optional(),
	finishedAt: string().nullable().optional()
});
var listLibraryInput = object({
	cursor: string().nullable().optional(),
	limit: number().int().min(1).max(100).optional()
}).default({});
//#endregion
export { authMiddleware as a, addToLibraryInput as i, STATUS_LABEL as n, listLibraryInput as o, addCustomGameInput as r, updateEntryInput as s, STATUSES as t };
