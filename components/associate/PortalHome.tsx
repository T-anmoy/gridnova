'use client'

import { AlertCircle, ChevronRight, Plus } from 'lucide-react'
import Link from '@/components/i18n/Link'
import { useAssociateMe } from '@/lib/associate/api-client'
import { useAssociateHome } from '@/lib/associate/home-api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import PinnedAction from '@/components/associate/PinnedAction'
import { describeTodo, todoHref } from '@/lib/onboarding/todo'
import { fmt, type Messages } from '@/lib/i18n/types'

type HomeCopy = Messages['associates']['portal']['associate']['home']
type FeedCopy = Messages['associates']['portal']['feed']
type StageNames = Record<string, string>

const PRIORITY_STYLE: Record<number, string> = {
  1: 'border-[#f7a800] bg-[#fffaf0]',
  2: 'border-[#e4e8ee] bg-white',
  3: 'border-[#e4e8ee] bg-[#f7f9fc]',
}

function Skeleton() {
  return (
    <div role="status" aria-busy="true" className="mt-6 space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#eef1f6]" />
      ))}
    </div>
  )
}

/**
 * The portal home: a to-do feed built from GET /associate/home. Cards come
 * sorted by the server (priority, then customer); each one translates its
 * message key + params, and an unknown key shows a safe generic line.
 */
export default function PortalHome({
  copy,
  feed,
  stageNames,
  portalBase,
}: {
  copy: HomeCopy
  feed: FeedCopy
  stageNames: StageNames
  portalBase: '/associates/portal' | '/preferred/portal'
}) {
  const { data: me, error: meError, refetch: refetchMe } = useAssociateMe()
  const { data: home, isLoading, error, refetch } = useAssociateHome()

  if (meError) return <DashboardError error={meError} onRetry={() => void refetchMe()} />

  const statusNote = me ? (me.status === 'active' ? copy.statusActive : me.status === 'suspended' ? copy.statusSuspended : copy.statusDeactivated) : null

  return (
    <div className="pb-24 sm:pb-0">
      {me ? (
        <>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">{fmt(copy.title, { name: me.full_name })}</h1>
          <p className="mt-1 font-utility text-sm text-[#111827]/50">
            {fmt(copy.subtitle, { associateId: me.associate_id, level: me.level ? me.level.replace(/_/g, ' ') : '' })}
          </p>
          <p className={`mt-3 font-utility text-sm ${me.status === 'active' ? 'text-green-700' : 'text-amber-700'}`}>{statusNote}</p>
        </>
      ) : (
        <div className="h-16 animate-pulse rounded-xl bg-[#eef1f6]" />
      )}

      {error ? (
        <div className="mt-6">
          {error && <DashboardError error={error} onRetry={() => void refetch()} />}
        </div>
      ) : isLoading || !home ? (
        <Skeleton />
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-3 gap-2 text-center" data-testid="home-totals">
            {([
              [feed.totals.customers, home.totals.customers],
              [feed.totals.awaitingGridNova, home.totals.awaiting_grid_nova],
              [feed.totals.needingAction, home.totals.needing_action],
            ] as const).map(([label, n]) => (
              <div key={label} className="rounded-xl border border-[#e4e8ee] bg-white px-2 py-3">
                <dd className="font-display text-xl font-bold text-[#0e2a63]">{n}</dd>
                <dt className="text-[11px] text-[#111827]/50 font-utility">{label}</dt>
              </div>
            ))}
          </dl>

          <h2 className="mt-8 font-display text-lg font-semibold text-[#0e2a63]">{feed.title}</h2>

          {home.items.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#e4e8ee] bg-white p-8 text-center" data-testid="caught-up">
              <p className="font-display text-lg font-semibold text-[#0e2a63]">{feed.caughtUpTitle}</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#111827]/55">{feed.caughtUpBody}</p>
              <Link
                href={`${portalBase}/customers/new`}
                className="mt-5 inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-[#0e2a63] px-8 text-base font-semibold text-white"
              >
                <Plus className="h-5 w-5" /> {feed.addCustomer}
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3" aria-label={feed.title}>
              {home.items.map((item) => (
                <li key={`${item.kind}-${item.onboarding_id}-${item.message_key}`}>
                  <Link
                    href={todoHref(item, portalBase)}
                    data-testid="todo-card"
                    data-priority={item.priority}
                    className={`flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border-2 p-4 ${PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE[3]}`}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-display text-base font-semibold text-[#0e2a63]">
                        {item.priority === 1 && <AlertCircle className="h-4 w-4 shrink-0 text-[#b87700]" aria-label={feed.priority['1']} />}
                        <span className="truncate">{item.customer_name}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-[#111827]/70">{describeTodo(item, feed, stageNames)}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[#111827]/30" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {home.items.length > 0 && (
            <div className="mt-6">
              <PinnedAction>
                <Link
                  href={`${portalBase}/customers/new`}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#0e2a63] px-6 text-base font-semibold text-white sm:inline-flex sm:w-auto"
                >
                  <Plus className="h-5 w-5" /> {feed.addCustomer}
                </Link>
              </PinnedAction>
            </div>
          )}
        </>
      )}
    </div>
  )
}
