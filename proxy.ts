import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// The sign-in route itself must stay excluded from protection — it's the
// page unauthenticated users are sent to, and the matcher previously
// included it, which sent every visitor to Clerk's generic hosted portal
// instead of this app's own branded sign-in page. A predicate function (vs.
// a glob string) avoids any ambiguity between path-to-regexp glob syntax and
// regex lookahead syntax for this exclusion.
//
// `/proposal/new` is the internal sales-team site-assessment wizard — it was
// previously reachable by anyone with the link. It gets the same Clerk
// protection as the dashboard (same unauthenticated redirect), unlike
// `/proposal/accept/[token]`, which stays public — that's the customer-facing
// accept page and must never require staff sign-in.
const isProtectedRoute = createRouteMatcher((req) => {
  const path = req.nextUrl.pathname
  if (path === '/dashboard' || path.startsWith('/dashboard/')) {
    return !path.startsWith('/dashboard/sign-in')
  }
  return path === '/proposal/new'
})

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect({ unauthenticatedUrl: new URL('/dashboard/sign-in', req.url).toString() })
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
