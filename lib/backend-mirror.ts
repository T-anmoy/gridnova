// Shared server-to-server mirror helper for the public lead-capture routes
// (estimate-request, configurator-lead, contact). Each of those routes has
// already sent its own success response to the visitor via Resend by the
// time this runs — this is a best-effort, fire-and-forget copy of the same
// enquiry into the backend CRM, and must never affect what the visitor sees.
//
// Vercel's edge network sets `x-forwarded-for` to the real originating
// client IP before a serverless function ever sees the request — the value
// can't be spoofed by the caller, since Vercel overwrites (not appends to)
// this header at its own edge rather than trusting whatever the client sent.
// See https://vercel.com/docs/edge-network/headers#x-forwarded-for.
// `x-real-ip` is kept as a fallback for any non-Vercel deployment target.
export function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip') ?? undefined
}

// POSTs `body` to `${NEXT_PUBLIC_API_URL}${path}`, attaching `X-Internal-Key`
// and `X-Customer-IP` when `INTERNAL_API_KEY` is configured (server-only env
// var — never `NEXT_PUBLIC_`). Both headers are simply omitted when the key
// is unset, leaving behaviour identical to before this existed. Never
// throws: a network failure or a non-2xx backend status is logged (so a
// silently dropped CRM lead is visible in Vercel logs) but never surfaced to
// the caller, whose own response to the visitor has already been decided.
export async function mirrorToBackend(path: string, body: Record<string, unknown>, request: Request, label: string): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const internalKey = process.env.INTERNAL_API_KEY
  if (internalKey) {
    headers['X-Internal-Key'] = internalKey
    const ip = getClientIp(request)
    if (ip) headers['X-Customer-IP'] = ip
  }

  try {
    const res = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.error(`Backend ${label} mirror returned ${res.status} (non-fatal — customer's email already sent)`)
    }
  } catch (err) {
    console.error(`Backend ${label} mirror failed (non-fatal — customer's email already sent):`, err)
  }
}
