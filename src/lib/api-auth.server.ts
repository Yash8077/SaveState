export async function requireApiUser(request: Request): Promise<string> {
  const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
  const { requireUserId } = await import("@/lib/auth/verify.server");
  assertSameSiteRequest();
  const header = request.headers.get("authorization");
  const bearer =
    header && /^bearer\s+/i.test(header)
      ? header.replace(/^bearer\s+/i, "").trim()
      : undefined;
  return requireUserId(bearer);
}

export function apiErrorResponse(err: unknown): Response {
  const statusRaw =
    typeof err === "object" && err && "status" in err
      ? Number((err as { status: unknown }).status)
      : 500;
  const status =
    Number.isFinite(statusRaw) && statusRaw >= 400 && statusRaw < 600
      ? statusRaw
      : 500;
  const message = err instanceof Error ? err.message : "Request failed";
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (
    status === 429 &&
    typeof err === "object" &&
    err &&
    "retryAfter" in err
  ) {
    headers["Retry-After"] = String(
      (err as { retryAfter: unknown }).retryAfter,
    );
  }
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

export function apiJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
