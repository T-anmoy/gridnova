'use client'

import { useState } from 'react'
import { Link2, ShieldOff } from 'lucide-react'
import { useAuth, useClerk } from '@clerk/nextjs'
import { notAuthenticatedError } from '@/lib/api/http'
import { claimAssociateAccount } from '@/lib/associate/api-client'
import { claimErrorText } from '@/lib/associate/portal-error'
import { useMessages, useLocale } from '@/lib/i18n/client'
import { localizeHref } from '@/lib/i18n/config'
import { usePathname } from 'next/navigation'

const button =
  'inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 font-utility text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f5daa]/40 disabled:opacity-60'

type State = { kind: 'idle' } | { kind: 'linking' } | { kind: 'linked' } | { kind: 'failed'; error: unknown }

/**
 * BE-21: the signed-in Clerk user carries no associate principal — a fresh sign-up by an
 * approved associate whose invitation email never arrived (or a staff account opening the
 * portal). "Link my account" asks the backend to bind this sign-in by a verified email
 * match; on success the Clerk session is reloaded so the token carries the associate
 * claims, and the page opens again. Signing out stays the person's own click.
 */
export function ClaimAccountNotice() {
  const copy = useMessages('portalFeedback').claim
  const locale = useLocale()
  const clerk = useClerk()
  const { getToken } = useAuth()
  const [state, setState] = useState<State>({ kind: 'idle' })
  const signIn = localizeHref((usePathname() ?? '').includes('/preferred/') ? '/preferred/sign-in' : '/associates/sign-in', locale)

  async function link() {
    setState({ kind: 'linking' })
    try {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      await claimAssociateAccount(token)
    } catch (error) {
      setState({ kind: 'failed', error })
      return
    }
    setState({ kind: 'linked' })
    // The new public_metadata reaches the session token only after a refresh.
    try {
      await clerk.session?.reload()
      await getToken({ skipCache: true })
    } finally {
      window.location.reload()
    }
  }

  const busy = state.kind === 'linking' || state.kind === 'linked'
  return (
    <div role="alert" data-testid="claim-account" className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div>
          <p className="font-display text-base font-semibold text-amber-900">{copy.title}</p>
          <p className="mt-1 font-utility text-sm leading-relaxed text-amber-900/90">{copy.body}</p>
          {state.kind === 'linked' && (
            <p role="status" data-testid="claim-linked" className="mt-3 font-utility text-sm font-semibold text-green-800">{copy.linked}</p>
          )}
          {state.kind === 'failed' && (
            <p data-testid="claim-error" className="mt-3 flex gap-2 font-utility text-sm text-red-800">
              <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {claimErrorText(state.error, copy)}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" data-testid="claim-button" onClick={() => void link()} disabled={busy}
              className={`${button} border-[#0e2a63] bg-[#0e2a63] text-white`}>
              {busy ? copy.linking : copy.button}
            </button>
            <button type="button" onClick={() => void clerk.signOut({ redirectUrl: signIn })}
              className={`${button} border-amber-300 bg-white text-amber-900`}>
              {copy.signOut}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
