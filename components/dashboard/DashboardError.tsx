'use client'

import Link from 'next/link'
import { AlertCircle, Clock, ServerCrash, ShieldOff, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WrongAccountNotice } from '@/components/dashboard/WrongAccountNotice'
import { classifyApiError, wrongAccountOf, type ErrorKind } from '@/lib/dashboard/api-error'

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
