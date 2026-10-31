// Plain helpers for the Proposal Studio screens: labels, the wizard's steps, error wording,
// sorting and CSV. Nothing here calculates money — amounts are decimal strings from the API,
// compared and formatted as text only.

import { ApiError } from '@/lib/dashboard/api-error'
import { STUDIO_STATUSES, type StudioCheck, type StudioEvent, type StudioStatus, type StudioView } from './types'

// ── Statuses ────────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<StudioStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Awaiting approval',
  ready: 'Ready to issue',
  issued: 'Issued',
  viewed: 'Viewed by customer',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  superseded: 'Replaced by a newer version',
  converted: 'Lead created',
  lost: 'Lost',
}

export type ChipTone = 'gray' | 'amber' | 'blue' | 'navy' | 'green' | 'red' | 'orange'

export const STATUS_TONE: Record<StudioStatus, ChipTone> = {
  draft: 'gray',
  pending_approval: 'amber',
  ready: 'blue',
  issued: 'navy',
  viewed: 'blue',
  accepted: 'green',
  declined: 'red',
  expired: 'orange',
  superseded: 'gray',
  converted: 'green',
  lost: 'red',
}

/** Every status, in workflow order, for the list filter. */
export const STUDIO_STATUSES_FOR_FILTER = STUDIO_STATUSES

export function statusLabel(status: string | null | undefined): string {
  return (status && (STATUS_LABEL as Record<string, string>)[status]) || (status ?? '—').replace(/_/g, ' ')
}

export function statusTone(status: string | null | undefined): ChipTone {
  return (status && (STATUS_TONE as Record<string, ChipTone>)[status]) || 'gray'
}

/** A version that can still change (the server's EDITABLE set). */
export function isEditableStatus(status: string | null | undefined): boolean {
  return status === 'draft' || status === 'pending_approval' || status === 'ready'
}

// ── Project types ───────────────────────────────────────────────────────────

/** One line under each project-type card. The label itself comes from GET /studio/options. */
export const PROJECT_TYPE_HINT: Record<string, string> = {
  residential_rooftop: 'A home’s rooftop. PM Surya Ghar subsidy where the customer has opted in.',
  housing_society: 'A housing society or RWA — shared subsidy worked out from the number of houses.',
  commercial_rooftop: 'Shops, offices, hospitals, schools — a business rooftop.',
  industrial_rooftop: 'A factory or warehouse rooftop.',
  ground_mounted: 'A plant on open land instead of a roof.',
  government_institutional: 'A government office or public institution.',
  pm_kusum: 'Solar for farmers under the PM-KUSUM scheme.',
  street_lighting: 'Street lights and other supply priced line by line (quantity × rate).',
  generic: 'Any other solar project.',
}

// ── The wizard ──────────────────────────────────────────────────────────────

export const WIZARD_STEPS = [
  { id: 'customer', title: 'Customer', hint: 'Who the proposal is addressed to' },
  { id: 'project', title: 'Project', hint: 'Type, size and scheme' },
  { id: 'site', title: 'Site & connection', hint: 'Where it goes, the electricity connection' },
  { id: 'system', title: 'System & materials', hint: 'Panels, inverter and the bill of quantities' },
  { id: 'price', title: 'Price', hint: 'What the customer pays' },
  { id: 'terms', title: 'Terms & notes', hint: 'Payment terms, validity, notes' },
  { id: 'review', title: 'Review & issue', hint: 'Check the PDF and send it' },
] as const

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id']

export function isWizardStep(s: string | null | undefined): s is WizardStepId {
  return WIZARD_STEPS.some((x) => x.id === s)
}

/** The wizard step where a backend field path (a check's or an error's `field`) is edited. */
export function stepOfField(field: string | null | undefined): WizardStepId {
  if (!field) return 'review'
  const f = field.replace(/\[\d+\].*$/, '')
  // `customer_scope` is edited on Terms & notes — test it before the `customer` prefix.
  if (f.startsWith('customer_scope')) return 'terms'
  if (f.startsWith('addressee') || f.startsWith('customer')) return 'customer'
  if (f === 'connection.phase' || f.startsWith('plant') || f.startsWith('pm_surya_ghar') || f === 'project.houses' || f === 'project.project_type' || f === 'project') return 'project'
  if (f.startsWith('site') || f.startsWith('connection') || f === 'project.roof_area_sqft') return 'site'
  if (f.startsWith('system') || f.startsWith('boq') || f.startsWith('items')) return 'system'
  if (f.startsWith('price') || f.startsWith('display') || f.startsWith('savings')) return 'price'
  if (f.startsWith('payment_terms') || f.startsWith('validity') || f.startsWith('notes') || f.startsWith('customer_scope') || f.startsWith('cover_highlight')) return 'terms'
  return 'review'
}

