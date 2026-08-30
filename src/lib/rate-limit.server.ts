const WINDOW_MS = 60_000;
const LIMIT = 30;

const hits = new Map<string, number[]>();

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

export function consumeRateLimit(
  key: string,
  limit = LIMIT,
  windowMs = WINDOW_MS,
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    const retryAfter = Math.max(
      1,
      Math.ceil((recent[0]! + windowMs - now) / 1000),
    );
    return { ok: false, retryAfter };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) {
    const oldest = hits.keys().next().value;
    if (oldest) hits.delete(oldest);
  }
  return { ok: true };
}

export function catalogRateLimitResponse(request: Request): Response | null {
  const result = consumeRateLimit(`catalog:${clientIp(request)}`);
  if (result.ok) return null;
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Retry-After": String(result.retryAfter),
      "cache-control": "no-store",
    },
  });
}

export function resetRateLimitForTests(): void {
  hits.clear();
}
