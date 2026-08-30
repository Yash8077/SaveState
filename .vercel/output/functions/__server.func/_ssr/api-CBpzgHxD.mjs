import { i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { gn as object, hn as number } from "../_libs/@better-auth/core+[...].mjs";
import { a as authMiddleware, i as addToLibraryInput, o as listLibraryInput, r as addCustomGameInput, s as updateEntryInput } from "./library-schema-ui95MHqq.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-CBpzgHxD.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var listLibrary_createServerFn_handler = createServerRpc({
	id: "1bf37280c0c6b80b9ba6963d2a55e75dbde04d0dfd9ece0166e3183f979c25f4",
	name: "listLibrary",
	filename: "src/lib/api.ts"
}, (opts) => listLibrary.__executeServer(opts));
var listLibrary = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(listLibraryInput).handler(listLibrary_createServerFn_handler, async ({ context, data }) => {
	const { getSql } = await import("./db-DSuCMacl.mjs").then((n) => n.t).then((n) => n.t);
	const { listLibraryPage } = await import("./library.server-DbyPKalJ.mjs");
	return listLibraryPage(await getSql(), context.userId, {
		cursor: data.cursor ?? null,
		limit: data.limit ?? 50
	});
});
var addToLibrary_createServerFn_handler = createServerRpc({
	id: "8553d862aadfc738536e5d1827229fe51ae785ed85da2cfe154ae61449c5c014",
	name: "addToLibrary",
	filename: "src/lib/api.ts"
}, (opts) => addToLibrary.__executeServer(opts));
var addToLibrary = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(addToLibraryInput).handler(addToLibrary_createServerFn_handler, async ({ context, data }) => {
	const { getSql } = await import("./db-DSuCMacl.mjs").then((n) => n.t).then((n) => n.t);
	const { addToLibraryRow } = await import("./library.server-DbyPKalJ.mjs");
	return addToLibraryRow(await getSql(), context.userId, data);
});
var addCustomGame_createServerFn_handler = createServerRpc({
	id: "c0f29acad5b84303be36bd9c19e197d83a10b99bfce57b0a107beb605871c83a",
	name: "addCustomGame",
	filename: "src/lib/api.ts"
}, (opts) => addCustomGame.__executeServer(opts));
var addCustomGame = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(addCustomGameInput).handler(addCustomGame_createServerFn_handler, async ({ context, data }) => {
	const { getSql } = await import("./db-DSuCMacl.mjs").then((n) => n.t).then((n) => n.t);
	const { addCustomGameRow } = await import("./library.server-DbyPKalJ.mjs");
	return addCustomGameRow(await getSql(), context.userId, data);
});
var updateEntry_createServerFn_handler = createServerRpc({
	id: "945a48daea4d7604d324408eb041748924bbc1bbc39724fdef0bc4ec6c28b9e7",
	name: "updateEntry",
	filename: "src/lib/api.ts"
}, (opts) => updateEntry.__executeServer(opts));
var updateEntry = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(updateEntryInput).handler(updateEntry_createServerFn_handler, async ({ context, data }) => {
	const { getSql } = await import("./db-DSuCMacl.mjs").then((n) => n.t).then((n) => n.t);
	const { updateEntryRow } = await import("./library.server-DbyPKalJ.mjs");
	return updateEntryRow(await getSql(), context.userId, data);
});
var removeEntry_createServerFn_handler = createServerRpc({
	id: "120083326ba73d4cade6c2e12dfbbfe8c3f6fe395ac17db5b2f307afcdb041d1",
	name: "removeEntry",
	filename: "src/lib/api.ts"
}, (opts) => removeEntry.__executeServer(opts));
var removeEntry = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ id: number().int() })).handler(removeEntry_createServerFn_handler, async ({ context, data }) => {
	const { getSql } = await import("./db-DSuCMacl.mjs").then((n) => n.t).then((n) => n.t);
	const { removeEntryRow } = await import("./library.server-DbyPKalJ.mjs");
	return removeEntryRow(await getSql(), context.userId, data.id);
});
//#endregion
export { addCustomGame_createServerFn_handler, addToLibrary_createServerFn_handler, listLibrary_createServerFn_handler, removeEntry_createServerFn_handler, updateEntry_createServerFn_handler };
