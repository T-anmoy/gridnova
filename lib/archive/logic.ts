// Pure helpers for the Project Archive screens (docs/api/project_archive.md): filters <-> URL,
// the query the API takes, which fields go in which group, and the import error sentences.
import { ApiError } from '@/lib/dashboard/api-error'
import { formatInr } from '@/lib/money'
import { formatDate } from '@/lib/dashboard/utils'
import type { Provenanced } from '@/lib/archive/schemas'

export const ARCHIVE_PAGE_SIZE = 25
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024

// ── Schemes ──────────────────────────────────────────────────────────────────

export const SCHEMES = [
  'pm_surya_ghar_residential',
  'housing_society',
  'commercial',
  'industrial',
  'institutional_govt',
  'wbreda_school',
  'pm_kusum_pump',
  'street_lighting',
  'ground_mounted',
  'other',
] as const

const SCHEME_LABEL: Record<string, string> = {
  pm_surya_ghar_residential: 'PM Surya Ghar (residential)',
  housing_society: 'Housing society',
  commercial: 'Commercial',
  industrial: 'Industrial',
  institutional_govt: 'Institutional / government',
  wbreda_school: 'WBREDA school',
  pm_kusum_pump: 'PM-KUSUM pump',
  street_lighting: 'Street lighting',
  ground_mounted: 'Ground-mounted',
  other: 'Other',
}

export function humanize(key: string): string {
  const s = key.replace(/_/g, ' ').trim()
  return s ? s[0].toUpperCase() + s.slice(1) : key
}

export function schemeLabel(scheme: string): string {
  return SCHEME_LABEL[scheme] ?? humanize(scheme)
}

// ── Filters ↔ URL ────────────────────────────────────────────────────────────

export interface ArchiveFilters {
  q: string
  state: string
  district: string
  scheme: string
  capacityMin: string
  capacityMax: string
  commissionedFrom: string
  commissionedTo: string
  moduleMake: string
  inverterMake: string
}

export const EMPTY_ARCHIVE_FILTERS: ArchiveFilters = {
  q: '', state: '', district: '', scheme: '', capacityMin: '', capacityMax: '', commissionedFrom: '', commissionedTo: '', moduleMake: '', inverterMake: '',
}

// URL key (= the API's query name) for each filter.
const KEYS: Record<keyof ArchiveFilters, string> = {
  q: 'q', state: 'state', district: 'district', scheme: 'scheme', capacityMin: 'capacity_min', capacityMax: 'capacity_max',
  commissionedFrom: 'commissioned_from', commissionedTo: 'commissioned_to', moduleMake: 'module_make', inverterMake: 'inverter_make',
}

