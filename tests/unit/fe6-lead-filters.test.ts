import { describe, it, expect } from 'vitest'
import {
  EMPTY_FILTERS, buildExportQuery, buildLeadQuery, filterApiError, filterFieldGroup, filtersFromParams,
  filtersToParams, hasActiveFilters, leadExportQuery, leadListQuery, sendableFilters, validateFilters,
} from '@/lib/dashboard/lead-filters'
import { ApiError } from '@/lib/dashboard/api-error'
import { parseApiError } from '@/lib/api/http'
import { FILTER_ERROR_CODES, type LeadFilters } from '@/lib/dashboard/staff-leads-types'
import en from '@/messages/en.json'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'

const f = (over: Partial<LeadFilters> = {}): LeadFilters => ({ ...EMPTY_FILTERS, ...over })

describe('filter → query string (GET /leads)', () => {
  it('repeats stage, in pipeline order, and keeps the other filters', () => {
    const qs = buildLeadQuery(f({ stages: ['won', 'new'], minScore: 'low', maxScore: 'high', createdFrom: '2026-09-01', createdTo: '2026-09-03' }), { page: 2, page_size: 25 })
    expect(qs).toBe('?stage=won&stage=new&min_score=low&max_score=high&created_from=2026-09-01&created_to=2026-09-03&page=2&page_size=25')
    // two separate stage params, never a comma list
    expect(new URLSearchParams(qs).getAll('stage')).toEqual(['won', 'new'])
  })

  it('omits empty values and returns an empty string with nothing set', () => {
    expect(buildLeadQuery(EMPTY_FILTERS)).toBe('')
    expect(buildLeadQuery(f({ minScore: 'medium' }), { source: '', q: '', assigned: '' })).toBe('?min_score=medium')
  })

  it('keeps source, assigned and q', () => {
    expect(buildLeadQuery(EMPTY_FILTERS, { source: 'referral', assigned: 'me', q: 'test' })).toBe('?source=referral&assigned=me&q=test')
  })

  it('never sends an inverted range', () => {
    expect(buildLeadQuery(f({ minScore: 'high', maxScore: 'low', createdFrom: '2026-09-05', createdTo: '2026-09-01' }))).toBe('')
  })

  it('builds the list and export queries from typed list params; export drops q, assigned and paging', () => {
    const p = { stage: ['new' as const, 'lost' as const], min_score: 'low' as const, created_to: '2026-09-03', source: 'referral', q: 'x', assigned: 'me' as const, page: 3, page_size: 25 }
    expect(leadListQuery(p)).toBe('?stage=new&stage=lost&min_score=low&created_to=2026-09-03&source=referral&assigned=me&q=x&page=3&page_size=25')
    expect(leadExportQuery(p)).toBe('?stage=new&stage=lost&min_score=low&created_to=2026-09-03&source=referral')
    expect(buildExportQuery(EMPTY_FILTERS)).toBe('')
  })
})

describe('URL round trip', () => {
  it('reads what it writes', () => {
    const filters = f({ stages: ['qualified', 'negotiation'], minScore: 'medium', maxScore: 'high', createdFrom: '2026-02-28', createdTo: '2026-03-01' })
    expect(filtersFromParams(filtersToParams(filters))).toEqual(filters)
  })

  it('keeps unrelated keys (q, source, assigned) and drops page whenever a filter is written', () => {
    const base = new URLSearchParams('q=test&source=referral&assigned=me&page=4&stage=new')
    const next = filtersToParams(f({ stages: ['won'] }), base)
    expect(next.get('q')).toBe('test')
    expect(next.get('source')).toBe('referral')
    expect(next.get('assigned')).toBe('me')
    expect(next.has('page')).toBe(false)
    expect(next.getAll('stage')).toEqual(['won'])
  })

  it('clearing every filter removes every filter key', () => {
    const next = filtersToParams(EMPTY_FILTERS, new URLSearchParams('stage=new&stage=won&min_score=low&max_score=high&created_from=2026-09-01&created_to=2026-09-02&page=2'))
    expect(next.toString()).toBe('')
  })

  it('accepts a comma list and ignores unknown or malformed values instead of forwarding them', () => {
    const got = filtersFromParams(new URLSearchParams('stage=new,bogus&stage=won&min_score=huge&max_score=low&created_from=2026-02-31&created_to=yesterday'))
    expect(got).toEqual(f({ stages: ['new', 'won'], maxScore: 'low' }))
  })

  it('hasActiveFilters reflects any one filter', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters(f({ createdTo: '2026-09-03' }))).toBe(true)
    expect(hasActiveFilters(f({ stages: ['new'] }))).toBe(true)
  })
})

