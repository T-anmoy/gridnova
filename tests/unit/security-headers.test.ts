import { describe, it, expect } from 'vitest'
import { clerkHostFromPublishableKey, contentSecurityPolicy, securityHeaders, NO_FRAME_SOURCES } from '@/lib/security-headers'

const opts = { apiOrigin: 'https://api.gridnova.in', clerkHost: 'clerk.gridnova.in' }
const rule = (source: string) => securityHeaders(opts).find((r) => r.source === source)!
const value = (source: string, key: string) => rule(source).headers.find((h) => h.key === key)?.value

describe('security headers (L5)', () => {
  it('global rule: HSTS, nosniff, referrer policy, permissions policy, enforcing CSP', () => {
    expect(value('/:path*', 'Strict-Transport-Security')).toMatch(/max-age=\d+; includeSubDomains/)
    expect(value('/:path*', 'X-Content-Type-Options')).toBe('nosniff')
    expect(value('/:path*', 'Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(value('/:path*', 'Permissions-Policy')).toMatch(/camera=\(self\), geolocation=\(self\)/)
    // Production enforces; the report-only header is not sent alongside it.
    expect(value('/:path*', 'Content-Security-Policy')).toContain("default-src 'self'")
    expect(value('/:path*', 'Content-Security-Policy-Report-Only')).toBeUndefined()
  })
  it('CSP_REPORT_ONLY and dev fall back to report-only', () => {
    for (const o of [{ ...opts, reportOnly: true }, { ...opts, dev: true }]) {
      const headers = securityHeaders(o).find((r) => r.source === '/:path*')!.headers
      expect(headers.find((h) => h.key === 'Content-Security-Policy-Report-Only')).toBeTruthy()
      expect(headers.find((h) => h.key === 'Content-Security-Policy')).toBeUndefined()
    }
  })
  it('production policy upgrades insecure requests and pins objects, base and manifests', () => {
    const csp = contentSecurityPolicy(opts)
    expect(csp).toContain('upgrade-insecure-requests')
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("manifest-src 'self'")
    expect(contentSecurityPolicy({ ...opts, dev: true })).not.toContain('upgrade-insecure-requests')
  })
  it('accept pages send no referrer', () => {
    expect(value('/proposal/accept/:path*', 'Referrer-Policy')).toBe('no-referrer')
  })
  it('private areas cannot be framed', () => {
    for (const s of ['/proposal/:path*', '/dashboard/:path*', '/associates/portal/:path*', '/preferred/portal/:path*', '/(hi|bn)/associates/portal/:path*', '/(hi|bn)/preferred/portal/:path*']) {
      expect(NO_FRAME_SOURCES).toContain(s)
      expect(value(s, 'Content-Security-Policy')).toBe("frame-ancestors 'none'")
      expect(value(s, 'X-Frame-Options')).toBe('DENY')
    }
  })
  it('CSP covers the backend, Clerk, R2 and Google Maps; eval only in dev', () => {
    const csp = contentSecurityPolicy(opts)
    expect(csp).toContain('connect-src')
    expect(csp).toContain('https://api.gridnova.in')
    expect(csp).toContain('https://clerk.gridnova.in')
    expect(csp).toContain('https://*.r2.cloudflarestorage.com')
    expect(csp).toContain('https://www.google.com')
    expect(csp).not.toContain("'unsafe-eval'")
    expect(contentSecurityPolicy({ ...opts, dev: true })).toContain("'unsafe-eval'")
  })
  it('decodes the Clerk host from a publishable key', () => {
    expect(clerkHostFromPublishableKey('pk_test_Y2xlcmsuZXhhbXBsZS5jb20k')).toBe('clerk.example.com')
    expect(clerkHostFromPublishableKey(undefined)).toBeUndefined()
    expect(clerkHostFromPublishableKey('garbage')).toBeUndefined()
  })
})
