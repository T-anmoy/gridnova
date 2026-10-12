import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAuthExpiryHandler, AUTH_REDIRECT_RESET_MS } from '@/lib/api/auth-expiry'
import { ApiError } from '@/lib/dashboard/api-error'
import { notAuthenticatedError } from '@/lib/api/http'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

let hrefCalls: string[]
beforeEach(() => {
  vi.useFakeTimers()
  hrefCalls = []
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/dashboard/leads', search: '?page=2&q=ravi', set href(v: string) { hrefCalls.push(v) } },
  })
})
afterEach(() => vi.useRealTimers())

describe('createAuthExpiryHandler', () => {
  it('redirects a signed-out (no token) error and keeps the query string', () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    createAuthExpiryHandler({ signInPath: '/dashboard/sign-in', getSignOut: () => signOut })(notAuthenticatedError())
    expect(hrefCalls).toContain('/dashboard/sign-in?redirect_url=' + encodeURIComponent('/dashboard/leads?page=2&q=ravi'))
    expect(signOut).not.toHaveBeenCalled()
  })

  it('ends the Clerk session when the backend rejects a live session (prevents a redirect loop)', () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    createAuthExpiryHandler({ signInPath: '/dashboard/sign-in', getSignOut: () => signOut })(new ApiError(401, 'API error 401', 'Invalid or expired token.'))
    expect(signOut).toHaveBeenCalledWith({ redirectUrl: '/dashboard/sign-in?redirect_url=' + encodeURIComponent('/dashboard/leads?page=2&q=ravi') })
    expect(hrefCalls).toHaveLength(0)
  })

  it('ignores non-auth errors, redirects once, and resets the flag', () => {
    const handle = createAuthExpiryHandler({ signInPath: '/associates/sign-in' })
    handle(new ApiError(500, 'x'))
    expect(hrefCalls).toHaveLength(0)
    handle(notAuthenticatedError())
    handle(notAuthenticatedError())
    expect(hrefCalls).toHaveLength(1)
    vi.advanceTimersByTime(AUTH_REDIRECT_RESET_MS + 1)
    handle(notAuthenticatedError())
    expect(hrefCalls).toHaveLength(2)
  })
})