describe('client-side range guards', () => {
  it('allows equal bounds and any order of unset ends', () => {
    expect(validateFilters(f({ minScore: 'medium', maxScore: 'medium', createdFrom: '2026-09-01', createdTo: '2026-09-01' }))).toEqual([])
    expect(validateFilters(f({ minScore: 'high' }))).toEqual([])
    expect(validateFilters(f({ createdTo: '2026-01-01' }))).toEqual([])
  })

  it('flags min above max (low < medium < high)', () => {
    expect(validateFilters(f({ minScore: 'high', maxScore: 'medium' }))).toEqual([{ field: 'min_score', code: 'invalid_score_range' }])
    expect(validateFilters(f({ minScore: 'medium', maxScore: 'low' }))).toHaveLength(1)
  })

  it('flags from after to, comparing calendar days', () => {
    expect(validateFilters(f({ createdFrom: '2026-09-04', createdTo: '2026-09-03' }))).toEqual([{ field: 'created_from', code: 'invalid_date_range' }])
  })

  it('sendableFilters holds back only the broken pair', () => {
    expect(sendableFilters(f({ stages: ['new'], minScore: 'high', maxScore: 'low', createdFrom: '2026-09-01' }))).toEqual(
      f({ stages: ['new'], createdFrom: '2026-09-01' }),
    )
  })
})

describe('structured 422 → code', () => {
  const body = (code: string, field: string) => JSON.stringify({ detail: { code, message: 'server words', field } })

  it.each([
    ['unknown_stage', 'stage'],
    ['unknown_score', 'max_score'],
    ['invalid_score_range', 'min_score'],
    ['invalid_date', 'created_to'],
    ['invalid_date_range', 'created_from'],
  ])('recognises %s from a real parsed response', (code, field) => {
    const err = parseApiError(422, 'Unprocessable', body(code, field))
    expect(filterApiError(err)).toEqual({ code, field })
  })

  it('has a translated message for every code in en, hi and bn', () => {
    for (const messages of [en, hi, bn]) {
      for (const code of FILTER_ERROR_CODES) {
        expect(messages.staffLeads.filters.errors[code].length).toBeGreaterThan(0)
      }
    }
    expect(Object.keys(en.staffLeads.filters.errors).sort()).toEqual([...FILTER_ERROR_CODES].sort())
  })

  it('ignores other 422s (plain string, FastAPI list, unknown code) and other statuses', () => {
    expect(filterApiError(parseApiError(422, 'x', JSON.stringify({ detail: "Unknown lead source: 'x'" })))).toBeNull()
    expect(filterApiError(parseApiError(422, 'x', JSON.stringify({ detail: [{ loc: ['query', 'page'], msg: 'bad' }] })))).toBeNull()
    expect(filterApiError(parseApiError(422, 'x', body('something_else', 'stage')))).toBeNull()
    expect(filterApiError(parseApiError(500, 'x', body('unknown_stage', 'stage')))).toBeNull()
    expect(filterApiError(new Error('x'))).toBeNull()
    expect(filterApiError(new ApiError(0, 'Network request failed'))).toBeNull()
  })

  it('maps each field to the control group it is shown under', () => {
    expect(filterFieldGroup('stage')).toBe('stage')
    expect(filterFieldGroup('min_score')).toBe('score')
    expect(filterFieldGroup('max_score')).toBe('score')
    expect(filterFieldGroup('created_from')).toBe('date')
    expect(filterFieldGroup('created_to')).toBe('date')
    expect(filterFieldGroup('page')).toBeNull()
  })
})
