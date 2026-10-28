'use client'

import Link from 'next/link'
import { AlertCircle, Clock, MapPinOff, ServerCrash, ShieldOff, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WrongAccountNotice } from '@/components/dashboard/WrongAccountNotice'
import { classifyApiError, isMissingClaimsError, wrongAccountOf, type ErrorKind } from '@/lib/dashboard/api-error'
import { useOptionalMessages } from '@/lib/i18n/client'
import { isOutsideRegions } from '@/lib/associate/staff-associates'

const MISSING_CLAIMS_FALLBACK = {
  title: 'Sign-in not fully set up',
  body: 'Your sign-in is not fully set up — contact Grid Nova.',
}

/** One plain message for BE-1's `session_token_missing_claims` — never a retry loop. */
export function MissingClaimsNotice() {
  const copy = useOptionalMessages('portalErrors')?.missingClaims ?? MISSING_CLAIMS_FALLBACK
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3" role="alert" data-testid="missing-claims">
      <ShieldOff className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
      <div>
        <p className="font-utility font-medium text-amber-800">{copy.title}</p>
        <p className="font-utility text-sm mt-1 text-amber-700">{copy.body}</p>
      </div>
    </div>
  )
}

const KIND_ICON: Record<ErrorKind, React.ElementType> = {
  wrongAccount: ShieldOff,
  auth: ShieldOff,
  forbidden: ShieldOff,
  rateLimited: Clock,
  server: ServerCrash,
  network: WifiOff,
  client: AlertCircle,
}

// Amber for "warning" states the user can wait out or that aren't errors of the
// system (permission, rate limit); red for genuine failures.
const AMBER: ErrorKind[] = ['forbidden', 'rateLimited', 'auth']

/** A reviewer opened a record in a region they do not work in (access_control.md §4): not an error. */
export function OutsideRegionsNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3" role="status" data-testid="outside-regions">
      <MapPinOff className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
      <div>
        <p className="font-utility font-medium text-amber-800">Outside the regions you work in</p>
        <p className="font-utility text-sm mt-1 text-amber-700">
          This record belongs to a region that is not one of yours, so it isn’t shown to you. Ask an Admin, or a colleague who covers that region.
        </p>
      </div>
    </div>
  )
}

/**
 * Inline error card that shows a distinct, honest state per failure mode and
 * surfaces the real status code + message (not a generic "dead server").
 */
export function DashboardError({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  const wrong = wrongAccountOf(error)
  if (wrong) return <WrongAccountNotice kind={wrong} />
  if (isMissingClaimsError(error)) return <MissingClaimsNotice />
  if (isOutsideRegions(error)) return <OutsideRegionsNotice />
  const c = classifyApiError(error)
  const Icon = KIND_ICON[c.kind]
  const amber = AMBER.includes(c.kind)

  const box = amber
    ? 'border-amber-200 bg-amber-50'
    : 'border-red-100 bg-red-50'
  const iconColor = amber ? 'text-amber-600' : 'text-red-500'
  const headingColor = amber ? 'text-amber-800' : 'text-red-700'
  const detailColor = amber ? 'text-amber-700' : 'text-red-500'

  return (
    <div className={`rounded-xl border p-6 flex items-start gap-3 ${box}`} role="alert">
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
      <div>
        <p className={`font-utility font-medium ${headingColor}`}>{c.heading}</p>

        {c.kind === 'rateLimited' ? (
          <p className={`font-utility text-sm mt-1 ${detailColor}`}>
            Too many requests — retrying automatically.
          </p>
        ) : c.kind === 'forbidden' ? (
          <p className={`font-utility text-sm mt-1 ${detailColor}`}>
            You’re signed in, but your role can’t access this. Contact an admin if you think this is wrong.
          </p>
        ) : (
          <p className={`font-utility text-sm mt-1 ${detailColor}`}>{c.detail}</p>
        )}

        <div className="mt-3 flex items-center gap-2">
          {c.kind === 'auth' ? (
            <Link href="/dashboard/sign-in">
              <Button variant="outline" size="sm">Sign in again</Button>
            </Link>
          ) : (
            onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {c.kind === 'rateLimited' ? 'Retry now' : 'Retry'}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
