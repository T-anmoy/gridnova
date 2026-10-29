import { toast } from 'sonner'
import { classifyApiError } from '@/lib/dashboard/api-error'
import { isNotAuthenticatedError } from './http'

// How long to suppress further redirects after the first one, in case the
// navigation never completes (the flag then resets instead of sticking).
export const AUTH_REDIRECT_RESET_MS = 10_000

type SignOut = (options: { redirectUrl: string }) => Promise<unknown>

// Clerk's browser SDK exposes itself on window; reading it here avoids threading
// a hook value into a QueryClient created once per mount.
function clerkSignOut(): SignOut | undefined {
  return (window as unknown as { Clerk?: { signOut?: SignOut } }).Clerk?.signOut?.bind((window as unknown as { Clerk: object }).Clerk)
}

/**
 * Cross-cutting session-expiry handler for a QueryClient. Two different cases:
 *  - no Clerk token (we are signed out): plain redirect to sign-in;
 *  - the backend answered 401 while Clerk still has a session: redirecting
 *    alone would bounce straight back to the app and loop, so the Clerk
 *    session is ended first.
 * The current path *and query string* are preserved as the return target.
 */
export function createAuthExpiryHandler(options: { signInPath: string; getSignOut?: () => SignOut | undefined })  {
  let redirecting = false
  return function handleAuthExpiry(error: unknown) {
    if (typeof window === 'undefined') return
    if (classifyApiError(error).kind !== 'auth') return
    // Already on the sign-in page: a background query failing here must not redirect again,
    // or every reload nests another ?redirect_url= and the page never settles.
    if (window.location.pathname.startsWith(options.signInPath)) return
    if (redirecting) return
    redirecting = true
    setTimeout(() => {
      redirecting = false
    }, AUTH_REDIRECT_RESET_MS)
    toast.error('Your session expired — please sign in again')
    const returnTo = `${window.location.pathname}${window.location.search}`
    const target = `${options.signInPath}?redirect_url=${encodeURIComponent(returnTo)}`
    const signOut = (options.getSignOut ?? clerkSignOut)()
    if (!isNotAuthenticatedError(error) && signOut) {
      void signOut({ redirectUrl: target }).catch(() => {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- runs outside React (QueryClient callback), and a full load clears the expired session's state
        window.location.href = target
      })
      return
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- as above
    window.location.href = target
  }
}
