import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { localeRouting } from '@/lib/i18n/routing'

const DASHBOARD_AUTH_PAGES = ['/dashboard/sign-in', '/dashboard/sign-up']
function isDashboardAuthPage(path: string): boolean {
  return DASHBOARD_AUTH_PAGES.some((p) => path === p || path.startsWith(`${p}/`))
}

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
// accept page and must never require staff sign-in. The same holds for the Studio's
// online proposal `/proposal/<token>` (BE-18) — only the exact path `/proposal/new` is
// protected — and for `/verify/p/<code>`, a public-site page.
//
// `/dashboard/sign-up` (FE-17) is where a staff invitation link lands
// (STAFF_INVITE_REDIRECT_URL): the invited person has no session yet, so it
// stays reachable signed out too. Without an invitation ticket it is an open
// sign-up (BE-21: for a person whose invitation email never arrived); the backend
// refuses anyone not invited (403 not_invited).
const isProtectedRoute = createRouteMatcher((req) => {
  const path = req.nextUrl.pathname
  if (path === '/dashboard' || path.startsWith('/dashboard/')) {
    return !isDashboardAuthPage(path)
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

const clerk = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect({ unauthenticatedUrl: new URL('/dashboard/sign-in', req.url).toString() })
    return
  }
  // The portals live under app/(site)/[lang]: once signed in, an English path with no
  // prefix still needs its /en rewrite (FE-19 — without it /associates/portal was a 404).
  if (isAssociatePortalRoute(req)) {
    await auth.protect({ unauthenticatedUrl: new URL('/associates/sign-in', req.url).toString() })
    return localeRouting(req)
  }
  if (isPreferredPortalRoute(req)) {
    await auth.protect({ unauthenticatedUrl: new URL('/preferred/sign-in', req.url).toString() })
    return localeRouting(req)
  }
  // Public site only: `/dashboard`, `/proposal` and `/api` are left untouched
  // (English, unprefixed) by localeRouting itself.
  return localeRouting(req)
})

// Only the parts of the site that use Clerk go through it: the staff
// dashboard, the proposal pages, the API, and the Associate/Preferred trees
// (portals, sign-in, registration). Public marketing pages never read a Clerk
// session, and sending them through clerkMiddleware cost every first-time
// visitor a cross-site handshake redirect (measured ~2 s on mobile — FE-10)
// whenever the deployment runs Clerk development keys. The three protection
// matchers above are part of this test, so a protected route can never skip it.
const LOCALE_SEGMENT = /^\/(?:en|hi|bn)(?=\/|$)/
function usesClerk(req: NextRequest): boolean {
  if (isProtectedRoute(req) || isAssociatePortalRoute(req) || isPreferredPortalRoute(req)) return true
  const path = req.nextUrl.pathname
  if (/^\/(?:dashboard|proposal|api|trpc)(?:\/|$)/.test(path)) return true
  const bare = path.replace(LOCALE_SEGMENT, '') || '/'
  return /^\/(?:associates|preferred)(?:\/|$)/.test(bare)
}

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (usesClerk(req)) return clerk(req, event)
  // Public site only: `/dashboard`, `/proposal` and `/api` are left untouched
  // (English, unprefixed) by localeRouting itself.
  return localeRouting(req)
}

// Next internals and real static assets are skipped; everything else — including
// dynamic routes whose last segment merely looks like a file (/dashboard/leads/1.html,
// /dashboard/exports/x.csv) — goes through the proxy (and clerkMiddleware wherever
// usesClerk says), so a crafted suffix can never bypass the protection above. Documents/data extensions (html, csv, docx,
// xlsx, zip) are deliberately NOT in this list.
// (The matcher must stay a literal: Next analyses it statically at build time.)
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
