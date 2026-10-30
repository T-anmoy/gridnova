'use client'

import { useEffect, useRef, useState } from 'react'
import { SignUp, useAuth, useSignUp } from '@clerk/nextjs'
import { clerkErrorCode, isAlreadyRegistered, signInWithTicket } from '@/lib/auth/invitation'
import { DARK_CLERK_APPEARANCE } from '@/lib/auth/clerk-appearance'

export interface InvitationSignUpCopy {
  checking: string
  expiredTitle: string
  expiredBody: string
  signInInstead: string
}

type State = { kind: 'checking' } | { kind: 'form' } | { kind: 'expired' } | { kind: 'done' }

/**
 * Completes a Clerk invitation (the ticket in the URL): `signUp.ticket()` first — when the
 * invitation alone completes the sign-up, `finalize()` signs the person in and they land
 * on `afterUrl`; when Clerk still needs something (a password, a name), the prebuilt
 * <SignUp /> takes over and reads the same ticket from the URL. An expired or withdrawn
 * invitation gets a plain explanation instead of Clerk's generic error.
 */
export function InvitationSignUp({ ticket, path, signInPath, afterUrl, copy }: { ticket: string; path: string; signInPath: string; afterUrl: string; copy: InvitationSignUpCopy }) {
  const { signUp } = useSignUp()
  const { isSignedIn, isLoaded } = useAuth()
  const [state, setState] = useState<State>({ kind: 'checking' })
  const started = useRef(false)

  useEffect(() => {
    if (!isLoaded || !signUp || started.current) return
    started.current = true
    if (isSignedIn) {
      window.location.assign(afterUrl)
      return
    }
    void (async () => {
      const { error } = await signUp.ticket({ ticket })
      if (error) {
        if (isAlreadyRegistered(clerkErrorCode(error))) {
          window.location.assign(signInWithTicket(signInPath, ticket))
          return
        }
        setState({ kind: 'expired' })
        return
      }
      if (signUp.status === 'complete') {
        setState({ kind: 'done' })
        await signUp.finalize({ navigate: ({ decorateUrl }) => window.location.assign(decorateUrl(afterUrl)) })
        return
      }
      setState({ kind: 'form' })
    })()
  }, [isLoaded, isSignedIn, signUp, ticket, afterUrl, signInPath])

  if (state.kind === 'expired') {
    return (
      <div role="alert" data-testid="invitation-expired" className="rounded-xl border border-white/10 bg-[#0e2a63] p-6 text-left shadow-2xl">
        <h2 className="font-display text-lg font-semibold text-white">{copy.expiredTitle}</h2>
        <p className="mt-2 font-utility text-sm leading-relaxed text-white/75">{copy.expiredBody}</p>
        <a href={signInPath} className="mt-5 inline-flex min-h-[44px] items-center font-utility text-sm font-semibold text-[#f7a800] hover:text-[#ffd27a]">{copy.signInInstead}</a>
      </div>
    )
  }
  if (state.kind === 'form') {
    return <SignUp routing="path" path={path} signInUrl={signInPath} forceRedirectUrl={afterUrl} appearance={DARK_CLERK_APPEARANCE} />
  }
  return <p role="status" data-testid="invitation-checking" className="text-center font-utility text-sm text-white/70">{copy.checking}</p>
}

/**
 * BE-21: the sign-up without an invitation link — for a person whose invitation email never
 * arrived. Clerk's sign-up stays open; the backend decides what the new account may open.
 */
export function OpenSignUp({ path, signInPath, afterUrl }: { path: string; signInPath: string; afterUrl: string }) {
  return <SignUp routing="path" path={path} signInUrl={signInPath} forceRedirectUrl={afterUrl} appearance={DARK_CLERK_APPEARANCE} />
}