const NUMBER_RE = /^\d+(\.\d+)?$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDay(v: string): boolean {
  if (!DATE_RE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** Reads the filters out of the URL. Anything unusable (an unknown scheme, a bad date) is dropped, never forwarded. */
export function archiveFiltersFromParams(sp: URLSearchParams): ArchiveFilters {
  const get = (k: keyof ArchiveFilters) => (sp.get(KEYS[k]) ?? '').trim()
  const scheme = get('scheme')
  return {
    q: get('q'),
    state: get('state'),
    district: get('district'),
    scheme: (SCHEMES as readonly string[]).includes(scheme) ? scheme : '',
    capacityMin: NUMBER_RE.test(get('capacityMin')) ? get('capacityMin') : '',
    capacityMax: NUMBER_RE.test(get('capacityMax')) ? get('capacityMax') : '',
    commissionedFrom: isIsoDay(get('commissionedFrom')) ? get('commissionedFrom') : '',
    commissionedTo: isIsoDay(get('commissionedTo')) ? get('commissionedTo') : '',
    moduleMake: get('moduleMake'),
    inverterMake: get('inverterMake'),
  }
}

/** Writes the filters onto a copy of `base`, always dropping `page` (a new filter starts at page 1). */
export function archiveFiltersToParams(filters: ArchiveFilters, base?: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(base?.toString() ?? '')
  for (const k of Object.values(KEYS)) next.delete(k)
  next.delete('page')
  for (const [field, key] of Object.entries(KEYS) as [keyof ArchiveFilters, string][]) {
    if (filters[field]) next.set(key, filters[field])
  }
  return next
}

export function activeArchiveFilterCount(f: ArchiveFilters): number {
  return Object.values(f).filter(Boolean).length
}

export type ArchiveFilterError = { field: 'capacity_min' | 'commissioned_from' | 'capacity_max' | 'commissioned_to'; code: 'invalid_number' | 'invalid_date' | 'invalid_range' }

/** Problems that would make the server answer 422 — checked on the raw text before the filters are applied. */
export function validateArchiveDraft(f: ArchiveFilters): ArchiveFilterError[] {
  const errors: ArchiveFilterError[] = []
  if (f.capacityMin && !NUMBER_RE.test(f.capacityMin)) errors.push({ field: 'capacity_min', code: 'invalid_number' })
  if (f.capacityMax && !NUMBER_RE.test(f.capacityMax)) errors.push({ field: 'capacity_max', code: 'invalid_number' })
  if (f.commissionedFrom && !isIsoDay(f.commissionedFrom)) errors.push({ field: 'commissioned_from', code: 'invalid_date' })
  if (f.commissionedTo && !isIsoDay(f.commissionedTo)) errors.push({ field: 'commissioned_to', code: 'invalid_date' })
  if (NUMBER_RE.test(f.capacityMin) && NUMBER_RE.test(f.capacityMax) && Number(f.capacityMin) > Number(f.capacityMax)) {
    errors.push({ field: 'capacity_min', code: 'invalid_range' })
  }
  if (isIsoDay(f.commissionedFrom) && isIsoDay(f.commissionedTo) && f.commissionedFrom > f.commissionedTo) {
    errors.push({ field: 'commissioned_from', code: 'invalid_range' })
  }
  return errors
}

const FILTER_ERROR_TEXT: Record<ArchiveFilterError['code'], string> = {
  invalid_number: 'Enter a number such as 5 or 12.5.',
  invalid_date: 'Use a real date (YYYY-MM-DD).',
  invalid_range: 'The “from” value must not be after the “to” value.',
}
export function archiveFilterErrorText(code: string): string {
  return (FILTER_ERROR_TEXT as Record<string, string>)[code] ?? (code === 'unknown_scheme' ? 'That scheme is not one the archive knows.' : 'Check the filters.')
}

/** The structured 422 the list/stats routes send for a bad filter (`{code, field}`), if that is what this is. */
export function archiveFilterApiError(err: unknown): { code: string; field?: string } | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null
  const code = err.structuredDetail?.code
  if (typeof code !== 'string') return null
  const field = err.structuredDetail?.field
  return { code, ...(typeof field === 'string' ? { field } : {}) }
}

/** The API query for the filters (page and page_size are added by the caller). */
export function archiveFiltersToQuery(f: ArchiveFilters): Record<string, string> {
  const q: Record<string, string> = {}
  for (const [field, key] of Object.entries(KEYS) as [keyof ArchiveFilters, string][]) {
    if (f[field]) q[key] = f[field]
  }
  return q
}

// ── Showing fields ───────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.+\-Z]+)?$/

/** Display text for a field value. Money stays a decimal string; dates are IST calendar days. */
export function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') {
    if (key === 'scheme_or_segment') return schemeLabel(value)
    if (key.endsWith('_inr')) return formatInr(value)
    if (key === 'capacity_kw' || key === 'inverter_capacity_kw') return `${value} kW`
    if (key === 'pump_hp') return `${value} HP`
    if (key === 'module_wattage_wp') return `${value} Wp`
    if (ISO_DATE.test(value)) return formatDate(value)
    return key === 'system_type' || key === 'module_dcr' || key === 'current_stage' ? humanize(value) : value
  }
  if (typeof value === 'number') return key === 'capacity_kw' ? `${value} kW` : String(value)
  return JSON.stringify(value)
}

