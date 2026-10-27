import { describe, it, expect } from 'vitest'
import { ApiError, ApiShapeError } from '@/lib/dashboard/api-error'
import { parseApiError } from '@/lib/api/http'
import {
  canUseNova, csvFilename, csvSafe, describeAskError, describeContext, formatCell, isEmptyContext, safeDashboardPath, splitAnswer, starterQuestions, tableToCsv,
} from '@/lib/nova/logic'
import { ARCHIVE_ANSWER } from './fixtures/nova-contract'
import { permissionsValue } from './helpers/permissions-bridge'
import type { Role } from '@/lib/dashboard/types'

describe('splitAnswer — plain text with citation refs', () => {
  it('turns only bracketed refs that are in citations into ref segments', () => {
    const segs = splitAnswer(ARCHIVE_ANSWER.answer, ARCHIVE_ANSWER.citations)
    const refs = segs.filter((s) => s.kind === 'ref').map((s) => s.text)
    expect(refs).toEqual(['[GN-ARC-0102]', '[GN-ARC-0101]'])
    // [UNLISTED-1] is not a citation, so it stays text.
    expect(segs.map((s) => s.text).join('')).toBe(ARCHIVE_ANSWER.answer)
    expect(segs.some((s) => s.kind === 'text' && s.text.includes('[UNLISTED-1]'))).toBe(true)
  })

  it('never interprets markup: HTML and script stay in text segments', () => {
    const segs = splitAnswer('<img src=x onerror=alert(1)> **bold** [L1]', [{ ref: 'L1', kind: 'lead', label: 'x', path: null }])
    expect(segs[0]).toEqual({ kind: 'text', text: '<img src=x onerror=alert(1)> **bold** ' })
  })

  it('an answer with no refs is a single text segment', () => {
    expect(splitAnswer('Nothing here.', [])).toEqual([{ kind: 'text', text: 'Nothing here.' }])
  })
})

describe('safeDashboardPath', () => {
  it.each([
    ['/dashboard/archive/2', '/dashboard/archive/2'],
    ['/dashboard/operations/5', '/dashboard/operations/5'],
    ['/dashboard/leads/45', '/dashboard/leads/45'],
    ['/dashboard/service-requests/4', '/dashboard/service-requests/4'],
    [null, null],
    [undefined, null],
    ['', null],
    ['https://evil.example/dashboard/x', null],
    ['//evil.example', null],
    ['/dashboard/../admin', null],
    ['javascript:alert(1)', null],
    ['/other/page', null],
  ])('%s → %s', (input, expected) => expect(safeDashboardPath(input as string | null | undefined)).toBe(expected))
})

describe('table cells', () => {
  it('money is formatted from the decimal string, never through a float', () => {
    expect(formatCell('1234567.50', 'money')).toBe('₹12,34,567.50')
    expect(formatCell('-250.00', 'money')).toBe('-₹250.00')
    expect(formatCell('99999999999999.99', 'money')).toBe('₹9,99,99,99,99,99,999.99')
  })
  it('dates are shown in IST', () => {
    expect(formatCell('2025-07-01', 'date')).toBe('01 Jul 2025')
    // 20:00 UTC on 31 Dec is already 1 Jan in IST
    expect(formatCell('2025-12-31T20:00:00+00:00', 'date')).toBe('01 Jan 2026')
  })
  it('kw, booleans, numbers and missing values', () => {
    expect(formatCell('10.000', 'kw')).toBe('10.000 kW')
    expect(formatCell(true, 'boolean')).toBe('Yes')
    expect(formatCell(false, 'boolean')).toBe('No')
    expect(formatCell(4, 'number')).toBe('4')
    expect(formatCell(null, 'money')).toBe('—')
    expect(formatCell(undefined, 'text')).toBe('—')
  })
})

