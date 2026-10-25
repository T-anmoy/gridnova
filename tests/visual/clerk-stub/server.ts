// Stand-in for `@clerk/nextjs/server` in the visual-matrix build ONLY (see
// client.tsx for why). Protection still redirects a visitor without the
// vm_principal cookie, so the proxy's route matchers keep their real shape.
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

const STUB_TOKEN = 'visual-matrix-stub-token'

class Unauthenticated extends Error {
  constructor(readonly url: string) {
    super('unauthenticated')
  }
}

type Handler = (
  auth: { protect: (opts?: { unauthenticatedUrl?: string }) => Promise<void> },
  req: NextRequest,
) => Promise<Response | void> | Response | void

export function clerkMiddleware(handler: Handler) {
  return async (req: NextRequest) => {
    const signedIn = !!req.cookies.get('vm_principal')?.value
    const auth = {
      protect: async (opts?: { unauthenticatedUrl?: string }) => {
        if (!signedIn) throw new Unauthenticated(opts?.unauthenticatedUrl ?? new URL('/', req.url).toString())
      },
    }
    try {
      return (await handler(auth, req)) ?? NextResponse.next()
    } catch (e) {
      if (e instanceof Unauthenticated) return NextResponse.redirect(e.url)
      throw e
    }
  }
}

export function createRouteMatcher(match: (req: NextRequest) => boolean) {
  return match
}

export async function auth() {
  const signedIn = !!(await cookies()).get('vm_principal')?.value
  return { userId: signedIn ? 'visual-matrix' : null, getToken: async () => (signedIn ? STUB_TOKEN : null) }
}
