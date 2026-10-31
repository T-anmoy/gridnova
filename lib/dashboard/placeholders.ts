import { ApiError } from '@/lib/dashboard/api-error'
import type { ApprovalState, Blocking, PlaceholderItem, PlaceholdersResponse } from '@/lib/dashboard/placeholders-api-client'

export const BLOCKING_ORDER: Blocking[] = ['blocks_launch', 'blocks_feature', 'tunable']

export const BLOCKING_LABEL: Record<string, string> = {
  blocks_launch: 'Blocks launch',
  blocks_feature: 'Blocks a feature',
  tunable: 'Tunable',
}

export const AREA_LABEL = (area: string): string => area.charAt(0).toUpperCase() + area.slice(1).replace(/_/g, ' ')

// Only entries marked `manual` can be resolved by hand; the rest resolve themselves
// when their underlying value is edited.
export const isManual = (item: PlaceholderItem): boolean => item.probe === 'manual'

// BE-22: drafted wording that an Admin approves exactly as written (docs/api/launch_content.md).
export const isWording = (item: PlaceholderItem): boolean => item.probe === 'approved_text'

export const APPROVAL_LABEL: Record<ApprovalState, string> = {
  approved: 'Wording approved',
  not_approved: 'Wording not approved',
  lapsed: 'Changed since approval',
}
export const APPROVAL_VARIANT: Record<ApprovalState, 'green' | 'orange' | 'red'> = {
  approved: 'green',
  not_approved: 'orange',
  lapsed: 'red',
}

export const approvalStateOf = (item: PlaceholderItem): ApprovalState => item.approval_state ?? 'not_approved'

/** Wording entries whose text an Admin still has to read and approve (never approved, or lapsed). */
export function wordingAwaitingApproval(data: PlaceholdersResponse): PlaceholderItem[] {
  return data.areas.flatMap((a) => a.items).filter((i) => isWording(i) && approvalStateOf(i) !== 'approved')
}

/** The first 12 hex characters — enough for a person to compare two hashes by eye. */
export const shortHash = (sha: string | null | undefined): string => (sha ? sha.slice(0, 12) : '—')

export function approveError(err: unknown): string {
  if (err instanceof ApiError) {
    const code = err.structuredDetail?.code
    if (code === 'text_changed') return 'The text changed while you were reading it. The new version is loaded — read it again before approving.'
    if (code === 'legal_review_required') return 'Tick the legal-review box first: this text must be reviewed by Grid Nova’s legal adviser.'
    if (code === 'still_placeholder') return 'This text still contains placeholder markers, so it cannot be approved. It has to be edited first.'
    if (code === 'not_approved_text') return 'This entry is not wording, so it cannot be approved here.'
    if (code === 'rate_limited' || err.status === 429) return 'Too many approvals in a minute — wait a moment and try again.'
    if (err.status === 404) return 'That entry no longer exists.'
    if (err.status === 403) return 'Only an Admin can approve wording.'
  }
  return 'Something went wrong. Please try again.'
}

export function revokeError(err: unknown): string {
  if (err instanceof ApiError) {
    const code = err.structuredDetail?.code
    if (code === 'not_approved') return 'Nothing is approved for this entry, so there is nothing to revoke.'
    if (code === 'rate_limited' || err.status === 429) return 'Too many changes in a minute — wait a moment and try again.'
    if (err.status === 422) return 'A note is required.'
    if (err.status === 404) return 'That entry no longer exists.'
    if (err.status === 403) return 'Only an Admin can revoke an approval.'
  }
  return 'Something went wrong. Please try again.'
}

export function unresolvedItems(data: PlaceholdersResponse): PlaceholderItem[] {
  return data.areas.flatMap((a) => a.items).filter((i) => !i.resolved)
}

/** A clean plain-text list of everything still needed from Grid Nova, grouped by area. */
export function buildGridNovaMessage(data: PlaceholdersResponse): string {
  const rows = data.areas.map((a) => ({ area: a.area, items: a.items.filter((i) => !i.resolved) })).filter((a) => a.items.length > 0)
  const total = rows.reduce((n, a) => n + a.items.length, 0)
  if (total === 0) return 'Nothing is outstanding — every item on the Grid Nova data checklist is resolved.'
  const lines = [`Grid Nova — information we still need from you (${total} item${total === 1 ? '' : 's'})`, '']
  for (const { area, items } of rows) {
    lines.push(AREA_LABEL(area).toUpperCase())
    items.forEach((item, n) => {
      lines.push(`${n + 1}. [${item.id}${item.blocking === 'blocks_launch' ? ' · needed before launch' : ''}] ${item.needed_from_grid_nova}`)
    })
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}
