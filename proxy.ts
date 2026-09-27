import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { localeRouting } from '@/lib/i18n/routing'

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

// Associate/Preferred portals are a distinct auth world from the staff
// dashboard above (associate Clerk principal, not staff role) — kept as its
// own matcher/redirect pair rather than merged into isProtectedRoute, so a
// change to one route-protection scheme can never accidentally leak into the
// other. Each locale prefixes the portal path (e.g. /hi/associates/portal),
// so the check strips a leading locale segment before matching.
const LOCALE_PREFIX = /^\/(?:hi|bn)(?=\/|$)/
function stripLocalePrefix(path: string): string {
  return path.replace(LOCALE_PREFIX, '') || '/'
}

const isAssociatePortalRoute = createRouteMatcher((req) => {
  const path = stripLocalePrefix(req.nextUrl.pathname)
  return path === '/associates/portal' || path.startsWith('/associates/portal/')
})
const isPreferredPortalRoute = createRouteMatcher((req) => {
  const path = stripLocalePrefix(req.nextUrl.pathname)
  return path === '/preferred/portal' || path.startsWith('/preferred/portal/')
})

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect({ unauthenticatedUrl: new URL('/dashboard/sign-in', req.url).toString() })
    return
  }
  if (isAssociatePortalRoute(req)) {
    await auth.protect({ unauthenticatedUrl: new URL('/associates/sign-in', req.url).toString() })
    return
  }
  if (isPreferredPortalRoute(req)) {
    await auth.protect({ unauthenticatedUrl: new URL('/preferred/sign-in', req.url).toString() })
    return
  }
  // Public site only: `/dashboard`, `/proposal` and `/api` are left untouched
  // (English, unprefixed) by localeRouting itself.
  return localeRouting(req)
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
