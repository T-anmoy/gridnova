'use client'

import Link from 'next/link'
import { AlertCircle, Clock, Phone, SearchX, ServerCrash, ShieldOff, WifiOff } from 'lucide-react'
import { WrongAccountNotice } from '@/components/dashboard/WrongAccountNotice'
import { ClaimAccountNotice } from '@/components/associate/ClaimAccountNotice'
import { MissingClaimsNotice } from '@/components/dashboard/DashboardError'
import { isMissingClaimsError, wrongAccountOf } from '@/lib/dashboard/api-error'
import { failureOf, inactiveAccountOf, type PortalFailure } from '@/lib/associate/portal-error'
import { HELPLINE_DISPLAY, HELPLINE_TEL } from '@/lib/contact'
import { useMessages, useLocale } from '@/lib/i18n/client'
import { localizeHref } from '@/lib/i18n/config'
import { usePathname } from 'next/navigation'

const ICON: Record<PortalFailure, React.ElementType> = {
  offline: WifiOff,
  network: WifiOff,
  server: ServerCrash,
  rateLimited: Clock,
  auth: ShieldOff,
  forbidden: ShieldOff,
  notFound: SearchX,
  conflict: AlertCircle,
  invalid: AlertCircle,
  generic: AlertCircle,
}

// Load failures that are not the associate's doing and pass by themselves are amber, not red.
const CALM: PortalFailure[] = ['offline', 'network', 'rateLimited', 'auth', 'forbidden', 'notFound']

const button =
  'inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 font-utility text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f5daa]/40'

/**
 * The portal's card for a page or section that could not load, in the reader's
 * language: what happened, what to do, and Try again — never a status code or
 * the server's English text. A suspended or deactivated account gets its own
 * notice, because every portal call is refused for it.
 */
export function PortalError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const copy = useMessages('portalFeedback')
  const locale = useLocale()
  const pathname = usePathname() ?? ''
  const wrong = wrongAccountOf(error)
  // BE-21: a sign-in with no associate principal may be an approved associate whose
  // invitation never arrived — offer to link it (signing out stays on the card).
  if (wrong === 'staff_on_associate') return <ClaimAccountNotice />
  if (wrong) return <WrongAccountNotice kind={wrong} />
  if (isMissingClaimsError(error)) return <MissingClaimsNotice />

  const account = inactiveAccountOf(error)
  if (account) {
    const text = copy.account[account]
    return (
      <div role="alert" data-testid={`account-${account}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <p className="font-display text-base font-semibold text-amber-900">{text.title}</p>
            <p className="mt-1 font-utility text-sm leading-relaxed text-amber-900/90">{text.body}</p>
            <a href={HELPLINE_TEL} className={`${button} mt-4 border-amber-300 bg-white text-amber-900`}>
              <Phone className="h-4 w-4" aria-hidden="true" /> {copy.call} · {HELPLINE_DISPLAY}
            </a>
          </div>
        </div>
      </div>
    )
  }

  const kind = failureOf(error)
  const text = kind in copy.load ? copy.load[kind as keyof typeof copy.load] : copy.load.generic
  const Icon = ICON[kind]
  const calm = CALM.includes(kind)
  const signIn = localizeHref(pathname.includes('/preferred/') ? '/preferred/sign-in' : '/associates/sign-in', locale)

  return (
    <div
      role="alert"
      data-testid="portal-error"
      data-kind={kind}
      className={`rounded-2xl border p-5 ${calm ? 'border-amber-200 bg-amber-50' : 'border-red-100 bg-red-50'}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${calm ? 'text-amber-700' : 'text-red-600'}`} aria-hidden="true" />
        <div>
          <p className={`font-display text-base font-semibold ${calm ? 'text-amber-900' : 'text-red-800'}`}>{text.title}</p>
          <p className={`mt-1 font-utility text-sm leading-relaxed ${calm ? 'text-amber-900/90' : 'text-red-800/90'}`}>{text.body}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {kind === 'auth' ? (
              <Link href={signIn} className={`${button} border-amber-300 bg-white text-amber-900`}>
                {copy.signIn}
              </Link>
            ) : (
              onRetry &&
              kind !== 'forbidden' &&
              kind !== 'notFound' && (
                <button type="button" onClick={onRetry} className={`${button} border-[#e4e8ee] bg-white text-[#0e2a63]`}>
                  {copy.retry}
                </button>
              )
            )}
            {kind === 'server' && (
              <a href={HELPLINE_TEL} className={`${button} border-[#e4e8ee] bg-white text-[#0e2a63]`}>
                <Phone className="h-4 w-4" aria-hidden="true" /> {copy.call}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