export type FieldGroupId = 'project' | 'location' | 'equipment' | 'dates' | 'warranty' | 'documents' | 'quality' | 'service' | 'other'

export const FIELD_GROUPS: { id: FieldGroupId; title: string; keys: string[]; sections: string[] }[] = [
  {
    id: 'project',
    title: 'Project',
    keys: [
      'scheme_or_segment', 'system_type', 'capacity_kw', 'pump_hp', 'street_lamp_count', 'current_stage', 'customer_name', 'discom',
      'consumer_number', 'customer_phone', 'customer_email', 'contract_value_inr', 'subsidy_amount_inr', 'amount_received_inr',
      'amount_outstanding_inr', 'associate_id', 'associate_name', 'om_status', 'notes', 'open_service_requests', 'import_batch_id', 'source_row',
    ],
    sections: [],
  },
  { id: 'location', title: 'Location', keys: ['state', 'district', 'block', 'address_text', 'pincode', 'latitude', 'longitude'], sections: [] },
  {
    id: 'equipment',
    title: 'Equipment',
    keys: [
      'module_make', 'module_model', 'module_wattage_wp', 'module_count', 'module_dcr', 'inverter_make', 'inverter_model',
      'inverter_capacity_kw', 'inverter_count', 'structure_type', 'battery_details', 'other_equipment',
    ],
    sections: ['equipment'],
  },
  { id: 'dates', title: 'Dates', keys: ['order_date', 'installation_date', 'commissioning_date', 'net_meter_date'], sections: ['stages'] },
  { id: 'warranty', title: 'Warranty', keys: ['warranty_end_modules', 'warranty_end_inverter'], sections: ['warranty'] },
  { id: 'documents', title: 'Documents', keys: ['documents'], sections: ['documents'] },
  { id: 'quality', title: 'Data quality flags', keys: ['data_quality_flags'], sections: [] },
  { id: 'service', title: 'Service requests', keys: [], sections: ['service_requests'] },
]

export const FIELD_LABEL: Record<string, string> = {
  scheme_or_segment: 'Scheme / segment', system_type: 'System type', capacity_kw: 'Capacity', pump_hp: 'Pump rating', street_lamp_count: 'Street lamps',
  current_stage: 'Current stage', customer_name: 'Customer', discom: 'DISCOM', consumer_number: 'Consumer number', customer_phone: 'Phone',
  customer_email: 'Email', contract_value_inr: 'Contract value', subsidy_amount_inr: 'Subsidy', amount_received_inr: 'Received',
  amount_outstanding_inr: 'Outstanding', associate_id: 'Associate ID', associate_name: 'Associate', om_status: 'O&M status', notes: 'Notes',
  open_service_requests: 'Open service requests', import_batch_id: 'Import batch', source_row: 'Source row', address_text: 'Address', pincode: 'PIN code',
  module_wattage_wp: 'Module wattage', module_dcr: 'Module DCR', inverter_capacity_kw: 'Inverter capacity', warranty_end_modules: 'Module warranty ends',
  warranty_end_inverter: 'Inverter warranty ends', commissioning_date: 'Commissioned', order_date: 'Ordered', installation_date: 'Installed', net_meter_date: 'Net meter',
}

export function fieldLabel(key: string): string {
  return FIELD_LABEL[key] ?? humanize(key)
}

