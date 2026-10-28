'use client'

import Link from 'next/link'
import { ArrowRight, CalendarClock, CheckCircle2, Eye, FilePen, FilePlus2, Hourglass, Send, Trophy } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { usePermissions } from '@/lib/access/use-permissions'
import { useStudioPendingApprovals, useStudioProposals, useStudioSummary } from '@/lib/studio/api'
import { daysUntil, kwpText, validityText } from '@/lib/studio/logic'
import type { StudioProposalSummary } from '@/lib/studio/types'
import { formatTimeAgo } from '@/lib/dashboard/utils'
import { Money, Panel, StatusChip } from './ui'

const pct = new Intl.NumberFormat('en-IN', { style: 'percent', maximumFractionDigits: 0 })

function Stat({ label, value, sub, icon: Icon, href, testId }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ElementType; href?: string; testId: string }) {
  const body = (
    <div className="flex h-full flex-col rounded-xl border border-[#e4e8ee] bg-white p-4 transition-shadow hover:shadow-md" data-testid={testId}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-utility text-sm text-[#111827]/65">{label}</p>
        <span className="rounded-lg bg-[#f7a800]/10 p-1.5 text-[#8a5a00]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-[#091c3c]">{value}</p>
      {sub && <p className="mt-0.5 font-utility text-xs text-[#111827]/60">{sub}</p>}
    </div>
  )
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7a800]">
      {body}
    </Link>
  ) : (
    body
  )
}

