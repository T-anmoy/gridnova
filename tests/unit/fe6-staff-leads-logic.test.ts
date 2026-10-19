import { describe, it, expect } from 'vitest'
import { ApiError } from '@/lib/dashboard/api-error'
import { parseApiError } from '@/lib/api/http'
import {
  SERVER, askOutcome, buildScheduleMeetingBody, canExportLeads, canScheduleMeeting, canSeeLeads, canUseMemory,
  MEMORY_KINDS, clampMemoryLimit, formatMeetingTimeIst, isEngineerLeadDetail, isLeadNotAssigned, istLocalToIso,
  mapExportError, mapMemoryError, mapReflectError, mapScheduleMeetingError, reflectOutcome, safeMeetLink, validQuestion,
} from '@/lib/dashboard/staff-leads-logic'
import { visibleNavItems } from '@/lib/dashboard/nav'
import type { MemoryAskResponse, ReflectResponse } from '@/lib/dashboard/staff-leads-types'
import type { Role } from '@/lib/dashboard/types'

const ROLES: Role[] = ['admin', 'management', 'sales', 'engineer', 'operations', 'accounts']
const err = (status: number, detail: string) => parseApiError(status, 'x', JSON.stringify({ detail }))
const who = (pred: (r: Role | undefined) => boolean) => ROLES.filter(pred)

describe('role gating', () => {
  it('leads: Operations and Accounts see none', () => {
    expect(who(canSeeLeads)).toEqual(['admin', 'management', 'sales', 'engineer'])
    expect(canSeeLeads(undefined)).toBe(false)
  })
  it('leads navigation is hidden for Operations and Accounts only', () => {
    const has = (r: Role) => visibleNavItems(r).some((i) => i.href === '/dashboard/leads')
    expect(ROLES.filter(has)).toEqual(['admin', 'management', 'sales', 'engineer'])
  })
  it('export: Admin and Management only', () => {
    expect(who(canExportLeads)).toEqual(['admin', 'management'])
  })
  it('schedule meeting: Admin and Sales only', () => {
    expect(who(canScheduleMeeting)).toEqual(['admin', 'sales'])
  })
  it('memory, ask and reflect: Admin, Management and Sales', () => {
    expect(who(canUseMemory)).toEqual(['admin', 'management', 'sales'])
    expect(canUseMemory(undefined)).toBe(false)
  })
})

describe('Engineer lead shape', () => {
  const engineer = { lead_id: 1, pipeline_stage: 'new' as const, collected_fields: { capacity_kw: 5 } }
  it('is detected by the absence of `customer`', () => {
    expect(isEngineerLeadDetail(engineer)).toBe(true)
  })
  it('a full shape with a null customer is not the Engineer shape', () => {
    expect(isEngineerLeadDetail({ lead_id: 1, customer: null, pipeline_stage: 'new', lead_score: null, collected_fields: {}, proposals: [], timeline: [], messages: [] })).toBe(false)
  })
})

