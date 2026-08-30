//#region node_modules/.nitro/vite/services/ssr/assets/rate-limit.server-D2oL57C0.js
var WINDOW_MS = 6e4;
var LIMIT = 30;
var hits = /* @__PURE__ */ new Map();
function clientIp(request) {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		const first = forwarded.split(",")[0]?.trim();
		if (first) return first;
	}
	const real = request.headers.get("x-real-ip")?.trim();
	if (real) return real;
	return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}
function consumeRateLimit(key, limit = LIMIT, windowMs = WINDOW_MS) {
	const now = Date.now();
	const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
	if (recent.length >= limit) {
		hits.set(key, recent);
		return {
			ok: false,
			retryAfter: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1e3))
		};
	}
	recent.push(now);
	hits.set(key, recent);
	if (hits.size > 1e4) {
		const oldest = hits.keys().next().value;
		if (oldest) hits.delete(oldest);
	}
	return { ok: true };
}
function catalogRateLimitResponse(request) {
	const result = consumeRateLimit(`catalog:${clientIp(request)}`);
	if (result.ok) return null;
	return new Response(JSON.stringify({ error: "Too many requests" }), {
		status: 429,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"Retry-After": String(result.retryAfter),
			"cache-control": "no-store"
		}
	});
}
//#endregion
export { catalogRateLimitResponse };