export function ProposalLine({ p, note }: { p: StudioProposalSummary; note?: React.ReactNode }) {
  return (
    <li>
      <Link
        href={`/dashboard/studio/proposals/${p.id}`}
        className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2.5 hover:bg-[#f7f9fc] focus-visible:outline-2 focus-visible:outline-[#f7a800]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-utility text-sm font-medium text-[#091c3c]">{p.customer?.name ?? p.title}</span>
          <span className="block truncate font-utility text-xs text-[#111827]/60">
            {p.document_reference ?? p.code} · {p.title}
          </span>
        </span>
        {note && <span className="font-utility text-xs text-[#111827]/70">{note}</span>}
        <Money value={p.total} className="font-utility text-sm text-[#091c3c]" />
        <StatusChip status={p.status} />
      </Link>
    </li>
  )
}

function List({ title, items, loading, empty, note, testId, more }: { title: string; items: StudioProposalSummary[]; loading: boolean; empty: string; note?: (p: StudioProposalSummary) => React.ReactNode; testId: string; more?: string }) {
  return (
    <Panel title={title} className="p-3 md:p-4" actions={more ? <Link href={more} className="inline-flex min-h-11 items-center gap-1 font-utility text-sm text-[#0e2a63] hover:underline">See all <ArrowRight className="h-3.5 w-3.5" /></Link> : undefined}>
      <div data-testid={testId}>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-2 font-utility text-sm text-[#111827]/60">{empty}</p>
        ) : (
          <ul className="-mx-1 divide-y divide-[#eef1f5]">
            {items.map((p) => (
              <ProposalLine key={p.id} p={p} note={note?.(p)} />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}

export default function StudioHome() {
  const { can } = usePermissions()
  const summary = useStudioSummary()
  const canApprove = can('studio.approve')
  const canEdit = can('studio.edit')
  const pending = useStudioPendingApprovals({ enabled: canApprove, pageSize: 10 })
  const viewed = useStudioProposals({ status: 'viewed', page_size: 10 })
  const issued = useStudioProposals({ status: 'issued', page_size: 50 })
  const recent = useStudioProposals({ page_size: 8 })

  const openIssued = [...(issued.data?.items ?? []), ...(viewed.data?.items ?? [])]
  const expiring = openIssued
    .filter((p) => {
      const n = daysUntil(p.valid_until)
      return n != null && n >= 0 && n <= 7
    })
    .slice(0, 10)

  const s = summary.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">Proposal Studio</h1>
          <p className="mt-1 font-utility text-sm text-[#111827]/65">Prepare, price and send Grid Nova proposals — every figure is worked out for you.</p>
        </div>
        {canEdit && (
          <Link
            href="/dashboard/studio/new"
            data-testid="new-proposal"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#f7a800] px-5 font-utility text-base font-semibold text-[#091c3c] shadow-sm transition-colors hover:bg-[#ffb81f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e2a63]"
          >
            <FilePlus2 className="h-5 w-5" aria-hidden="true" /> New proposal
          </Link>
        )}
      </div>

      {summary.error ? (
        <DashboardError error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="studio-summary">
          {!s ? (
            Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
          ) : (
            <>
              <Stat testId="stat-drafts" label="Drafts" value={s.drafts} icon={FilePen} href="/dashboard/studio/proposals?status=draft" sub="Being prepared" />
              <Stat testId="stat-awaiting" label="Awaiting approval" value={s.awaiting_approval} icon={Hourglass} href="/dashboard/studio/proposals?status=pending_approval" />
              <Stat testId="stat-issued" label="Issued this month" value={s.issued_this_month.count} icon={Send} sub={<Money value={s.issued_this_month.value} />} />
              <Stat testId="stat-viewed" label="Viewed, not accepted" value={s.viewed_not_accepted} icon={Eye} href="/dashboard/studio/proposals?status=viewed" />
              <Stat testId="stat-accepted" label="Accepted" value={<Money value={s.accepted.value} />} icon={CheckCircle2} sub={`${s.accepted.count} proposal${s.accepted.count === 1 ? '' : 's'}`} href="/dashboard/studio/proposals?status=accepted" />
              <Stat
                testId="stat-win-rate"
                label="Win rate (90 days)"
                value={s.win_rate_90_days == null ? '—' : pct.format(Number(s.win_rate_90_days))}
                icon={Trophy}
                sub={s.median_days_issued_to_accepted != null ? `Typically accepted in ${s.median_days_issued_to_accepted} days` : 'No accepted proposals yet'}
              />
              <Stat testId="stat-expiring" label="Expiring in 7 days" value={s.expiring_in_7_days} icon={CalendarClock} />
            </>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-3 font-display text-lg font-semibold text-[#091c3c]">Needs your attention</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {canApprove && (
            <List
              testId="awaiting-my-approval"
              title="Awaiting your approval"
              items={pending.data?.items ?? []}
              loading={pending.isLoading}
              empty="Nothing is waiting for approval."
              note={() => 'Review'}
              more="/dashboard/studio/proposals?status=pending_approval"
            />
          )}
          <List
            testId="viewed-not-accepted"
            title="Viewed but not accepted"
            items={viewed.data?.items ?? []}
            loading={viewed.isLoading}
            empty="No customer is looking at a proposal right now."
            more="/dashboard/studio/proposals?status=viewed"
          />
          <List
            testId="expiring-soon"
            title="Expiring soon"
            items={expiring}
            loading={issued.isLoading || viewed.isLoading}
            empty="No proposal expires in the next 7 days."
            note={(p) => validityText(p.valid_until)}
          />
        </div>
      </div>

      <List
        testId="recent"
        title="Recent"
        items={recent.data?.items ?? []}
        loading={recent.isLoading}
        empty={canEdit ? 'No proposals yet — start one with “New proposal”.' : 'No proposals yet.'}
        note={(p) => (p.updated_at ? `${kwpTextFromTitle(p)} · ${formatTimeAgo(p.updated_at)}` : kwpTextFromTitle(p))}
        more="/dashboard/studio/proposals"
      />
    </div>
  )
}

// The list row carries no capacity field; the title starts with it ("3 kWp Residential…").
function kwpTextFromTitle(p: StudioProposalSummary): string {
  const m = /^(\d+(?:\.\d+)?)\s*kWp/i.exec(p.title)
  return m ? kwpText(m[1]) : ''
}
