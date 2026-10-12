import { humanize } from '@/lib/associate/execution-labels'
import { formatInr } from '@/lib/money'
import type { HomeItem } from '@/lib/associate/home-api-client'
import type { Messages } from '@/lib/i18n/types'
import { correctionHref, editStepHref, revisitStep } from '@/lib/associate/survey-review'

type FeedCopy = Messages['associates']['portal']['feed']
type StageNames = Record<string, string>

// Where each kind of to-do should take the associate.
export type TodoTarget = 'detail' | 'execution' | 'payments' | 'house'
export const TODO_TARGET: Record<string, TodoTarget> = {
  stage_rejected: 'execution',
  execution_next_step: 'execution',
  payment_due: 'payments',
  receipt_available: 'payments',
  site_location_missing: 'house',
  site_location_unconfirmed: 'house',
}

/**
 * Where a to-do card links. A revisit goes to the wizard step of its first item
 * while the customer can still be edited, or to the correction request once verified.
 */
export function todoHref(item: HomeItem, portalBase: string): string {
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
  return target === 'detail' ? base : `${base}/${target}`
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

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
