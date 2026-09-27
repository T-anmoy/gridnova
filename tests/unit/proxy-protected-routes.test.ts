import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture every predicate passed to createRouteMatcher (proxy.ts now builds
// three: staff dashboard, associate portal, preferred portal — in that
// order) and the handler passed to clerkMiddleware, so the real routing
// logic in proxy.ts can be exercised directly, without needing a real Clerk
// session or a running server.
type Predicate = (req: { nextUrl: { pathname: string } }) => boolean
let capturedPredicates: Predicate[] = []
let capturedHandler: ((auth: unknown, req: { nextUrl: { pathname: string } }) => unknown) | undefined

vi.mock('@clerk/nextjs/server', () => ({
  createRouteMatcher: (predicate: Predicate) => {
    capturedPredicates.push(predicate)
    return (req: { nextUrl: { pathname: string } }) => predicate(req)
  },
  clerkMiddleware: (handler: typeof capturedHandler) => {
    capturedHandler = handler
    return handler
  },
}))

function makeReq(pathname: string) {
  return { nextUrl: { pathname }, url: `https://app.example.com${pathname}` } as unknown as Parameters<NonNullable<typeof capturedHandler>>[1]
}

beforeEach(async () => {
  vi.resetModules()
  capturedPredicates = []
  capturedHandler = undefined
  await import('@/proxy')
})

function capturedPredicate(req: ReturnType<typeof makeReq>) {
  return capturedPredicates[0]!(req)
}

describe('proxy.ts — protected route matcher', () => {
  it('protects /proposal/new, the internal sales site-assessment wizard', () => {
    expect(capturedPredicate(makeReq('/proposal/new'))).toBe(true)
  })

  it('never protects /proposal/accept/[token] — the public customer accept page', () => {
    expect(capturedPredicate(makeReq('/proposal/accept/abc123'))).toBe(false)
  })

  it('still protects every /dashboard route except sign-in', () => {
    expect(capturedPredicate(makeReq('/dashboard'))).toBe(true)
    expect(capturedPredicate(makeReq('/dashboard/leads/19'))).toBe(true)
    expect(capturedPredicate(makeReq('/dashboard/sign-in'))).toBe(false)
  })

  it('leaves public marketing pages untouched', () => {
    expect(capturedPredicate(makeReq('/'))).toBe(false)
    expect(capturedPredicate(makeReq('/about'))).toBe(false)
  })

  it('calls auth.protect with the dashboard sign-in redirect for /proposal/new, same as the dashboard', async () => {
    const protect = vi.fn()
    const auth = Object.assign(vi.fn(), { protect })
    await capturedHandler!(auth, makeReq('/proposal/new'))
    expect(protect).toHaveBeenCalledWith({ unauthenticatedUrl: 'https://app.example.com/dashboard/sign-in' })
  })
})

describe('proxy.ts — associate/preferred portal matchers', () => {
  function associatePortalPredicate(req: ReturnType<typeof makeReq>) {
    return capturedPredicates[1]!(req)
  }
  function preferredPortalPredicate(req: ReturnType<typeof makeReq>) {
    return capturedPredicates[2]!(req)
  }

  it('protects /associates/portal and its subroutes, unprefixed and locale-prefixed', () => {
    expect(associatePortalPredicate(makeReq('/associates/portal'))).toBe(true)
    expect(associatePortalPredicate(makeReq('/associates/portal/id-card'))).toBe(true)
    expect(associatePortalPredicate(makeReq('/hi/associates/portal'))).toBe(true)
    expect(associatePortalPredicate(makeReq('/bn/associates/portal/profile'))).toBe(true)
  })

  it('never protects /associates/apply, /associates/sign-in, or the preferred portal', () => {
    expect(associatePortalPredicate(makeReq('/associates/apply/associate'))).toBe(false)
    expect(associatePortalPredicate(makeReq('/associates/sign-in'))).toBe(false)
    expect(associatePortalPredicate(makeReq('/preferred/portal'))).toBe(false)
  })

  it('protects /preferred/portal and its subroutes, unprefixed and locale-prefixed', () => {
    expect(preferredPortalPredicate(makeReq('/preferred/portal'))).toBe(true)
    expect(preferredPortalPredicate(makeReq('/preferred/portal/territory'))).toBe(true)
    expect(preferredPortalPredicate(makeReq('/hi/preferred/portal'))).toBe(true)
  })

  it('never protects /preferred/sign-in or the associate portal', () => {
    expect(preferredPortalPredicate(makeReq('/preferred/sign-in'))).toBe(false)
    expect(preferredPortalPredicate(makeReq('/associates/portal'))).toBe(false)
  })

  it('calls auth.protect with the associate sign-in redirect for the associate portal', async () => {
    const protect = vi.fn()
    const auth = Object.assign(vi.fn(), { protect })
    await capturedHandler!(auth, makeReq('/associates/portal'))
    expect(protect).toHaveBeenCalledWith({ unauthenticatedUrl: 'https://app.example.com/associates/sign-in' })
  })

  it('calls auth.protect with the preferred sign-in redirect for the preferred portal', async () => {
    const protect = vi.fn()
    const auth = Object.assign(vi.fn(), { protect })
    await capturedHandler!(auth, makeReq('/preferred/portal'))
    expect(protect).toHaveBeenCalledWith({ unauthenticatedUrl: 'https://app.example.com/preferred/sign-in' })
  })
})
