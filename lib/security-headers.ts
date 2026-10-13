// Security response headers, applied by next.config.ts `headers()`.
// Kept free of path aliases and runtime imports so next.config.ts (loaded before
// the app compiles) can import it by relative path, and so tests can inspect
// exactly what is sent.

export interface SecurityHeaderOptions {
  /** Origin of the backend API (from API_BASE_URL), e.g. https://api.gridnova.in. */
  apiOrigin: string
  /** Clerk's Frontend API host, decoded from the publishable key; undefined when unknown. */
  clerkHost?: string
  /** Dev needs 'unsafe-eval' (React refresh); production does not. */
  dev?: boolean
  /**
   * Send the policy as Content-Security-Policy-Report-Only instead of enforcing
   * it. Production enforces by default; set CSP_REPORT_ONLY=1 (and redeploy) to
   * fall back to report-only if a missing source ever breaks a real page. Dev
   * is always report-only so HMR and the dev overlay are never blocked.
   */
  reportOnly?: boolean
}

type Header = { key: string; value: string }
export type HeaderRule = { source: string; headers: Header[] }

/** Clerk's Frontend API host is base64 inside the publishable key: pk_test_<base64("host$")>. */
export function clerkHostFromPublishableKey(key: string | undefined): string | undefined {
  if (!key) return undefined
  const encoded = key.split('_')[2]
  if (!encoded) return undefined
  try {
    const host = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$+$/, '').trim()
    return /^[a-z0-9.-]+$/i.test(host) ? host : undefined
  } catch {
    return undefined
  }
}

/**
 * Content-Security-Policy. Next injects inline scripts for hydration, so
 * script-src carries 'unsafe-inline' until nonces are adopted — the policy
 * still pins every network destination (API, Clerk, object storage, frames),
 * forbids plugins and base-tag injection, and upgrades insecure requests.
 * Violations are reported to /api/csp-report in either mode.
 */
export function contentSecurityPolicy({ apiOrigin, clerkHost, dev }: SecurityHeaderOptions): string {
  const clerk = ['https://*.clerk.accounts.dev', 'https://*.clerk.com', ...(clerkHost ? [`https://${clerkHost}`] : [])]
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...clerk, 'https://challenges.cloudflare.com'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    // https: covers R2 signed-URL hosts (account-specific subdomains), Clerk avatars and map tiles.
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'media-src': ["'self'", 'blob:'],
    'connect-src': [
      "'self'",
      apiOrigin,
      ...clerk,
      'https://clerk-telemetry.com',
      // Signed uploads / downloads go straight to object storage.
      'https://*.r2.cloudflarestorage.com',
    ],
    'frame-src': ["'self'", 'https://www.google.com', 'https://maps.google.com', 'https://challenges.cloudflare.com', ...clerk],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'report-uri': ['/api/csp-report'],
  }
  const rendered = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`)
  // Bare directive (no value). Not in dev: http://localhost must keep working.
  if (!dev) rendered.push('upgrade-insecure-requests')
  return rendered.join('; ')
}

// Areas that must never be framed: the customer's accept page (a capability
// URL), the staff dashboard and the signed-in portals (every locale prefix).
export const NO_FRAME_SOURCES = [
  '/proposal/:path*',
  '/dashboard/:path*',
  '/associates/portal/:path*',
  '/preferred/portal/:path*',
  '/(hi|bn)/associates/portal/:path*',
  '/(hi|bn)/preferred/portal/:path*',
]

export function securityHeaders(options: SecurityHeaderOptions): HeaderRule[] {
  const enforce = !options.dev && !options.reportOnly
  const cspKey = enforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only'
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // Camera and geolocation are used by the field portal (photos, site GPS) — same origin only.
        { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=()' },
        { key: cspKey, value: contentSecurityPolicy(options) },
      ],
    },
    // The accept URL is a bearer token: never leak it in a Referer header.
    { source: '/proposal/accept/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
    ...NO_FRAME_SOURCES.map((source) => ({
      source,
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    })),
  ]
}
