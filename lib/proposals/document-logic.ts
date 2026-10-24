// Pure rules for the proposal document editor (BE-13). Nothing here computes
// money: prices, GST, payments and subsidy are the backend's `figures`. The
// client checks only what makes typing faster (lengths, the token/marker rule,
// the 100 % payment total); the server stays the authority.
import { ApiError } from '@/lib/dashboard/api-error'
import {
  DOCUMENT_SECTIONS,
  type BoqRow,
  type DocumentEditResponse,
  type DocumentSection,
  type DocumentView,
  type MissingField,
  type PaymentTerm,
  type ProposalDocument,
  type TechnicalDocument,
} from './document-types'

// ── Sections ─────────────────────────────────────────────────────────────────

/** Section titles, in the order the PDF prints them. */
export const SECTION_TITLES: Record<DocumentSection, string> = {
  addressee: 'Customer & addressee',
  connection: 'Electricity connection',
  site: 'Project site',
  pm_surya_ghar: 'PM Surya Ghar status',
  plant: 'Plant configuration',
  system: 'System configuration',
  boq: 'Bill of quantity',
  customer_scope: 'Customer scope',
  payment_terms: 'Price & payment terms',
  notes: 'Notes',
}

export function isDocumentSection(s: string): s is DocumentSection {
  return (DOCUMENT_SECTIONS as readonly string[]).includes(s)
}

/** Editable only when the server lists the section for this user and status — never a role table here. */
export function canEditSection(view: Pick<DocumentView, 'editable_sections' | 'locked'> | null | undefined, section: DocumentSection): boolean {
  if (!view || view.locked) return false
  return (view.editable_sections ?? []).includes(section)
}

export function sectionValue(doc: ProposalDocument | TechnicalDocument, section: DocumentSection): unknown {
  return (doc as unknown as Record<string, unknown>)[section]
}

/** Stable equality for section drafts (plain JSON data only). */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

// ── Field anchors (missing-required links, error placement) ─────────────────

/** `connection.discom` → `doc-field-connection-discom`; `boq[2].make` → `doc-field-boq-2-make`. */
export function fieldAnchorId(field: string): string {
  return `doc-field-${field.replace(/\[(\d+)\]/g, '-$1').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/-+$/, '')}`
}

export function sectionAnchorId(section: string): string {
  return `doc-section-${section}`
}

// Required fields that are not a typed field of their own: where they are fixed.
const FIELD_HOME: Record<string, DocumentSection> = {
  price: 'payment_terms',
  segment_text: 'connection',
  'plant.mount_type': 'plant',
}