/** Groups the fields and sections the response actually has — nothing absent is shown, nothing present is dropped. */
export function groupDossier(fields: Record<string, Provenanced>, sections: Record<string, Provenanced[]>) {
  const used = new Set<string>()
  const usedSections = new Set<string>()
  const groups = FIELD_GROUPS.map((g) => {
    const present = g.keys.filter((k) => k in fields)
    present.forEach((k) => used.add(k))
    const secs = g.sections.filter((s) => (sections[s]?.length ?? 0) > 0)
    g.sections.forEach((s) => usedSections.add(s))
    return { id: g.id, title: g.title, keys: present, sections: secs }
  })
  // Keys the contract does not name still show, in their own group, so a new backend field is never hidden.
  const otherKeys = Object.keys(fields).filter((k) => !used.has(k))
  const otherSections = Object.keys(sections).filter((s) => !usedSections.has(s) && (sections[s]?.length ?? 0) > 0)
  if (otherKeys.length || otherSections.length) groups.push({ id: 'other', title: 'Other', keys: otherKeys, sections: otherSections })
  return groups.filter((g) => g.keys.length > 0 || g.sections.length > 0)
}

/** A map link only from stored coordinates. Nothing is geocoded or guessed. */
export function mapsUrl(lat: unknown, lng: unknown): string | null {
  // An empty string is "no coordinate", not 0 — Number('') would put the pin at 0,0.
  const num = (v: unknown) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '') ? Number(v) : NaN)
  const la = num(lat)
  const ln = num(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return null
  return `https://www.google.com/maps?q=${la},${ln}`
}

/** http(s) only: a stored `javascript:` or `data:` link is shown as text, never as a link. */
export function safeHttpUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

export interface DocLink {
  label: string
  url: string | null
  raw: string
}

/** Reads `{label, url}` document entries (the import's documents shape). Anything else is shown as text. */
export function readDocuments(values: unknown[]): DocLink[] {
  return values.flatMap((v): DocLink[] => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>
      const url = safeHttpUrl(o.url)
      const label = typeof o.label === 'string' && o.label ? o.label : typeof o.url === 'string' ? o.url : 'Document'
      return [{ label, url, raw: typeof o.url === 'string' ? o.url : '' }]
    }
    if (typeof v === 'string' && v) return [{ label: v, url: safeHttpUrl(v), raw: v }]
    return []
  })
}

// ── Import ───────────────────────────────────────────────────────────────────

const IMPORT_ERRORS: Record<string, string> = {
  file_too_large: 'That file is over 10 MB. Split it and import the parts one at a time.',
  too_many_rows: 'That file has more than 20,000 rows. Split it and import the parts one at a time.',
  invalid_encoding: 'The file is not UTF-8. In Excel choose “CSV UTF-8” when saving.',
  batch_token_required: 'Run the dry run first, then confirm the import.',
  batch_token_mismatch: 'The file is not the one that was checked. Run the dry run again, then confirm.',
  already_imported: 'This exact file has already been imported. Void that batch first if you need to import it again.',
  nothing_to_import: 'No row in the file can be imported. Fix the errors and run the dry run again.',
  import_conflict: 'Another import took a reference at the same moment. Run the dry run again.',
  already_voided: 'That batch has already been voided.',
  missing_column: 'The file is missing a required column. Download the template and compare the headings.',
  duplicate_column: 'The file has the same column twice. Remove the duplicate and try again.',
}

export function describeImportError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return 'Can’t reach the server. Check your connection and try again.'
    const code = err.structuredDetail?.code
    if (typeof code === 'string' && IMPORT_ERRORS[code]) return IMPORT_ERRORS[code]
    if (err.status === 403) return 'Only an Admin can import or void archive batches.'
    if (err.detail) return err.detail
  }
  return 'Something went wrong. Try again.'
}

/** Client-side check before upload, so an obviously wrong file never leaves the browser. */
export function checkImportFile(file: { name: string; size: number }): string | null {
  if (file.size === 0) return 'That file is empty.'
  if (file.size > IMPORT_MAX_BYTES) return 'That file is over 10 MB. Split it and import the parts one at a time.'
  if (!/\.csv$/i.test(file.name)) return 'Choose a .csv file (use the template).'
  return null
}
