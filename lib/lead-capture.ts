// The shared request pipeline behind /api/estimate-request, /api/configurator-lead
// and /api/contact.
//
// A lead must not depend on any single channel. The CRM mirror starts
// immediately, in parallel with the notification email, and keeps running after
// the response via `after()`; the response succeeds if EITHER channel
// succeeded. In the common case (email sent) the visitor is answered without
// waiting for the CRM; only when the email fails do we wait for the mirror's
// outcome (bounded by its own timeout and single retry).
import { NextResponse } from 'next/server'
import { after } from 'next/server'
import type { z } from 'zod'
import { getClientIp, mirrorToBackend } from '@/lib/backend-mirror'
import { sendLeadEmail, type LeadEmailArgs } from '@/lib/lead-email'
import { rateLimit } from '@/lib/rate-limit'

export const LEAD_RATE_LIMIT = 5
export const LEAD_RATE_WINDOW_MS = 10 * 60_000

export interface LeadRouteConfig<T> {
  /** Used for the rate-limit bucket and log lines. */
  route: string
  schema: z.ZodType<T>
  email: (data: T) => Omit<LeadEmailArgs, 'submissionId'>
  mirror: { path: string; label: string; payload: (data: T) => Record<string, unknown> }
  failureMessage: string
}

function fail(error: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ success: false, error }, { status, headers })
}

// `after()` throws outside a request scope (unit tests, scripts). The promise
// is already running by then, so ignoring that is safe.
function keepAlive(work: Promise<unknown>) {
  try {
    after(() => work)
  } catch {
    /* not in a request scope */
  }
}

export async function handleLeadRequest<T>(request: Request, cfg: LeadRouteConfig<T>): Promise<Response> {
  const submissionId = crypto.randomUUID()
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail('Invalid request body.', 400)
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return fail('Invalid request body.', 400)
    }

    // Honeypot — bots fill this field, real users never see it. Answer with a
    // generic success so bots get no signal their submission was caught.
    if ((body as { website?: unknown }).website) return NextResponse.json({ success: true })

    // Per-IP limit (in-memory — a first layer only; see lib/rate-limit.ts).
    // Skipped when no client address can be attributed.
    const ip = getClientIp(request)
    if (ip) {
      const limited = rateLimit(`${cfg.route}:${ip}`, LEAD_RATE_LIMIT, LEAD_RATE_WINDOW_MS)
      if (!limited.ok) {
        return fail('Too many requests. Please try again in a few minutes, or call us directly.', 429, {
          'Retry-After': String(limited.retryAfter),
        })
      }
    }

    const parsed = cfg.schema.safeParse(body)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid request.', 400)
    const data = parsed.data

    const mirrorDone = mirrorToBackend(cfg.mirror.path, cfg.mirror.payload(data), request, cfg.mirror.label, submissionId)
    keepAlive(mirrorDone)
    const emailResult = await sendLeadEmail({ ...cfg.email(data), submissionId })

    if (emailResult.ok) {
      console.info(`[lead ${submissionId}] ${cfg.route}: email sent; CRM mirror running after the response.`)
      return NextResponse.json({ success: true })
    }
    // Email failed or is unconfigured: the CRM copy is the only record, so wait for it.
    const mirrored = await mirrorDone
    if (mirrored) {
      console.error(`[lead ${submissionId}] ${cfg.route}: email ${emailResult.reason}, but the lead is in the CRM.`)
      return NextResponse.json({ success: true })
    }
    console.error(`[lead ${submissionId}] ${cfg.route}: NEITHER channel succeeded (email ${emailResult.reason}, CRM failed).`)
    return emailResult.reason === 'not_configured'
      ? fail('This form is not fully configured yet. Please call or email us directly.', 503)
      : fail(cfg.failureMessage, 502)
  } catch (err) {
    console.error(`[lead ${submissionId}] ${cfg.route}: unexpected error:`, err)
    return fail(cfg.failureMessage, 500)
  }
}
