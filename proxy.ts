import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// The sign-in route itself must stay excluded from protection — it's the
// page unauthenticated users are sent to, and the matcher previously
// included it, which sent every visitor to Clerk's generic hosted portal
// instead of this app's own branded sign-in page. A predicate function (vs.
// a glob string) avoids any ambiguity between path-to-regexp glob syntax and
// regex lookahead syntax for this exclusion.
const isDashboardRoute = createRouteMatcher((req) => {
  const path = req.nextUrl.pathname
  return (path === '/dashboard' || path.startsWith('/dashboard/')) && !path.startsWith('/dashboard/sign-in')
})

export default clerkMiddleware(async (auth, req) => {
  if (isDashboardRoute(req)) {
    await auth.protect({ unauthenticatedUrl: new URL('/dashboard/sign-in', req.url).toString() })
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