/** The section a field path belongs to (`boq[2].make` → `boq`). */
export function sectionOfStudioField(field: string): string {
  return field.split(/[.[]/)[0]
}

/** Field ids are used as DOM ids: `boq[2].make` → `studio-field-boq-2-make`. */
export function studioFieldId(field: string): string {
  return `studio-field-${field.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '')}`
}

// ── Errors in plain words ───────────────────────────────────────────────────

export interface StudioErrorInfo {
  status: number
  code: string | null
  message: string
  field: string | null
  detail: Record<string, unknown>
}

const CODE_MESSAGES: Record<string, string> = {
  not_permitted: 'Your roles do not allow this. Ask an Admin if you need it.',
  two_factor_required: 'Turn on two-step sign-in first (Settings → Two-step), then try again.',
  stale_version: 'Someone else changed this proposal a moment ago. We loaded the latest version — please check your last change.',
  proposal_locked: 'This version is issued and cannot change. Use “Revise” to make a new version.',
  rate_limited: 'Too many previews in a minute. Wait a few seconds and try again.',
  storage_unavailable: 'The PDF store is not reachable right now. Try again in a minute.',
  email_not_configured: 'Email sending is not set up on the server. Use WhatsApp or copy the link instead.',
  send_failed: 'The email could not be sent. Check the address and try again.',
  no_customer_email: 'This customer has no email address. Type one in the box, or use WhatsApp.',
  maker_checker: 'You prepared this version, so someone else must approve it.',
  approval_required: 'This proposal needs approval before it can be issued. Use “Send for approval”.',
  proof_check_failed: 'The proof-check found problems. Fix the items in red, then try again.',
  warnings_unacknowledged: 'Tick “I have checked this” on each amber warning first.',
  content_not_ready: 'Grid Nova’s wording for this project type is missing or not yet approved by an Admin (Launch readiness). You can draft and preview, but not issue yet.',
  not_list_priceable: 'The price master has no price for this package, phase and size. Enter the price yourself.',
  reason_required: 'The price is below the price master. Give the reason.',
  payment_terms_total: 'The payment percentages must add up to 100%.',
  field_not_resettable: 'This section has no standard version to go back to.',
  make_not_in_catalogue: 'That make is not in the equipment catalogue. Pick one from the list, or “Equivalent”.',
  proposal_expired: 'This proposal has expired. Revise it to send a fresh one.',
  invalid_status: 'This is not possible at the proposal’s current stage. Reload the page.',
  not_issued: 'Issue the proposal first.',
  unknown_warning: 'That warning no longer applies. The list has been refreshed.',
  assistant_disabled: 'The assistant is switched off.',
  import_failed: 'Nothing was imported. Fix the cells listed below and upload the file again.',
  invalid_file: 'Upload a PDF, JPEG or PNG.',
  file_too_large: 'The file is too large — at most 10 MB.',
  missing_required: 'Some required details are still missing.',
  not_authenticated: 'Your session ended. Sign in again.',
}

/** Any thrown error → what to tell the person, the field it is about, and the raw detail. */
export function studioError(err: unknown): StudioErrorInfo {
  if (err instanceof ApiError) {
    const detail = err.structuredDetail ?? {}
    const code = typeof detail.code === 'string' ? detail.code : null
    const field = typeof detail.field === 'string' ? detail.field : null
    const serverMessage = typeof detail.message === 'string' ? detail.message : err.detail
    let message: string
    if (err.status === 0) message = 'No connection to the server. Check the internet and try again.'
    else if (code === 'invalid_value' || code === 'reason_required' || code === 'make_not_in_catalogue') message = serverMessage || CODE_MESSAGES[code] || 'Check this value.'
    else if (code && CODE_MESSAGES[code]) message = CODE_MESSAGES[code]
    else if (err.status === 404) message = 'Not found — it may have been removed.'
    else if (err.status === 403) message = serverMessage || CODE_MESSAGES.not_permitted
    else if (err.status >= 500) message = 'The server had a problem. Try again in a minute.'
    else message = serverMessage || 'Something went wrong. Try again.'
    return { status: err.status, code, message, field, detail }
  }
  return { status: 0, code: null, message: 'Something went wrong. Try again.', field: null, detail: {} }
}

// ── Proof-check ─────────────────────────────────────────────────────────────

export interface CheckGroups {
  errors: StudioCheck[]
  warnings: (StudioCheck & { acknowledged: boolean })[]
  /** Every error gone and every warning acknowledged. */
  allClear: boolean
}

export function groupChecks(view: Pick<StudioView, 'checks' | 'warnings_unacknowledged'>): CheckGroups {
  const open = new Set(view.warnings_unacknowledged)
  const errors = view.checks.filter((c) => c.level === 'error')
  const warnings = view.checks.filter((c) => c.level === 'warning').map((c) => ({ ...c, acknowledged: !open.has(c.fingerprint) }))
  return { errors, warnings, allClear: errors.length === 0 && warnings.every((w) => w.acknowledged) }
}

export const APPROVAL_REASON_LABEL: Record<string, string> = {
  price_below_price_master: 'The price is below the price master',
  total_above_threshold: 'The total is above ₹5,00,000',
}

// ── Events ──────────────────────────────────────────────────────────────────

const EVENT_LABEL: Record<string, string> = {
  created: 'Created',
  edited: 'Edited',
  priced: 'Price set',
  warnings_acknowledged: 'Warnings checked',
  spelling_ignored: 'Spelling word ignored',
  submitted_for_approval: 'Sent for approval',
  ready: 'Ready to issue',
  approved: 'Approved',
  rejected: 'Sent back by the approver',
  issued: 'Issued',
  superseded: 'Replaced by a newer version',
  emailed: 'Emailed to the customer',
  whatsapp_link_created: 'WhatsApp message prepared',
  viewed: 'Opened by the customer',
  downloaded: 'PDF downloaded',
  reminder_sent: 'Reminder sent',
  accepted: 'Accepted',
  declined: 'Declined by the customer',
  expired: 'Expired',
  revised: 'New version started',
  duplicated: 'Copied from another proposal',
  imported: 'Imported from Excel',
  converted: 'Lead created',
  lost: 'Marked lost',
  assistant_suggested: 'Assistant suggested details',
}

export function eventLabel(type: string): string {
  return EVENT_LABEL[type] ?? type.replace(/_/g, ' ')
}

/** Events worth a line on the status timeline (edits and acknowledgements are left out). */
export const TIMELINE_EVENTS = new Set([
  'created', 'submitted_for_approval', 'approved', 'rejected', 'ready', 'issued', 'emailed', 'whatsapp_link_created',
  'viewed', 'downloaded', 'reminder_sent', 'accepted', 'declined', 'expired', 'superseded', 'revised', 'duplicated',
  'imported', 'converted', 'lost',
])

export function timeline(events: StudioEvent[]): StudioEvent[] {
  return events.filter((e) => TIMELINE_EVENTS.has(e.type))
}

/** One extra line for an event: who/what, from its detail. */
export function eventNote(e: StudioEvent): string | null {
  const d = e.detail ?? {}
  if (e.type === 'emailed' && typeof d.to === 'string') return `To ${d.to}`
  if (e.type === 'rejected' && typeof d.comment === 'string' && d.comment) return `“${d.comment}”`
  if (e.type === 'approved' && typeof d.comment === 'string' && d.comment) return `“${d.comment}”`
  if (e.type === 'lost' && typeof d.reason === 'string') return d.reason
  if (e.type === 'declined' && typeof d.reason === 'string' && d.reason) return d.reason
  if (e.type === 'accepted' && typeof d.via === 'string') return d.via === 'online' ? 'Online, by the customer' : 'In person (signed copy uploaded)'
  if (e.type === 'downloaded' && d.by === 'staff') return 'By staff'
  if (e.actor_type === 'customer' || e.actor_type === 'public') return 'By the customer'
  return null
}

// ── Versions ────────────────────────────────────────────────────────────────

/** The newest issued version before `current` (for "changes since the last issued version"). */
export function lastIssuedBefore(versions: StudioView['versions'], current: number): number | null {
  const issued = versions.filter((v) => v.version < current && v.document_reference)
  return issued.length ? Math.max(...issued.map((v) => v.version)) : null
}

const FIELD_LABELS: Record<string, string> = {
  'addressee.name': 'Customer name',
  'addressee.title': 'Title',
  'addressee.attention': 'Attention',
  'addressee.mobile': 'Mobile',
  'addressee.salutation': 'Salutation',
  'addressee.aadhaar_last4': 'Aadhaar (last 4)',
  'plant.capacity_kwp': 'Capacity (kWp)',
  'plant.package': 'Package',
  'plant.dcr': 'DCR panels',
  'connection.phase': 'Phase',
  'connection.discom': 'DISCOM',
  'connection.consumer_number': 'Consumer number',
  'connection.sanctioned_load_kw': 'Sanctioned load (kW)',
  'connection.category': 'Category',
  'site.town': 'Town',
  'site.state': 'State',
  'project.project_type': 'Project type',
  'project.houses': 'Houses',
  'project.roof_area_sqft': 'Roof area (sq ft)',
  'system.module_technology': 'Panel technology',
  'system.inverter': 'Inverter',
  'system.mounting': 'Mounting',
  'price.mode': 'Price method',
  'price.basic': 'Basic price',
  'price.total': 'Total incl. GST',
  'price.rate_per_kwp': 'Rate per kWp',
  'price.discount.amount': 'Discount',
  'price.discount.reason': 'Discount reason',
  'price.reason': 'Reason for the price',
  validity_days: 'Validity (days)',
  cover_highlight: 'Cover line',
}

export function fieldLabel(path: string): string {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path]
  const m = /^(boq|items|payment_terms|customer_scope|notes|notes_free|site\.address_lines|addressee\.address_lines)\[(\d+)\](?:\.(.+))?$/.exec(path)
  if (m) {
    const names: Record<string, string> = {
      boq: 'Material row', items: 'Item', payment_terms: 'Payment milestone', customer_scope: 'Customer scope item',
      notes: 'Note', notes_free: 'Special note', 'site.address_lines': 'Site address line', 'addressee.address_lines': 'Address line',
    }
    return `${names[m[1]]} ${Number(m[2]) + 1}${m[3] ? ` — ${m[3].replace(/_/g, ' ')}` : ''}`
  }
  return path.replace(/[._]/g, ' ')
}

