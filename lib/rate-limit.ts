type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

// Evict expired entries periodically to prevent unbounded growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}, 60_000);

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= maxAttempts) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count++;
  return { allowed: true };
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function rateLimitResponse(retryAfter: number) {
  return Response.json(
    { error: "試行回数が多すぎます。しばらく待ってから再試行してください。" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