/** The section a backend field path belongs to (`boq[1].make` → `boq`), or null. */
export function sectionOfField(field: string): DocumentSection | null {
  if (FIELD_HOME[field]) return FIELD_HOME[field]
  const head = field.split(/[.[]/)[0]
  return isDocumentSection(head) ? head : null
}

// ── Text rules ───────────────────────────────────────────────────────────────

/** The only `{tokens}` staff text may use; the PDF fills them from the plant. */
export const ALLOWED_TOKENS = [
  'capacity_kwp',
  'module_technology',
  'dcr_label',
  'phase_cap',
  'discom',
  'space_required_sqft',
  'validity_days',
] as const

const FORBIDDEN_MARKERS = ['[PLACEHOLDER', '[UNCONFIRMED', 'DUMMY']

// Same pattern as the server's token finder.
const TOKEN_RE = /\{([a-z_0-9]+)\}/g

export function tokensIn(text: string): string[] {
  return [...text.matchAll(TOKEN_RE)].map((m) => m[1])
}

/** A plain sentence when typed text breaks the marker / token rule, else null. */
export function textProblem(text: string | null | undefined): string | null {
  if (!text) return null
  // Case-sensitive, like the server's check.
  const marker = FORBIDDEN_MARKERS.find((m) => text.includes(m))
  if (marker) return `Remove “${marker.replace('[', '')}” — placeholder markers cannot go on a customer proposal.`
  const unknown = tokensIn(text).filter((t) => !(ALLOWED_TOKENS as readonly string[]).includes(t))
  if (unknown.length) return `Unknown token ${unknown.map((t) => `{${t}}`).join(', ')}. Only ${ALLOWED_TOKENS.map((t) => `{${t}}`).join(', ')} are filled in automatically.`
  return null
}

// ── Light validation per section ────────────────────────────────────────────

export type FieldErrors = Record<string, string>

const DECIMAL_RE = /^\d+(\.\d+)?$/

function checkText(errors: FieldErrors, field: string, value: string | null | undefined, max: number, required = false) {
  const v = value ?? ''
  if (required && !v.trim()) errors[field] = 'Required.'
  else if (v.length > max) errors[field] = `At most ${max} characters.`
  else {
    const p = textProblem(v)
    if (p) errors[field] = p
  }
}

function checkLines(errors: FieldErrors, field: string, lines: string[] | undefined, maxLines: number, maxLen: number) {
  const list = lines ?? []
  if (list.length > maxLines) errors[field] = `At most ${maxLines} lines.`
  list.forEach((line, i) => checkText(errors, `${field}[${i}]`, line, maxLen))
}

function checkDecimal(errors: FieldErrors, field: string, value: string | null | undefined, opts: { positive?: boolean; maxDp?: number } = {}) {
  if (value == null || value === '') return
  const v = value.trim()
  if (!DECIMAL_RE.test(v)) {
    errors[field] = 'Enter a number, for example 3 or 3.5.'
    return
  }
  if (opts.positive && Number(v) <= 0) errors[field] = 'Must be more than 0.'
  else if (opts.maxDp != null && (v.split('.')[1]?.length ?? 0) > opts.maxDp) errors[field] = `At most ${opts.maxDp} decimal places.`
}

/** Scaled-integer sum of percent strings (no float drift); null when one is not a number. */
export function paymentTotal(terms: PaymentTerm[]): { total: string; isHundred: boolean } | null {
  const SCALE = 1000
  let sum = 0
  for (const t of terms) {
    const v = (t.percent ?? '').trim()
    if (!/^\d+(\.\d{1,3})?$/.test(v)) return null
    const [whole, frac = ''] = v.split('.')
    sum += Number(whole) * SCALE + Number(frac.padEnd(3, '0'))
  }
  const whole = Math.floor(sum / SCALE)
  const frac = String(sum % SCALE).padStart(3, '0').replace(/0+$/, '')
  return { total: frac ? `${whole}.${frac}` : String(whole), isHundred: sum === 100 * SCALE }
}

export function validateSection(section: DocumentSection, value: unknown): FieldErrors {
  const e: FieldErrors = {}
  const v = (value ?? {}) as Record<string, unknown>
  switch (section) {
    case 'addressee': {
      checkText(e, 'addressee.name', v.name as string, 120)
      checkText(e, 'addressee.attention', v.attention as string, 120)
      checkLines(e, 'addressee.address_lines', v.address_lines as string[], 5, 120)
      const mobile = (v.mobile as string | null) ?? ''
      if (mobile && !/^\d{10}$/.test(mobile)) e['addressee.mobile'] = 'Enter the 10-digit mobile number.'
      const aadhaar = (v.aadhaar_last4 as string | null) ?? ''
      if (aadhaar && !/^\d{4}$/.test(aadhaar)) e['addressee.aadhaar_last4'] = 'Enter only the last 4 digits, or leave it empty.'
      checkText(e, 'addressee.salutation', v.salutation as string, 120)
      break
    }
    case 'connection':
      checkText(e, 'connection.discom', v.discom as string, 60)
      checkText(e, 'connection.consumer_number', v.consumer_number as string, 40)
      checkText(e, 'connection.sub_division', v.sub_division as string, 80)
      checkDecimal(e, 'connection.sanctioned_load_kw', v.sanctioned_load_kw as string)
      break
    case 'site':
      checkLines(e, 'site.address_lines', v.address_lines as string[], 5, 120)
      checkText(e, 'site.town', v.town as string, 80)
      checkText(e, 'site.state', v.state as string, 60)
      break
    case 'pm_surya_ghar':
      checkDecimal(e, 'pm_surya_ghar.approved_capacity_kwp', v.approved_capacity_kwp as string, { positive: true, maxDp: 3 })
      break
    case 'plant':
      checkDecimal(e, 'plant.capacity_kwp', v.capacity_kwp as string, { positive: true, maxDp: 3 })
      break
    case 'system':
      checkText(e, 'system.inverter', v.inverter as string, 160)
      checkText(e, 'system.mounting', v.mounting as string, 160)
      break
    case 'boq': {
      const rows = (value ?? []) as BoqRow[]
      if (rows.length === 0) e.boq = 'The bill of quantity needs at least one row.'
      if (rows.length > 30) e.boq = 'At most 30 rows.'
      rows.forEach((r, i) => {
        checkText(e, `boq[${i}].description`, r.description, 160, true)
        checkText(e, `boq[${i}].quantity`, r.quantity, 60, true)
        checkText(e, `boq[${i}].make`, r.make, 160, true)
        checkText(e, `boq[${i}].standard`, r.standard, 60)
      })
      break
    }
    case 'customer_scope': {
      const items = (value ?? []) as string[]
      if (items.length === 0) e.customer_scope = 'The customer scope needs at least one item.'
      if (items.length > 20) e.customer_scope = 'At most 20 items.'
      items.forEach((t, i) => checkText(e, `customer_scope[${i}]`, t, 400, true))
      break
    }
    case 'notes': {
      const items = (value ?? []) as string[]
      if (items.length > 10) e.notes = 'At most 10 notes.'
      items.forEach((t, i) => checkText(e, `notes[${i}]`, t, 400, true))
      break
    }
    case 'payment_terms': {
      const terms = (value ?? []) as PaymentTerm[]
      if (terms.length === 0) e.payment_terms = 'Add at least one payment milestone.'
      if (terms.length > 6) e.payment_terms = 'At most 6 milestones.'
      terms.forEach((t, i) => {
        if (!/^\d+(\.\d{1,3})?$/.test((t.percent ?? '').trim())) e[`payment_terms[${i}].percent`] = 'Enter a percentage.'
        checkText(e, `payment_terms[${i}].label`, t.label, 120, true)
        checkText(e, `payment_terms[${i}].short_label`, t.short_label, 80)
      })
      const total = paymentTotal(terms)
      if (terms.length && total && !total.isHundred) e.payment_terms = `The milestones add up to ${total.total} %. They must add up to exactly 100 %.`
      break
    }
  }
  return e
}

/** Empty optional strings travel as null (the server reads "" as a value). */
export function cleanSectionValue(section: DocumentSection, value: unknown): Record<string, unknown> | unknown[] {
  if (Array.isArray(value)) {
    if (section === 'boq') return (value as BoqRow[]).map((r) => ({ ...r, standard: r.standard?.trim() ? r.standard : null }))
    if (section === 'payment_terms') return (value as PaymentTerm[]).map((t) => ({ ...t, percent: t.percent.trim(), short_label: t.short_label?.trim() ? t.short_label : null }))
    return value
  }
  const obj = { ...(value as Record<string, unknown>) }
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.trim() === '' && k !== 'salutation') obj[k] = null
    if (Array.isArray(v)) obj[k] = (v as unknown[]).filter((line) => !(typeof line === 'string' && line.trim() === ''))
  }
  return obj
}

