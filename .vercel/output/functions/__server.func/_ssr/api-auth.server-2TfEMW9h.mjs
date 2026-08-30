//#region node_modules/.nitro/vite/services/ssr/assets/api-auth.server-2TfEMW9h.js
async function requireApiUser(request) {
	const { assertSameSiteRequest } = await import("./isolation.server-CGNg1r0B.mjs");
	const { requireUserId } = await import("./verify.server-BdLQhVky.mjs");
	assertSameSiteRequest();
	const header = request.headers.get("authorization");
	return requireUserId(header && /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : void 0);
}
function apiErrorResponse(err) {
	const statusRaw = typeof err === "object" && err && "status" in err ? Number(err.status) : 500;
	const status = Number.isFinite(statusRaw) && statusRaw >= 400 && statusRaw < 600 ? statusRaw : 500;
	const message = err instanceof Error ? err.message : "Request failed";
	const headers = {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	};
	if (status === 429 && typeof err === "object" && err && "retryAfter" in err) headers["Retry-After"] = String(err.retryAfter);
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers
	});
}
function apiJson(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
//#endregion
export { apiErrorResponse, apiJson, requireApiUser };
