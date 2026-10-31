import { humanize } from '@/lib/associate/execution-labels'
import { ApiError } from '@/lib/dashboard/api-error'

// Words for the handover and service-request screens. The associate portal translates the same
// keys through messages/*.json; the staff dashboard and the customer page are English.

export const SERVICE_CATEGORIES = ['no_generation', 'inverter_error', 'physical_damage', 'cleaning_om', 'other'] as const
export const SERVICE_STATUSES = ['open', 'in_progress', 'resolved', 'rejected'] as const

export const CATEGORY_LABEL: Record<string, string> = {
  no_generation: 'No generation',
  inverter_error: 'Inverter error',
  physical_damage: 'Physical damage',
  cleaning_om: 'Cleaning / O&M',
  other: 'Something else',
}
export const STATUS_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', rejected: 'Rejected' }
export const STATUS_VARIANT: Record<string, 'amber' | 'blue' | 'green' | 'gray'> = { open: 'amber', in_progress: 'blue', resolved: 'green', rejected: 'gray' }
export const RAISED_VIA_LABEL: Record<string, string> = { staff: 'Staff', associate: 'Associate', customer: 'Customer link' }
export const HISTORY_LABEL: Record<string, string> = { raised: 'Raised', status: 'Status changed', assigned: 'Assignment changed', note: 'Internal note' }

export const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? humanize(c)

/** Pack item keys from the contract. Anything new falls back to the API’s own label. */
export const PACK_ITEM_LABEL: Record<string, string> = {
  commissioning_report: 'Commissioning report',
  net_meter_report: 'Net-meter report',
  register_verified: 'Serial register verified',
  final_payment: 'Final payment received',
  orientation: 'Customer orientation',
  acknowledgement: 'Customer acknowledgement',
  om_contact: 'O&M contact given',
}

export const PDF_STATUS_LABEL: Record<string, string> = {
  not_generated: 'Not generated yet',
  ready: 'Ready',
  held: 'Held',
  failed: 'Failed',
}
export const LINK_STATE_LABEL: Record<string, string> = {
  none: 'No link yet',
  active: 'Active',
  revoked: 'Revoked',
  expired: 'Expired',
}
export const EMAIL_STATUS_LABEL: Record<string, string> = {
  sent: 'Emailed to the customer',
  skipped: 'Not emailed',
  failed: 'Email failed',
  held: 'Email held',
}

export const SKIPPED_REASON_LABEL: Record<string, string> = {
  no_email: 'the customer has no email address',
  held: 'the pack is held',
  disabled: 'emailing is switched off',
}

export const UNIT_SOURCE_LABEL: Record<string, string> = {
  register: 'From the serial register',
  default: 'Default for this category',
  none: 'No warranty date',
}

const MESSAGES: Record<string, string | ((d: Record<string, unknown>) => string)> = {
  handover_pack_incomplete: (d) => {
    const labels = Array.isArray(d.missing_labels) ? d.missing_labels.map(String) : Array.isArray(d.missing) ? d.missing.map((k) => PACK_ITEM_LABEL[String(k)] ?? humanize(String(k))) : []
    return `Handover cannot be recorded yet. The pack is missing: ${labels.join('; ') || 'some items'}.`
  },
  handover_recorded: 'Handover is already recorded, so the pack is frozen.',
  execution_not_started: 'Installation has not started for this customer yet.',
  invalid_method: 'Choose how the customer acknowledged.',
  name_required: 'Enter the customer’s name.',
  invalid_file: 'That file could not be used. Use a PNG image of the signature.',
  file_too_large: 'That file is too large.',
  handover_not_recorded: 'Handover has not been recorded yet.',
  handover_pdf_held: 'The pack PDF is held while some printed text is still a placeholder or not yet approved by an Admin.',
  no_link: 'There is no customer link yet.',
  not_handed_over: 'This project has not been handed over yet.',
  invalid_category: 'Choose what the problem is.',
  invalid_description: 'Describe the problem (up to 2000 characters).',
  too_many_photos: 'Too many photos. Remove some and try again.',
  invalid_status: 'That status is not valid.',
  note_required: 'A note is required to resolve or reject a request.',
  invalid_note: 'Write a note.',
  note_too_long: 'The note is too long (up to 2000 characters).',
  invalid_assignee: 'That person cannot be assigned requests.',
  invalid_transition: 'The request cannot move to that status from where it is.',
  request_closed: 'This request is closed.',
  storage_not_configured: 'File storage is not set up yet, so photos cannot be saved.',
  heic_not_supported: 'That photo format is not supported. Use JPEG, PNG or WEBP.',
  not_found: 'That could not be found.',
}

/** One plain sentence for a failed handover / service-request call. */
export function handoverErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const d = err.structuredDetail
    const code = typeof d?.code === 'string' ? d.code : undefined
    if (code && MESSAGES[code]) {
      const m = MESSAGES[code]
      return typeof m === 'function' ? m(d ?? {}) : m
    }
    if (err.status === 413) return MESSAGES.file_too_large as string
    if (err.status === 403) return 'Your role cannot do this.'
    if (err.status === 0) return 'Can’t reach the server. Check the connection and try again.'
    if (err.status === 429) return 'Too many requests — wait a moment and try again.'
    if (err.status === 503) return MESSAGES.storage_not_configured as string
    if (err.detail && !err.detail.startsWith('{')) return err.detail
  }
  return 'Something went wrong. Please try again.'
}

/** The `missing` list of a 422 handover_pack_incomplete, or null for any other error. */
export function missingFromGate(err: unknown): { keys: string[]; labels: string[] } | null {
  if (!(err instanceof ApiError) || err.structuredDetail?.code !== 'handover_pack_incomplete') return null
  const d = err.structuredDetail
  const keys = Array.isArray(d.missing) ? d.missing.map(String) : []
  const labels = Array.isArray(d.missing_labels) ? d.missing_labels.map(String) : keys.map((k) => PACK_ITEM_LABEL[k] ?? humanize(k))
  return { keys, labels }
}

/** Page link a customer opens, taken from the one-time API link `…/public/handover/{token}/pdf`. */
export function customerPageUrl(apiLink: string, origin: string): string | null {
  const m = /\/api\/v1\/public\/handover\/([^/?#]+)\/pdf/.exec(apiLink)
  return m ? `${origin.replace(/\/$/, '')}/handover/${m[1]}` : null
}
