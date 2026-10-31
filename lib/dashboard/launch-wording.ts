import { ApiError } from '@/lib/dashboard/api-error'

// BE-22 launch wording, as staff read it (docs/api/launch_content.md). Proposal sections carry
// Grid Nova's drafted wording under these ids; each maps to one approved_text registry entry.
export const WORDING_SECTION_NAME: Record<string, string> = {
  standard_terms: 'Terms and conditions (PRO-2)',
  utility_scale_scope: 'Ground-mounted scope (PRO-7)',
  government_scope: 'Government / institutional scope (PRO-8)',
  pm_kusum_note: 'PM-KUSUM note (PRO-10)',
  government_compliance_note: 'Government compliance note (PRO-11)',
  fallback_generic_scope: 'Generic scope (PRO-12)',
}

/** A section id in words: the wording's own name, else the id made readable. */
export const wordingSectionName = (id: string): string =>
  WORDING_SECTION_NAME[id] ?? id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'some sections'
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export interface InPersonHold {
  message: string
  /** True when the hold is lifted on the Launch readiness page (approving wording). */
  approvalPending: boolean
}

/**
 * Why an in-person hand-over was refused because of the proposal's content (409
 * unapproved_sections / manual_review_required / placeholder_content), or null for any other
 * error. The in-person route sends no missing_total_value, so the proposal's own total says
 * whether the price is what is missing.
 */
export function inPersonHold(err: unknown, totalValue: number | null | undefined): InPersonHold | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null
  const d = err.structuredDetail ?? {}
  const code = typeof d.code === 'string' ? d.code : null
  if (code === 'unapproved_sections') {
    const ids = Array.isArray(d.unapproved_sections) ? (d.unapproved_sections as unknown[]).map(String) : []
    return {
      message: `This proposal can’t be handed over yet. The wording for ${joinNames(ids.map(wordingSectionName))} is waiting for an Admin’s approval.`,
      approvalPending: true,
    }
  }
  if (code === 'manual_review_required') return { message: 'This proposal needs a staff check before it goes out.', approvalPending: false }
  if (code === 'placeholder_content') {
    return {
      message: totalValue == null ? 'Price to be set by Grid Nova.' : 'This proposal still has placeholder text, so it can’t be handed over yet.',
      approvalPending: false,
    }
  }
  return null
}
