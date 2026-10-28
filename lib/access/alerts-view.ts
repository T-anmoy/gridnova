import type { AccessMatrix, AlertRoute } from './types'
import { roleLabel, sortRoles } from './roles'

// Plain words for GET /access/alerts (access_control.md §6).

const EVENT_LABELS: Record<string, string> = {
  new_lead: 'New lead',
  lead_qualified: 'Lead qualified',
  meeting_booked: 'Meeting booked',
  stale_lead_digest: 'Stale leads digest',
  manager_signoff_required: 'Manager sign-off needed',
  customer_accepted: 'Customer accepted a proposal',
  formal_proposal_requested: 'Formal proposal requested',
  survey_review_overdue: 'Survey review overdue',
  onboarding_overdue: 'Onboarding overdue',
  stage_submitted: 'Execution stage submitted',
  execution_stuck: 'Project stuck in execution',
  dcr_mismatch: 'DCR mismatch',
  catalogue_unmatched: 'Equipment model not matched',
  handover_blocked: 'Handover blocked',
  service_request_raised: 'Service request raised',
  service_requests_overdue: 'Service requests overdue',
  payment_recorded: 'Payment recorded',
  payment_dishonoured: 'Payment dishonoured',
  receipt_blocked: 'Receipt held',
  payments_attention: 'Payments need attention',
  commission_queries_overdue: 'Commission queries overdue',
  associate_application_submitted: 'Associate application submitted',
  approval_requested: 'Second approval requested',
  studio_viewed: 'Studio proposal opened by the customer',
  studio_accepted: 'Studio proposal accepted',
  studio_declined: 'Studio proposal declined',
  studio_expiring: 'Studio proposal expiring soon',
  studio_not_viewed: 'Studio proposal not opened yet',
  studio_approval_requested: 'Studio proposal needs approval',
}

export function alertEventLabel(event: string): string {
  if (EVENT_LABELS[event]) return EVENT_LABELS[event]
  const words = event.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** "2 Accounts, 1 Admin · 1 shared mailbox · the assigned person" — counts only, never addresses. */
export function recipientsLine(e: AlertRoute, matrix?: AccessMatrix | null): string {
  const parts: string[] = []
  const holders = sortRoles(Object.keys(e.active_holders))
    .map((r) => [r, e.active_holders[r as keyof typeof e.active_holders] ?? 0] as const)
    .filter(([, n]) => n > 0)
    .map(([r, n]) => `${n} ${roleLabel(r, matrix)}`)
  if (holders.length) parts.push(holders.join(', '))
  if (e.fixed_addresses > 0) parts.push(`${e.fixed_addresses} shared ${e.fixed_addresses === 1 ? 'mailbox' : 'mailboxes'}`)
  if (e.assigned_employee) parts.push('the assigned person')
  if (e.owner) parts.push('the proposal’s owner')
  return parts.join(' · ') || 'Nobody yet'
}