describe('CSV export is formula-safe', () => {
  it.each([
    ['=HYPERLINK("x")', "'=HYPERLINK(\"x\")"],
    ['+1+1', "'+1+1"],
    ['-cmd', "'-cmd"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\tcmd', "'\tcmd"],
    ['\rcmd', "'\rcmd"],
    ['plain', 'plain'],
    ['-250.00', '-250.00'],
    ['10.000', '10.000'],
  ])('csvSafe(%j) → %j', (input, expected) => expect(csvSafe(input)).toBe(expected))

  it('quotes commas, quotes and line breaks, and prefixes dangerous text cells', () => {
    const csv = tableToCsv(ARCHIVE_ANSWER.tables[0])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Reference,Capacity (kW),Contract value,Commissioned,DCR,Units,Customer')
    // the formula cell is prefixed and (it contains commas/quotes) quoted
    expect(lines[1]).toBe('GN-ARC-0102,10.000,1234567.50,2025-07-01,Yes,4,"\'=HYPERLINK(""http://evil"",""x"")"')
    // a negative amount stays a number; an empty date is empty
    expect(lines[2]).toBe("GN-ARC-0101,5.000,-250.00,,No,2,'@SUM(A1)")
  })

  it('a header label that looks like a formula is prefixed too', () => {
    expect(tableToCsv({ title: 't', columns: [{ key: 'a', label: '=evil', type: 'text' }], rows: [{ a: 'x' }] }).split('\r\n')[0]).toBe("'=evil")
  })

  it('names the file from the title and the date', () => {
    expect(csvFilename('Warranties ending (next 90 days)', new Date('2026-10-18T10:00:00Z'))).toBe('nova-warranties-ending-next-90-days-2026-10-18.csv')
    expect(csvFilename('???')).toMatch(/^nova-table-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})

describe('page context', () => {
  it('is empty when nothing is set', () => {
    expect(isEmptyContext(null)).toBe(true)
    expect(isEmptyContext({})).toBe(true)
    expect(isEmptyContext({ lead_id: 45 })).toBe(false)
    expect(isEmptyContext({ project_ref: 'GNE-1' })).toBe(false)
  })
  it('is described from what is actually sent', () => {
    expect(describeContext({ lead_id: 45 })).toBe('lead #45')
    expect(describeContext({ project_ref: 'GNE-WB-RES-2026-00125' })).toBe('project GNE-WB-RES-2026-00125')
    expect(describeContext({ customer_id: 12 })).toBe('this customer')
    expect(describeContext(null)).toBeNull()
  })
})

describe('roles and starter questions', () => {
  const roles: Role[] = ['admin', 'management', 'network_manager', 'accounts', 'operations', 'engineer', 'sales']
  it('every staff member may ask once their permissions are known; nobody else', () => {
    for (const r of [...roles, 'network_manager'] as Role[]) expect(canUseNova(permissionsValue([r]).can)).toBe(true)
    expect(canUseNova(permissionsValue([]).can)).toBe(false)
    expect(canUseNova(permissionsValue(['admin'], { isLoaded: false }).can)).toBe(false)
  })
  it('every role gets starters, all of them questions', () => {
    for (const r of roles) {
      const qs = starterQuestions(r)
      expect(qs.length).toBeGreaterThanOrEqual(3)
      for (const q of qs) expect(q.length).toBeGreaterThan(10)
    }
    expect(starterQuestions(undefined)).toEqual([])
  })
  it('never suggests what the role cannot see: no money for Operations/Engineer/Sales, no leads for Operations/Accounts', () => {
    const money = /outstanding|payment|contract value|balance|price/i
    for (const r of ['operations', 'engineer', 'sales'] as Role[]) for (const q of starterQuestions(r)) expect(q, `${r}: ${q}`).not.toMatch(money)
    for (const r of ['operations', 'accounts'] as Role[]) for (const q of starterQuestions(r)) expect(q, `${r}: ${q}`).not.toMatch(/\bleads?\b/i)
  })
})

describe('describeAskError', () => {
  const apiErr = (status: number, code?: string, retryAfter?: number) => new ApiError(status, 'x', 'detail', code ? { code } : undefined, retryAfter)
  it('a per-minute rate limit gives the retry time, from Retry-After or the contract default of 60', () => {
    expect(describeAskError(apiErr(429, 'rate_limited', 30))).toMatchObject({ kind: 'rate_limited', retryAfterSeconds: 30, retryable: true })
    expect(describeAskError(apiErr(429, 'rate_limited')).message).toContain('60 seconds')
  })
  it('the daily limit is final for today and has no retry time', () => {
    const f = describeAskError(apiErr(429, 'daily_limit_reached'))
    expect(f).toMatchObject({ kind: 'daily_limit', retryable: false })
    expect(f.retryAfterSeconds).toBeUndefined()
  })
  it.each([
    [503, 'assistant_disabled', 'disabled', false],
    [503, 'records_unavailable', 'unavailable', true],
    [404, 'conversation_not_found', 'conversation_gone', false],
    [422, 'empty_question', 'invalid', false],
    [0, undefined, 'network', true],
    [500, undefined, 'unavailable', true],
  ])('%s %s → %s', (status, code, kind, retryable) => {
    expect(describeAskError(apiErr(status, code))).toMatchObject({ kind, retryable })
  })
  it('a response that does not match the contract is a retryable error, not a crash', () => {
    expect(describeAskError(new ApiShapeError('/x', 'bad'))).toMatchObject({ kind: 'other', retryable: true })
    expect(describeAskError(new Error('boom'))).toMatchObject({ kind: 'other' })
  })
})

describe('Retry-After reaches the ApiError', () => {
  it('parseApiError reads the header on a 429', () => {
    const e = parseApiError(429, 'Too Many', JSON.stringify({ detail: { code: 'rate_limited', message: 'slow' } }), new Headers({ 'Retry-After': '60' }))
    expect(e.retryAfterSeconds).toBe(60)
    expect(e.structuredDetail?.code).toBe('rate_limited')
  })
  it('is absent when the header is missing or not a number', () => {
    expect(parseApiError(429, 'x', '{}', new Headers()).retryAfterSeconds).toBeUndefined()
    expect(parseApiError(429, 'x', '{}', new Headers({ 'Retry-After': 'soon' })).retryAfterSeconds).toBeUndefined()
    expect(parseApiError(500, 'x', '{}').retryAfterSeconds).toBeUndefined()
  })
})
