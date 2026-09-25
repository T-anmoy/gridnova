import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture the predicate passed to createRouteMatcher and the handler passed
// to clerkMiddleware so the real routing logic in proxy.ts can be exercised
// directly, without needing a real Clerk session or a running server.
let capturedPredicate: ((req: { nextUrl: { pathname: string } }) => boolean) | undefined
let capturedHandler: ((auth: unknown, req: { nextUrl: { pathname: string } }) => unknown) | undefined

vi.mock('@clerk/nextjs/server', () => ({
  createRouteMatcher: (predicate: typeof capturedPredicate) => {
    capturedPredicate = predicate
    return (req: { nextUrl: { pathname: string } }) => predicate!(req)
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
  capturedPredicate = undefined
  capturedHandler = undefined
  await import('@/proxy')
})

describe('proxy.ts — protected route matcher', () => {
  it('protects /proposal/new, the internal sales site-assessment wizard', () => {
    expect(capturedPredicate!(makeReq('/proposal/new'))).toBe(true)
  })

  it('never protects /proposal/accept/[token] — the public customer accept page', () => {
    expect(capturedPredicate!(makeReq('/proposal/accept/abc123'))).toBe(false)
  })

  it('still protects every /dashboard route except sign-in', () => {
    expect(capturedPredicate!(makeReq('/dashboard'))).toBe(true)
    expect(capturedPredicate!(makeReq('/dashboard/leads/19'))).toBe(true)
    expect(capturedPredicate!(makeReq('/dashboard/sign-in'))).toBe(false)
  })

  it('leaves public marketing pages untouched', () => {
    expect(capturedPredicate!(makeReq('/'))).toBe(false)
    expect(capturedPredicate!(makeReq('/about'))).toBe(false)
  })

  it('calls auth.protect with the dashboard sign-in redirect for /proposal/new, same as the dashboard', async () => {
    const protect = vi.fn()
    const auth = Object.assign(vi.fn(), { protect })
    await capturedHandler!(auth, makeReq('/proposal/new'))
    expect(protect).toHaveBeenCalledWith({ unauthenticatedUrl: 'https://app.example.com/dashboard/sign-in' })
  })
})
