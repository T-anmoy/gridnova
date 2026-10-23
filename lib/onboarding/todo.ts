import { humanize } from '@/lib/associate/execution-labels'
import { formatInr } from '@/lib/money'
import { formatRate } from '@/lib/commissions/rates'
import { formatDate } from '@/lib/dashboard/utils'
import type { HomeItem } from '@/lib/associate/home-api-client'
import { fmt, type Messages } from '@/lib/i18n/types'
import { correctionHref, editStepHref, revisitStep } from '@/lib/associate/survey-review'

type FeedCopy = Messages['associates']['portal']['feed']
type StageNames = Record<string, string>

// Where each kind of to-do should take the associate.
export type TodoTarget = 'detail' | 'execution' | 'payments' | 'house' | 'handover'
export const TODO_TARGET: Record<string, TodoTarget> = {
  stage_rejected: 'execution',
  execution_next_step: 'execution',
  payment_due: 'payments',
  receipt_available: 'payments',
  site_location_missing: 'house',
  site_location_unconfirmed: 'house',
  handover_pending: 'handover',
  service_request_open: 'handover',
  service_request_closed: 'handover',
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** A stable React key: two items of one kind on one customer differ by their own id. */
export function todoKey(item: HomeItem): string {
  const p = item.params ?? {}
  const own = num(p.request_id) ?? num(p.batch_id) ?? num(p.query_id) ?? ''
  return `${item.kind}-${item.onboarding_id ?? 'none'}-${item.message_key}-${own}`
}

/** What heads a to-do card: the customer, or a plain label for items that are not about one customer. */
export function todoTitle(item: HomeItem, copy: FeedCopy): string {
  if (item.customer_name) return item.customer_name
  const titles = copy.titles as Record<string, string>
  return titles[item.kind] ?? titles.generic
}

/**
 * Where a to-do card links. A revisit goes to the wizard step of its first item
 * while the customer can still be edited, or to the correction request once verified.
 */
export function todoHref(item: HomeItem, portalBase: string): string {
  // Commission payouts and answered queries land on the Earnings page, not on a customer.
  if (item.kind === 'commission_payout_paid') return `${portalBase}/earnings?tab=payouts`
  if (item.kind === 'commission_rate_changed') return `${portalBase}/earnings`
  if (item.kind === 'commission_query_answered') {
    const entry = num((item.params ?? {}).entry_id)
    return entry != null ? `${portalBase}/earnings?entry=${entry}` : `${portalBase}/earnings`
  }
  if (item.onboarding_id == null) return portalBase
  const base = `${portalBase}/customers/${item.onboarding_id}`
  if (item.kind === 'survey_revisit_needed') {
    const p = item.params ?? {}
    if (p.via === 'correction') return correctionHref(portalBase, item.onboarding_id)
    const first = Array.isArray(p.revisit_items) ? (p.revisit_items[0] as { section?: unknown } | undefined) : undefined
    return editStepHref(portalBase, item.onboarding_id, typeof first?.section === 'string' ? revisitStep(first.section) : 'survey')
  }
  // survey_resign_needed lands on the detail page, where the signature pads are.
  const target = TODO_TARGET[item.kind] ?? 'detail'
  if (target === 'house') return `${base}/edit?step=house`
  if (target === 'handover') {
    const request = num((item.params ?? {}).request_id)
    return request != null ? `${base}/handover?request=${request}` : `${base}/handover`
  }
  return target === 'detail' ? base : `${base}/${target}`
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

/** A translated word for a category / status key; an unknown key reads as plain words, never as the raw key. */
const serviceWord = (words: Record<string, string>, key: unknown): string => words[str(key)] ?? humanize(str(key))

/**
 * Turns a home-feed item (message key + params) into the sentence shown on its
 * card, in the viewer's language. The contract keys are translated; an
 * unknown key falls back to a safe generic line — a raw key is never shown.
 * Amounts are the server's decimal strings, formatted but never calculated.
 */
export function describeTodo(item: HomeItem, copy: FeedCopy, stageNames: StageNames): string {
  const p = item.params ?? {}
  const stage = (): string => stageNames[str(p.stage)] ?? str(p.stage_label) ?? humanize(str(p.stage))
  switch (item.message_key) {
    case 'todo.documents_missing': {
      const docs = Array.isArray(p.missing_documents) ? p.missing_documents.map((d) => humanize(str(d))) : []
      return copy.todo.documents_missing.replace('{documents}', docs.join(', '))
    }
    case 'todo.ready_to_submit':
      return copy.todo.ready_to_submit
    case 'todo.stage_rejected': {
      const note = str(p.review_note)
      return copy.todo.stage_rejected.replace('{stage}', stage()).replace('{note}', note ? ` ${note}` : '')
    }
    case 'todo.payment_overdue':
    case 'todo.payment_due': {
      const template = item.message_key === 'todo.payment_overdue' ? copy.todo.payment_overdue : copy.todo.payment_due
      return template.replace('{label}', str(p.label)).replace('{amount}', formatInr(str(p.outstanding)))
    }
    case 'todo.formal_proposal_ready':
      return copy.todo.formal_proposal_ready
    case 'todo.upload_signed_agreement':
      return copy.todo.upload_signed_agreement
    case 'todo.execution_next_step':
      return copy.todo.execution_next_step.replace('{stage}', stage())
    case 'todo.site_location_missing':
      return copy.todo.site_location_missing
    case 'todo.site_location_unconfirmed':
      return copy.todo.site_location_unconfirmed
    case 'todo.survey_revisit_needed':
      return p.via === 'correction' ? copy.todo.survey_revisit_correction : copy.todo.survey_revisit_edit
    case 'todo.survey_resign_needed': {
      const unsigned = Array.isArray(p.unsigned) ? p.unsigned.map((u) => (u === 'customer' ? copy.todo.party_customer : copy.todo.party_associate)) : []
      return copy.todo.survey_resign_needed.replace('{unsigned}', unsigned.join(', '))
    }
    case 'todo.receipt_available':
      return copy.todo.receipt_available.replace('{number}', str(p.receipt_number))
    case 'todo.commission_payout_paid':
      return fmt(copy.todo.commission_payout_paid, {
        net: formatInr(str(p.net)),
        period: str(p.period),
        last4: str(p.bank_account_last4),
        reference: str(p.bank_reference),
      })
    case 'todo.commission_query_answered':
      return copy.todo.commission_query_answered
    case 'todo.commission_rate_changed': {
      // Rates are the server's decimal strings (null = no confirmed rate); the date is the day the rate starts.
      const from = p.rate_percent_from == null ? null : str(p.rate_percent_from)
      const to = p.rate_percent_to == null ? null : str(p.rate_percent_to)
      const date = formatDate(str(p.effective_from))
      if (to == null) return fmt(copy.todo.commission_rate_cleared, { from: formatRate(from), date })
      if (from == null) return fmt(copy.todo.commission_rate_starts, { to: formatRate(to), date })
      return fmt(copy.todo.commission_rate_changed, { from: formatRate(from), to: formatRate(to), date })
    }
    case 'todo.handover_pending':
      return copy.todo.handover_pending
    case 'todo.service_request_open': {
      const warranty = p.within_warranty === true ? copy.service.warrantyIn : p.within_warranty === false ? copy.service.warrantyOut : ''
      return fmt(copy.todo.service_request_open, { category: serviceWord(copy.service.categories, p.category), status: serviceWord(copy.service.status, p.status), warranty })
    }
    case 'todo.service_request_closed':
      return fmt(copy.todo.service_request_closed, { category: serviceWord(copy.service.categories, p.category), outcome: serviceWord(copy.service.status, p.outcome) })
    default:
      return copy.todo.generic
  }
}

/** Plain message for a `progress_summary.blocked.reason`. */
export function describeBlocked(reason: string, copy: FeedCopy): string {
  switch (reason) {
    case 'formal_proposal_blocked':
      return copy.blocked.formal_proposal_blocked
    case 'payment_gate':
      return copy.blocked.payment_gate
    case 'dcr_mismatch':
      return copy.blocked.dcr_mismatch
    default:
      return copy.blocked.generic
  }
}
