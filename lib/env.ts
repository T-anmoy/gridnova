// Validated server-only environment. Import from route handlers only — never
// from client components (none of these values may reach the browser).
import { z } from 'zod'

const emailList = z
  .string()
  .transform((s) =>
    s
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
  )

const serverEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1).optional(),
  ESTIMATE_NOTIFY_EMAIL: emailList.optional(),
  INTERNAL_API_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
})

export const REQUIRED_IN_PRODUCTION = [
  'RESEND_API_KEY',
  'INTERNAL_API_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
] as const

export interface ServerEnv {
  resendApiKey?: string
  notifyEmails: string[]
  internalApiKey?: string
  /** Names of variables required in production that are missing or empty. */
  missing: string[]
}

export const DEFAULT_NOTIFY_EMAIL = 'info@gridnova.in'

let warned = false

export function readServerEnv(source: Record<string, string | undefined> = process.env, nodeEnv = process.env.NODE_ENV): ServerEnv {
  const blank = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined)
  const parsed = serverEnvSchema.safeParse({
    RESEND_API_KEY: blank(source.RESEND_API_KEY),
    ESTIMATE_NOTIFY_EMAIL: blank(source.ESTIMATE_NOTIFY_EMAIL),
    INTERNAL_API_KEY: blank(source.INTERNAL_API_KEY),
    CLERK_SECRET_KEY: blank(source.CLERK_SECRET_KEY),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: blank(source.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
  })
  const data = parsed.success ? parsed.data : {}
  const missing = nodeEnv === 'production' ? REQUIRED_IN_PRODUCTION.filter((k) => !blank(source[k])) : []
  if (missing.length && !warned) {
    warned = true
    console.error(`[env] Missing required production environment variables: ${missing.join(', ')}. Lead capture and auth will degrade.`)
  }
  const notify = (data as { ESTIMATE_NOTIFY_EMAIL?: string[] }).ESTIMATE_NOTIFY_EMAIL
  return {
    resendApiKey: (data as { RESEND_API_KEY?: string }).RESEND_API_KEY,
    notifyEmails: notify && notify.length ? notify : [DEFAULT_NOTIFY_EMAIL],
    internalApiKey: (data as { INTERNAL_API_KEY?: string }).INTERNAL_API_KEY,
    missing: [...missing],
  }
}
