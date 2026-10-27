'use client'

// Stand-in for `@clerk/nextjs` in the visual-matrix build ONLY (next.config.ts
// aliases it when VISUAL_STUB_AUTH=1; a normal build never sees this file).
// Real Clerk cannot sign in from headless Chromium without a Clerk account, and
// the matrix has to render the dashboard and the portals, so the signed-in
// principal comes from a cookie the Playwright run sets:
//
//   vm_principal=staff:admin            a staff user with that role
//   vm_principal=associate:GNA-…        an Associate / Preferred Associate
//
// The token handed to the API is a placeholder; the matrix's page.route proxy
// swaps it for the backend's development-only X-Employee-* / X-Associate-Id
// headers, so nothing here authenticates against a real backend.

import { useSyncExternalStore, type ReactNode } from 'react'

export const STUB_TOKEN = 'visual-matrix-stub-token'

type Principal = { kind: 'staff'; role: string } | { kind: 'associate'; id: string } | null

function readPrincipal(): string {
  const m = document.cookie.match(/(?:^|; )vm_principal=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

function parse(raw: string): Principal {
  const [kind, value] = raw.split(':')
  if (kind === 'staff' && value) return { kind: 'staff', role: value }
  if (kind === 'associate' && value) return { kind: 'associate', id: value }
  return null
}

const noop = () => () => {}
// The server snapshot is "not loaded yet", exactly like real Clerk before it
// hydrates, so server and client render the same first frame.
function usePrincipal(): { loaded: boolean; principal: Principal } {
  const raw = useSyncExternalStore(noop, readPrincipal, () => null)
  return raw === null ? { loaded: false, principal: null } : { loaded: true, principal: parse(raw) }
}

function userFor(p: Principal) {
  if (!p) return null
  const name = p.kind === 'staff' ? 'Visual' : 'Associate'
  const email = p.kind === 'staff' ? `visual-${p.role}@example.test` : `${p.id.toLowerCase()}@example.test`
  return {
    id: p.kind === 'staff' ? `visual-${p.role}` : p.id,
    firstName: name,
    lastName: 'Matrix',
    emailAddresses: [{ emailAddress: email }],
    publicMetadata: p.kind === 'staff' ? { role: p.role } : { principal: 'associate', associate_id: p.id },
  }
}

export function ClerkProvider({ children }: { children: ReactNode; [key: string]: unknown }) {
  return <>{children}</>
}

export function useUser() {
  const { loaded, principal } = usePrincipal()
  return { isLoaded: loaded, isSignedIn: loaded && !!principal, user: userFor(principal) }
}

export function useAuth() {
  const { loaded, principal } = usePrincipal()
  return {
    isLoaded: loaded,
    isSignedIn: loaded && !!principal,
    userId: userFor(principal)?.id ?? null,
    // Read at call time, like Clerk's own getToken: a query started from the
    // hydration render (when the snapshot is still "not loaded") must still get a token.
    getToken: async () => (parse(readPrincipal()) ? STUB_TOKEN : null),
  }
}

export function useClerk() {
  return {
    signOut: async () => {
      document.cookie = 'vm_principal=; Max-Age=0; path=/'
    },
    openUserProfile: () => {},
  }
}

// Invitation sign-up (FE-17): the ticket `tok-expired` fails like a withdrawn invitation;
// any other leaves Clerk's own form (stubbed below) to finish.
export function useSignUp() {
  return {
    signUp: {
      status: 'missing_requirements',
      ticket: async ({ ticket }: { ticket: string }) => ({ error: ticket === 'tok-expired' ? { code: 'ticket_expired' } : null }),
      finalize: async () => ({ error: null }),
    },
  }
}

export function SignUp() {
  return <p data-testid="visual-stub-sign-up">Sign-up is stubbed in the visual-matrix build.</p>
}

export function SignIn() {
  return <p data-testid="visual-stub-sign-in">Sign-in is stubbed in the visual-matrix build.</p>
}
