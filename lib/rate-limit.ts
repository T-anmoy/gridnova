// A small in-memory sliding-window limiter for the public lead routes.
//
// HONEST LIMITS: this state lives in one serverless instance's memory. On
// Vercel several instances run side by side and each cold start begins empty,
// so this blunts a single client hammering one instance — it is a first layer
// on top of the honeypot, not a global guarantee. A shared store (Redis /
// Upstash / Vercel KV) or the platform firewall is the real fix.
const hits = new Map<string, number[]>()
const MAX_KEYS = 5_000

export interface RateLimitResult {
  ok: boolean
  /** Seconds until the oldest hit leaves the window (only when blocked). */
  retryAfter: number
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    hits.set(key, recent)
    return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000)) }
  }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > MAX_KEYS) {
    // Bound memory: drop keys whose whole window has expired.
    for (const [k, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(k)
  }
  return { ok: true, retryAfter: 0 }
}

export function resetRateLimits(): void {
  hits.clear()
}
