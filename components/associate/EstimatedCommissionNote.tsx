'use client'

import Link from '@/components/i18n/Link'
import { useOptionalMessages } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/types'
import { formatInr } from '@/lib/money'
import type { EstimatedCommission } from '@/lib/associate/onboarding-types'

export const COMMISSION_POLICY_HREF = '/commission-policy'

/**
 * "What will I earn?" for one customer (associate_ease.md §2) — an estimate
 * only; the ledger decides what is paid. Shows the amount only when the
 * server worked one out, the "rate will be confirmed" line while Grid Nova has
 * no confirmed rate schedule, and nothing otherwise (null, or a custom quote
 * with no basic price). No rate is ever assumed here.
 *
 * `inLink`: the customer card is itself a link, so the policy is named there
 * as plain text (a link inside a link is not valid HTML).
 */
export default function EstimatedCommissionNote({ value, inLink = false }: { value: EstimatedCommission | null | undefined; inLink?: boolean }) {
  const messages = useOptionalMessages('portalEase')
  const copy = messages?.commission
  if (!copy || !value) return null

  if (value.amount == null) {
    if (value.pending_reason !== 'placeholder_rates') return null
    return (
      <p data-testid="estimated-commission" data-state="rate-pending" className="mt-3 font-utility text-xs text-[#111827]/70">
        {copy.ratePending}
      </p>
    )
  }

  return (
    <div data-testid="estimated-commission" data-state="amount" className="mt-3 rounded-xl bg-[#fffaf0] px-3 py-2">
      <p className="font-display text-sm font-semibold text-[#0e2a63]">
        {fmt(copy.amount, { amount: formatInr(value.amount) })}
        {value.rate_source === 'individual' && messages?.rate && (
          <span data-testid="individual-rate-tag" className="ml-2 rounded-full bg-[#2f5daa]/10 px-2 py-0.5 font-utility text-[11px] font-semibold text-[#0e2a63]">{messages.rate.tag}</span>
        )}
      </p>
      <p className="mt-0.5 font-utility text-xs text-[#111827]/70">{copy.basis[value.basis]}</p>
      <p className="mt-0.5 font-utility text-xs text-[#111827]/70">
        {copy.paidNote}{' '}
        {inLink ? (
          copy.policyLink
        ) : (
          <Link href={COMMISSION_POLICY_HREF} className="font-semibold text-[#0e2a63] underline">
            {copy.policyLink}
          </Link>
        )}
      </p>
    </div>
  )
}
