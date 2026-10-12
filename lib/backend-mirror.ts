import { API_BASE_URL } from '@/lib/config'
import { readServerEnv } from '@/lib/env'

// Shared server-to-server mirror helper for the public lead-capture routes
// (estimate-request, configurator-lead, contact). It copies the enquiry into
// the backend CRM and runs in parallel with the notification email, so a
// Resend outage can no longer lose a lead (see lib/lead-capture.ts).
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

export const MIRROR_TIMEOUT_MS = 10_000
// Mutable only so tests can drop the delay; production keeps the default.
export const mirrorConfig = { retryDelayMs: 500 }

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// POSTs `body` to `${API_BASE_URL}${path}`, attaching `X-Internal-Key` and
// `X-Customer-IP` when `INTERNAL_API_KEY` is configured (server-only env var —
// never `NEXT_PUBLIC_`). Never throws and returns whether the CRM accepted the
// lead. Each attempt has a 10 s timeout; a network error, timeout or 5xx is
// retried once, a 4xx is not (the backend refused the payload — repeating it
// cannot help). Every failure is logged with the stable `submissionId` so a
// dropped CRM lead can be traced in Vercel logs.
export async function mirrorToBackend(
  path: string,
  body: Record<string, unknown>,
  request: Request,
  label: string,
  submissionId = 'no-id'
): Promise<boolean> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const internalKey = readServerEnv().internalApiKey
  if (internalKey) {
    headers['X-Internal-Key'] = internalKey
    const ip = getClientIp(request)
    if (ip) headers['X-Customer-IP'] = ip
  }
  const payload = JSON.stringify(body)

  for (let attempt = 1; attempt <= 2; attempt++) {
    let retryable = false
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(MIRROR_TIMEOUT_MS),
      })
      if (res.ok) return true
      retryable = res.status >= 500
      console.error(`[lead ${submissionId}] Backend ${label} mirror returned ${res.status} (attempt ${attempt})`)
    } catch (err) {
      retryable = true
      console.error(`[lead ${submissionId}] Backend ${label} mirror failed (attempt ${attempt}):`, err)
    }
    if (!retryable || attempt === 2) return false
    await sleep(mirrorConfig.retryDelayMs)
  }
  return false
}