export function diffValue(v: unknown): string {
  if (v == null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  return JSON.stringify(v)
}

// ── Dates (validity) ────────────────────────────────────────────────────────

/** Today's date in India (YYYY-MM-DD). */
export function todayIst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Whole days from today (IST) to a YYYY-MM-DD date; negative once past. */
export function daysUntil(date: string | null | undefined, now: Date = new Date()): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null
  const [ty, tm, td] = todayIst(now).split('-').map(Number)
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000)
}

/** "Valid for 6 more days" / "Expires today" / "Expired 2 days ago". */
export function validityText(validUntil: string | null | undefined, now: Date = new Date()): string | null {
  const n = daysUntil(validUntil, now)
  if (n == null) return null
  if (n > 1) return `Valid for ${n} more days`
  if (n === 1) return 'Valid until tomorrow'
  if (n === 0) return 'Valid until today'
  return n === -1 ? 'Expired yesterday' : `Expired ${-n} days ago`
}

// ── Sorting and CSV (text only) ─────────────────────────────────────────────

/** Orders two decimal strings ("201465.00", "98000") without turning them into numbers. */
export function compareDecimalStrings(a: string | null | undefined, b: string | null | undefined): number {
  if (a == null || a === '') return b == null || b === '' ? 0 : -1
  if (b == null || b === '') return 1
  const neg = (s: string) => s.trim().startsWith('-')
  if (neg(a) !== neg(b)) return neg(a) ? -1 : 1
  const split = (s: string) => {
    const [w, f = ''] = s.trim().replace(/^-/, '').split('.')
    return [w.replace(/^0+(?=\d)/, ''), f] as const
  }
  const [aw, af] = split(a)
  const [bw, bf] = split(b)
  let r = aw.length - bw.length || (aw < bw ? -1 : aw > bw ? 1 : 0)
  if (r === 0) {
    const len = Math.max(af.length, bf.length)
    const ap = af.padEnd(len, '0')
    const bp = bf.padEnd(len, '0')
    r = ap < bp ? -1 : ap > bp ? 1 : 0
  }
  return neg(a) ? -r : r
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  // A leading = + - @ would be read as a formula by a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** Saves text as a file. */
export function saveText(text: string, filename: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Sharing ─────────────────────────────────────────────────────────────────

/** Only a wa.me link to an Indian number is opened (the API builds it; this guards the click). */
export function isWhatsappLink(url: string | null | undefined): boolean {
  return !!url && /^https:\/\/wa\.me\/91\d{10}\?text=/.test(url)
}

/** "3" → "3 kWp", "7.500" → "7.5 kWp". Reads the string; no number is built. */
export function kwpText(cap: string | null | undefined): string {
  if (!cap) return '—'
  const t = cap.includes('.') ? cap.replace(/0+$/, '').replace(/\.$/, '') : cap
  return `${t} kWp`
}

/** The owner column: BE-19's `owner_name` (a display name, never an email); "You" for oneself. */
export function ownerText(ownerId: string | null | undefined, me: string | undefined, ownerName?: string | null): string {
  if (!ownerId) return '—'
  if (ownerId === me) return 'You'
  return ownerName?.trim() || 'A colleague'
}
