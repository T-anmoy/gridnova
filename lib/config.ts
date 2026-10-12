// The single place the backend base URL is read. Every other module imports
// `API_BASE_URL` from here (an ESLint rule forbids reading the env var
// elsewhere), so a missing value can never silently point production at
// localhost.
//
// NEXT_PUBLIC_API_URL is inlined into the client bundle at build time, so the
// literal `process.env.NEXT_PUBLIC_API_URL` below must stay a direct property
// access.

const DEV_FALLBACK = 'http://localhost:8000'

const LOCAL_HOST = /(^|[/@.])(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?=[:/]|$)/i

export interface ApiBaseInput {
  value: string | undefined
  nodeEnv: string | undefined
}

/**
 * Resolve and validate the backend base URL. Outside production a missing
 * value falls back to the local dev backend; in production a missing value, or
 * one that points at localhost, throws (which fails `next build`).
 */
export function resolveApiBase({ value, nodeEnv }: ApiBaseInput): string {
  const trimmed = value?.trim().replace(/\/+$/, '')
  if (nodeEnv === 'production') {
    if (!trimmed) {
      throw new Error(
        'NEXT_PUBLIC_API_URL is not set. A production build must know the backend URL — set it in the hosting environment (see .env.example).'
      )
    }
    if (LOCAL_HOST.test(trimmed)) {
      throw new Error(
        `NEXT_PUBLIC_API_URL points at a local address (${trimmed}). A production build must target the deployed backend.`
      )
    }
    return trimmed
  }
  return trimmed || DEV_FALLBACK
}

/**
 * True when a Vercel Preview build targets the production backend host. Only
 * the host is compared, so a differently-pathed URL still matches.
 */
export function previewTargetsProductionBackend(args: {
  apiBase: string
  productionHost: string | undefined
  vercelEnv: string | undefined
}): boolean {
  if (args.vercelEnv !== 'preview' || !args.productionHost) return false
  try {
    return new URL(args.apiBase).host === args.productionHost.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  } catch {
    return false
  }
}

export const API_BASE_URL: string = resolveApiBase({
  value: process.env.NEXT_PUBLIC_API_URL,
  nodeEnv: process.env.NODE_ENV,
})

if (
  previewTargetsProductionBackend({
    apiBase: API_BASE_URL,
    productionHost: process.env.NEXT_PUBLIC_PRODUCTION_API_HOST,
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV,
  })
) {
  console.warn(
    '\n!!! PREVIEW BUILD IS POINTED AT THE PRODUCTION BACKEND !!!\n' +
      `NEXT_PUBLIC_API_URL (${API_BASE_URL}) is the production API host. Preview deployments must use a staging backend — test submissions will create real leads.\n`
  )
}

/** Whether the live Ask Nova chat is on. On unless explicitly set to "false". */
export const ASK_NOVA_ENABLED: boolean = process.env.NEXT_PUBLIC_ASK_NOVA_ENABLED !== 'false'
