// Pure logic for the server-side lead filters (staff_contracts.md §3): URL <->
// filter state, the request query string, the client-side guards that keep the
// structured 422s from being sent, and the mapping of those 422s to message keys.
import type { PipelineStage } from '@/lib/dashboard/types'
import { ApiError } from '@/lib/dashboard/api-error'
import {
  FILTER_ERROR_CODES, LEAD_STAGES, SCORE_ORDER,
  type FilterErrorCode, type LeadFilters, type ScoreLabel,
} from '@/lib/dashboard/staff-leads-types'

export const EMPTY_FILTERS: LeadFilters = { stages: [], minScore: '', maxScore: '', createdFrom: '', createdTo: '', referredBy: '' }

const MAX_ASSOCIATE_ID = 64

/** The referred-by Associate ID as typed, trimmed and bounded. Its format is the server's to judge (422 invalid_associate_id). */
export function cleanAssociateId(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  return t.length <= MAX_ASSOCIATE_ID ? t : ''
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isStage(v: string | null | undefined): v is PipelineStage {
  return !!v && (LEAD_STAGES as readonly string[]).includes(v)
}
export function isScoreLabel(v: string | null | undefined): v is ScoreLabel {
  return !!v && (SCORE_ORDER as readonly string[]).includes(v)
}

/** A real calendar day in YYYY-MM-DD form (2026-02-31 is not one). */
export function isIsoDay(v: string): boolean {
  if (!DATE_RE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** Read the filters out of a URL's query. Unknown values are dropped, never forwarded. */
export function filtersFromParams(sp: URLSearchParams): LeadFilters {
  const stages = sp.getAll('stage').flatMap((s) => s.split(',')).map((s) => s.trim()).filter(isStage)
  const min = sp.get('min_score')
  const max = sp.get('max_score')
  const from = sp.get('created_from') ?? ''
  const to = sp.get('created_to') ?? ''
  return {
    stages: LEAD_STAGES.filter((s) => stages.includes(s)),
    minScore: isScoreLabel(min) ? min : '',
    maxScore: isScoreLabel(max) ? max : '',
    createdFrom: isIsoDay(from) ? from : '',
    createdTo: isIsoDay(to) ? to : '',
    referredBy: cleanAssociateId(sp.get('referred_by_associate_id')),
  }
}

/**
 * Write the filters onto a copy of `base` (keeping unrelated keys such as q,
 * source, assigned), always dropping `page` — changing a filter returns to page 1.
 * Empty values are omitted; stages are repeated (`stage=new&stage=won`).
 */
export function filtersToParams(filters: LeadFilters, base?: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(base?.toString() ?? '')
  for (const k of ['stage', 'min_score', 'max_score', 'created_from', 'created_to', 'referred_by_associate_id', 'page']) next.delete(k)
  for (const s of filters.stages) next.append('stage', s)
  if (filters.minScore) next.set('min_score', filters.minScore)
  if (filters.maxScore) next.set('max_score', filters.maxScore)
  if (filters.createdFrom) next.set('created_from', filters.createdFrom)
  if (filters.createdTo) next.set('created_to', filters.createdTo)
  if (filters.referredBy) next.set('referred_by_associate_id', filters.referredBy)
  return next
}

export function hasActiveFilters(f: LeadFilters): boolean {
  return f.stages.length > 0 || !!f.minScore || !!f.maxScore || !!f.createdFrom || !!f.createdTo || !!f.referredBy
}

export function activeFilterCount(f: LeadFilters): number {
  return (f.stages.length > 0 ? 1 : 0) + (f.minScore ? 1 : 0) + (f.maxScore ? 1 : 0) + (f.createdFrom ? 1 : 0) + (f.createdTo ? 1 : 0) + (f.referredBy ? 1 : 0)
}

// ── Client-side guards ────────────────────────────────────────────────────────

export type FilterGuardError = { field: 'min_score' | 'created_from'; code: 'invalid_score_range' | 'invalid_date_range' }

/** Problems that would make the server answer 422; when any exist the filter is not sent. */
export function validateFilters(f: LeadFilters): FilterGuardError[] {
  const errors: FilterGuardError[] = []
  if (f.minScore && f.maxScore && SCORE_ORDER.indexOf(f.minScore) > SCORE_ORDER.indexOf(f.maxScore)) {
    errors.push({ field: 'min_score', code: 'invalid_score_range' })
  }
  if (f.createdFrom && f.createdTo && f.createdFrom > f.createdTo) {
    errors.push({ field: 'created_from', code: 'invalid_date_range' })
  }
  return errors
}

/** The filters that may be sent: an inverted range is held back until the user fixes it. */
export function sendableFilters(f: LeadFilters): LeadFilters {
  const errors = validateFilters(f)
  const out = { ...f }
  if (errors.some((e) => e.code === 'invalid_score_range')) { out.minScore = ''; out.maxScore = '' }
  if (errors.some((e) => e.code === 'invalid_date_range')) { out.createdFrom = ''; out.createdTo = '' }
  return out
}

// ── Request query string ──────────────────────────────────────────────────────

export interface LeadQueryExtras {
  source?: string
  assigned?: string
  q?: string
  page?: number
  page_size?: number
}

/** Ordered [key, value] pairs for GET /leads — `stage` repeats, empty values are omitted. */
export function leadQueryPairs(filters: LeadFilters, extras: LeadQueryExtras = {}): Array<[string, string]> {
  const f = sendableFilters(filters)
  const pairs: Array<[string, string]> = []
  for (const s of f.stages) pairs.push(['stage', s])
  if (f.minScore) pairs.push(['min_score', f.minScore])
  if (f.maxScore) pairs.push(['max_score', f.maxScore])
  if (f.createdFrom) pairs.push(['created_from', f.createdFrom])
  if (f.createdTo) pairs.push(['created_to', f.createdTo])
  if (f.referredBy) pairs.push(['referred_by_associate_id', f.referredBy])
  for (const key of ['source', 'assigned', 'q'] as const) {
    const v = extras[key]
    if (v) pairs.push([key, v])
  }
  if (extras.page != null) pairs.push(['page', String(extras.page)])
  if (extras.page_size != null) pairs.push(['page_size', String(extras.page_size)])
  return pairs
}

export function buildLeadQuery(filters: LeadFilters, extras: LeadQueryExtras = {}): string {
  const qs = new URLSearchParams(leadQueryPairs(filters, extras)).toString()
  return qs ? `?${qs}` : ''
}

/** The export takes the same filters and `source`, but no q / assigned / paging. */
export function buildExportQuery(filters: LeadFilters, source?: string): string {
  return buildLeadQuery(filters, { source })
}

// ── Structured 422 ───────────────────────────────────────────────────────────

export interface FilterApiError {
  code: FilterErrorCode
  field: string
}

/** The structured `{code, message, field}` 422 of §3, or null for any other error. */
export function filterApiError(err: unknown): FilterApiError | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null
  const d = err.structuredDetail
  const code = d?.code
  if (typeof code !== 'string' || !(FILTER_ERROR_CODES as readonly string[]).includes(code)) return null
  return { code: code as FilterErrorCode, field: typeof d?.field === 'string' ? d.field : '' }
}

/** Which form control a field-level message belongs under. */
export function filterFieldGroup(field: string): 'stage' | 'score' | 'date' | 'referredBy' | null {
  if (field === 'stage') return 'stage'
  if (field === 'referred_by_associate_id') return 'referredBy'
  if (field === 'min_score' || field === 'max_score') return 'score'
  if (field === 'created_from' || field === 'created_to') return 'date'
  return null
}

// ── From the typed list params ────────────────────────────────────────────────

import type { LeadListParams } from '@/lib/dashboard/types'

/** The §3 filters held in a LeadListParams. */
export function filtersFromListParams(p: LeadListParams): LeadFilters {
  return {
    stages: p.stage ?? [],
    minScore: p.min_score ?? '',
    maxScore: p.max_score ?? '',
    createdFrom: p.created_from ?? '',
    createdTo: p.created_to ?? '',
    referredBy: p.referred_by_associate_id ?? '',
  }
}

/** Query string for GET /leads from list params (repeats `stage`, omits empties, never sends an inverted range). */
export function leadListQuery(p: LeadListParams): string {
  return buildLeadQuery(filtersFromListParams(p), {
    source: p.source, assigned: p.assigned, q: p.q, page: p.page, page_size: p.page_size,
  })
}

/** Query string for GET /leads/export: the same filters and source, no q / assigned / paging. */
export function leadExportQuery(p: LeadListParams): string {
  return buildExportQuery(filtersFromListParams(p), p.source)
}