// ── Errors from the document routes → a sentence on the right field ─────────

export interface DocumentErrorInfo {
  code: string | null
  message: string
  /** Backend field path (`boq[2].make`, `payment_terms`, a section name). */
  field?: string
  missing?: MissingField[]
  currentRevision?: number
  retryAfterSeconds?: number
}

const PLAIN: Record<string, string> = {
  field_not_editable: 'Your role cannot change this part of the proposal.',
  proposal_locked: 'This proposal is approved or sent, so it can no longer be changed. Request a revision to make changes.',
  stale_version: 'Someone else changed this proposal — reload to see their changes.',
  no_document: 'This proposal was created before the new template and cannot be edited here.',
  payment_terms_total: 'The payment milestones must add up to exactly 100 %.',
  make_not_in_catalogue: 'This make is not in the equipment catalogue. Pick a catalogue make, or write “Equivalent”.',
  missing_required: 'Some required details are still missing.',
  render_failed: 'The PDF could not be produced from this proposal. Check the details and try again; if it keeps failing, tell the Admin.',
  rate_limited: 'Too many previews in a minute — try again in a few seconds.',
}

export function documentError(err: unknown): DocumentErrorInfo {
  if (!(err instanceof ApiError)) {
    return { code: null, message: err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.' }
  }
  const d = err.structuredDetail
  const code = d && typeof d.code === 'string' ? d.code : null
  const field = d && typeof d.field === 'string' ? d.field : undefined
  const serverMessage = (d && typeof d.message === 'string' ? d.message : err.detail) || ''
  const base: DocumentErrorInfo = { code, message: serverMessage || 'Something went wrong. Please try again.', field }
  if (err.status === 0) return { ...base, message: 'Can’t reach the server. Check your connection and try again.' }
  switch (code) {
    case 'invalid_value':
      // The server's message names the sub-field — it is already a plain sentence.
      return { ...base, message: serverMessage || 'One of these values is not accepted.' }
    case 'missing_required':
      return { ...base, message: PLAIN.missing_required, missing: Array.isArray(d?.missing) ? (d.missing as MissingField[]) : [] }
    case 'stale_version':
      return { ...base, message: PLAIN.stale_version, currentRevision: typeof d?.current_revision === 'number' ? (d.current_revision as number) : undefined }
    case 'rate_limited':
      return { ...base, message: PLAIN.rate_limited, retryAfterSeconds: err.retryAfterSeconds }
    case null:
      break
    default:
      if (PLAIN[code]) return { ...base, message: PLAIN[code] }
  }
  if (err.status === 403) return { ...base, message: serverMessage || 'You don’t have access to this proposal.' }
  if (err.status === 404) return { ...base, message: 'This proposal was not found.' }
  if (err.status === 429) return { ...base, code: 'rate_limited', message: PLAIN.rate_limited, retryAfterSeconds: err.retryAfterSeconds }
  return base
}

// ── Outcome of a save, in plain words ────────────────────────────────────────

export const REGENERATED_WHY =
  'They were rebuilt from the standard template because the plant changed (capacity, package, phase or PM Surya Ghar); sections you edited are never overwritten.'

export function describeSaveOutcome(
  before: { totalValue: number | null | undefined; requiresSignoff: boolean | null | undefined; layout: string | null | undefined },
  res: DocumentEditResponse,
  formatTotal: (v: number | null | undefined) => string,
): string[] {
  const lines: string[] = []
  if (res.regenerated_sections.length) {
    const names = res.regenerated_sections.map((s) => (isDocumentSection(s) ? SECTION_TITLES[s] : s.replace(/_/g, ' ')))
    lines.push(`Regenerated: ${names.join(', ')}. ${REGENERATED_WHY}`)
  }
  if (res.layout && before.layout && res.layout !== before.layout) {
    lines.push(`The layout is now ${layoutLabel(res.layout)} — the capacity moved it.`)
  }
  if (res.total_value != null && before.totalValue != null && res.total_value !== before.totalValue) {
    lines.push(`The price changed from ${formatTotal(before.totalValue)} to ${formatTotal(res.total_value)}.`)
  }
  if (res.requires_manager_signoff != null && before.requiresSignoff != null && res.requires_manager_signoff !== before.requiresSignoff) {
    lines.push(res.requires_manager_signoff ? 'This proposal now needs manager sign-off before it can go out.' : 'Manager sign-off is no longer needed; a standard approval is enough.')
  }
  return lines
}

export function layoutLabel(layout: string | null | undefined): string {
  if (layout === 'compact') return 'Compact'
  if (layout === 'detailed') return 'Detailed'
  return layout ?? '—'
}

export const PRICE_MODE_LABEL: Record<string, string> = {
  price_list: 'From the price list',
  staff_basic: 'Basic price set by staff',
  staff_total: 'Total set by staff',
  none: 'No price yet',
}

export const REFERENCE_PENDING = 'Allocated on approval'

/** `before → after` text for the session change log. */
export function changeText(v: unknown): string {
  if (v == null || v === '') return '—'
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

export const EDITABLE_STATUSES = ['draft', 'pending_pricing_validation', 'pending_approval'] as const