describe('schedule-meeting payload', () => {
  it('converts an India wall-clock time to an ISO string with the +05:30 offset (never naive)', () => {
    expect(istLocalToIso('2026-10-20T10:30')).toBe('2026-10-20T10:30:00+05:30')
    expect(istLocalToIso('2026-10-20T10:30:15')).toBe('2026-10-20T10:30:15+05:30')
    const iso = istLocalToIso('2026-10-20T10:30')!
    expect(iso).toMatch(/[+-]\d{2}:\d{2}$/)
    // 10:30 IST is 05:00 UTC, matching the contract's example
    expect(new Date(iso).toISOString()).toBe('2026-10-20T05:00:00.000Z')
  })
  it('handles a day boundary: 00:15 IST is the previous UTC day', () => {
    expect(new Date(istLocalToIso('2026-10-20T00:15')!).toISOString()).toBe('2026-10-19T18:45:00.000Z')
  })
  it('rejects empty, malformed and impossible values', () => {
    for (const bad of ['', '2026-10-20', '2026-02-31T10:00', '2026-10-20T25:00', 'tomorrow']) expect(istLocalToIso(bad), bad).toBeNull()
  })
  it('builds the body; duration is optional and left out when blank', () => {
    expect(buildScheduleMeetingBody('2026-10-20T10:30', '')).toEqual({ ok: true, body: { scheduled_at: '2026-10-20T10:30:00+05:30' } })
    expect(buildScheduleMeetingBody('2026-10-20T10:30', ' 45 ')).toEqual({ ok: true, body: { scheduled_at: '2026-10-20T10:30:00+05:30', duration_minutes: 45 } })
  })
  it('accepts the duration bounds 5 and 480 exactly', () => {
    expect(buildScheduleMeetingBody('2026-10-20T10:30', '5')).toMatchObject({ ok: true, body: { duration_minutes: 5 } })
    expect(buildScheduleMeetingBody('2026-10-20T10:30', '480')).toMatchObject({ ok: true, body: { duration_minutes: 480 } })
  })
  it('refuses a bad time or a duration that is not a whole number from 5 to 480 before anything is sent', () => {
    expect(buildScheduleMeetingBody('', '')).toEqual({ ok: false, error: 'invalidTime' })
    for (const d of ['0', '4', '-5', '5.5', '481', '1000', 'abc']) expect(buildScheduleMeetingBody('2026-10-20T10:30', d), d).toEqual({ ok: false, error: 'invalidDuration' })
  })
  it('displays an instant in IST whatever the browser zone is', () => {
    expect(formatMeetingTimeIst('2026-10-20T05:00:00+00:00')).toMatch(/20 Oct 2026/)
    expect(formatMeetingTimeIst('2026-10-20T05:00:00+00:00')).toMatch(/10:30/)
    expect(formatMeetingTimeIst('2026-10-20T20:00:00+00:00')).toMatch(/21 Oct 2026/)
  })
  it('only an https meet link is used', () => {
    expect(safeMeetLink('https://meet.example.test/abc')).toBe('https://meet.example.test/abc')
    expect(safeMeetLink(null)).toBeNull()
    expect(safeMeetLink('javascript:alert(1)')).toBeNull()
    expect(safeMeetLink('http://meet.example.test/abc')).toBeNull()
    expect(safeMeetLink('not a url')).toBeNull()
  })
})

describe('schedule-meeting errors (exact plain strings)', () => {
  it.each([
    [403, SERVER.scheduleRole, 'role'],
    [403, SERVER.leadNotAssigned, 'notAssigned'],
    [404, SERVER.leadNotFound, 'notFound'],
    [409, SERVER.noCalendar, 'noCalendar'],
  ])('%i %s → %s', (status, detail, key) => {
    expect(mapScheduleMeetingError(err(status, detail))).toEqual({ key })
  })
  it('passes the booking-layer 409 and the 503 text through', () => {
    expect(mapScheduleMeetingError(err(409, 'That slot is not free.'))).toEqual({ key: 'conflict', serverText: 'That slot is not free.' })
    expect(mapScheduleMeetingError(err(409, 'No calendar connected for this employee.'))).toEqual({ key: 'conflict', serverText: 'No calendar connected for this employee.' })
    expect(mapScheduleMeetingError(err(503, 'Google Calendar is not configured.'))).toEqual({ key: 'notConfigured', serverText: 'Google Calendar is not configured.' })
  })
  it('network and unknown errors fall back', () => {
    expect(mapScheduleMeetingError(new ApiError(0, 'Network request failed')).key).toBe('network')
    expect(mapScheduleMeetingError(err(403, 'Something else')).key).toBe('generic')
    expect(mapScheduleMeetingError(err(500, 'boom')).key).toBe('generic')
    expect(mapScheduleMeetingError(new Error('x')).key).toBe('generic')
  })
  it('detects the lead "not assigned to you" 403 only', () => {
    expect(isLeadNotAssigned(err(403, SERVER.leadNotAssigned))).toBe(true)
    expect(isLeadNotAssigned(err(403, SERVER.customerOfAnotherRep))).toBe(false)
    expect(isLeadNotAssigned(err(404, SERVER.leadNotAssigned))).toBe(false)
  })
})

describe('memory, ask, reflect and export errors', () => {
  it.each([
    [403, SERVER.memoryRole, 'role'],
    [403, SERVER.customerOfAnotherRep, 'anotherRep'],
    [404, SERVER.customerNotFound, 'notFound'],
    [422, "Unknown memory kind: 'x'", 'unknownKind'],
  ])('memory %i %s → %s', (status, detail, key) => {
    expect(mapMemoryError(err(status, detail))).toEqual({ key })
  })
  it('503 from ask keeps the agent text; unknown falls back', () => {
    expect(mapMemoryError(err(503, 'The recall agent failed.'))).toEqual({ key: 'agent', serverText: 'The recall agent failed.' })
    expect(mapMemoryError(err(500, 'x')).key).toBe('generic')
    expect(mapMemoryError(new ApiError(0, 'n')).key).toBe('network')
  })
  it.each([
    [403, SERVER.reflectRole, 'role'],
    [403, SERVER.customerOfAnotherRep, 'anotherRep'],
    [404, SERVER.leadNotFound, 'notFound'],
  ])('reflect %i %s → %s', (status, detail, key) => {
    expect(mapReflectError(err(status, detail))).toEqual({ key })
  })
  it('export: 403 handled, 422 and others have their own message', () => {
    expect(mapExportError(err(403, SERVER.exportRole)).key).toBe('forbidden')
    expect(mapExportError(err(422, 'x')).key).toBe('filterRejected')
    expect(mapExportError(new ApiError(0, 'n')).key).toBe('network')
    expect(mapExportError(err(500, 'x')).key).toBe('failed')
  })
})

describe('memory limit and question length', () => {
  it('offers the seven memory kinds', () => {
    expect([...MEMORY_KINDS]).toEqual(['episode', 'preference', 'objection', 'commitment', 'outcome', 'insight', 'self_critique'])
  })
  it('clamps the limit to 1–500', () => {
    expect(clampMemoryLimit('0')).toBe(1)
    expect(clampMemoryLimit('-4')).toBe(1)
    expect(clampMemoryLimit('9999')).toBe(500)
    expect(clampMemoryLimit('25.9')).toBe(25)
    expect(clampMemoryLimit('')).toBeNull()
    expect(clampMemoryLimit('abc')).toBeNull()
  })
  it('a question is 1–500 characters after trimming', () => {
    expect(validQuestion('')).toBe(false)
    expect(validQuestion('   ')).toBe(false)
    expect(validQuestion('a')).toBe(true)
    expect(validQuestion('a'.repeat(500))).toBe(true)
    expect(validQuestion('a'.repeat(501))).toBe(false)
  })
})

describe('ask-memory states', () => {
  const base: MemoryAskResponse = { answer: 'x', resolved: true, customer_id: 7, candidates: [], citations: [], retrieval_mode: null }
  it('answered / ambiguous / unresolved', () => {
    expect(askOutcome(base)).toBe('answered')
    expect(askOutcome({ ...base, resolved: false, customer_id: null, candidates: [{ customer_id: 1, name: 'Test A', email: 'a@example.test', company: null }] })).toBe('ambiguous')
    expect(askOutcome({ ...base, resolved: false, customer_id: null })).toBe('unresolved')
  })
})

describe('reflect `skipped`', () => {
  const base: ReflectResponse = { trigger: 'manual', lead_id: 1, memories_written: 3, skipped: null }
  it('null skipped means it ran', () => {
    expect(reflectOutcome(base)).toEqual({ kind: 'written', count: 3 })
    expect(reflectOutcome({ ...base, memories_written: 0 })).toEqual({ kind: 'written', count: 0 })
  })
  it.each([
    ['no new messages since last reflection', 'noNewMessages'],
    ['reflection returned nothing', 'nothingReturned'],
    ['lead not found', 'leadNotFound'],
    ['error: model timed out', 'error'],
    ['ERROR: upper case', 'error'],
    ['some future reason', 'other'],
  ])('%s → %s, and nothing counts as written even if the count is non-zero', (skipped, reason) => {
    const out = reflectOutcome({ ...base, skipped })
    expect(out.kind).toBe('skipped')
    if (out.kind === 'skipped') expect(out.reason).toBe(reason)
  })
})
