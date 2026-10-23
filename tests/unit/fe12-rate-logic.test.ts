import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  earliestDate,
  fromUnits,
  historyLines,
  individualRateError,
  isReduction,
  rangeProblem,
  stepRate,
  toUnits,
  validateRateForm,
} from '@/lib/commissions/individual-rate'
import { rateKeyLabel } from '@/lib/commissions/rates'
import { ApiError } from '@/lib/dashboard/api-error'
import { associateRateSchema, associatePerformanceSchema, myRateSchema, rateSchedulesSchema } from '@/lib/commissions/schemas'
import { RATE, PERFORMANCE, MY_RATE } from './fixtures/individual-rate-contract'

const err = (status: number, detail: Record<string, unknown>) => new ApiError(status, 'x', undefined, detail)

describe('contract fixtures parse with the app’s zod schemas', () => {
  it('staff rate, performance and own rate', () => {
    expect(associateRateSchema.safeParse(RATE).success).toBe(true)
    expect(associatePerformanceSchema.safeParse(PERFORMANCE).success).toBe(true)
    expect(myRateSchema.safeParse(MY_RATE).success).toBe(true)
  })
  it('the schedules list carries next_real_schedule_is_first', () => {
    const parsed = rateSchedulesSchema.parse({ items: [], rate_keys: [], earliest_effective_from: '2026-10-23', next_real_schedule_is_first: true })
    expect(parsed.next_real_schedule_is_first).toBe(true)
  })
})

describe('stepper works on whole ten-thousandths, never floating point', () => {
  it('converts both ways', () => {
    expect(toUnits('8.5')).toBe(85_000)
    expect(toUnits('0.0001')).toBe(1)
    expect(toUnits('100')).toBe(1_000_000)
    expect(toUnits('100.0001')).toBeNull()
    expect(toUnits('abc')).toBeNull()
    expect(fromUnits(85_000)).toBe('8.5')
    expect(fromUnits(80_000)).toBe('8')
  })
  it('steps up and down by a quarter and stays inside 0–100', () => {
    expect(stepRate('8', 1)).toBe('8.25')
    expect(stepRate('8.25', -1)).toBe('8')
    expect(stepRate('0.1', -1)).toBe('0')
    expect(stepRate('99.9', 1)).toBe('100')
    expect(stepRate('0.7', 1)).toBe('0.95') // no 0.7 + 0.25 = 0.9499999…
    expect(stepRate('', 1)).toBe('0.25')
  })
})

describe('increase vs reduction decides the minimum date', () => {
  it('a higher rate may start today, a lower one needs the notice date (read from the response)', () => {
    expect(isReduction('9', RATE)).toBe(false)
    expect(isReduction('7', RATE)).toBe(true)
    expect(isReduction('8', RATE)).toBe(false) // the same rate is no change
    expect(earliestDate('9', RATE)).toBe('2026-10-23')
    expect(earliestDate('7', RATE)).toBe('2026-11-07')
  })
  it('going back to a lower standard rate counts as a reduction', () => {
    expect(isReduction(null, RATE)).toBe(true)
    expect(earliestDate(null, RATE)).toBe('2026-11-07')
  })
  it('with no confirmed rate there is nothing to give notice of', () => {
    const none = { ...RATE, effective: { rate_percent: null, source: null, effective_from: null, pending_reason: 'placeholder_rates' }, standard: null }
    expect(isReduction('1', none)).toBe(false)
    expect(isReduction(null, none)).toBe(false)
  })
  it('follows the server when increases also need notice', () => {
    const strict = { ...RATE, notice: { ...RATE.notice, increase_needs_notice: true, increase_earliest_effective_from: '2026-11-07' } }
    expect(earliestDate('9', strict)).toBe('2026-11-07')
  })
})

describe('form checks mirror the server’s order and wording', () => {
  const ok = { next: '9', effectiveFrom: '2026-10-23', reason: 'Twelve installs this quarter' }
  it('accepts a good change', () => expect(validateRateForm(ok, RATE)).toEqual({}))
  it('needs a reason of 10 characters', () => expect(validateRateForm({ ...ok, reason: ' short ' }, RATE).reason).toMatch(/10 characters/))
  it('rejects a bad rate', () => {
    for (const bad of ['', 'abc', '101', '1.23456', '-1']) expect(validateRateForm({ ...ok, next: bad }, RATE).rate_percent, bad).toBeDefined()
  })
  it('refuses a reduction dated before the notice date and says when it may start', () => {
    const p = validateRateForm({ ...ok, next: '7', effectiveFrom: '2026-10-30' }, RATE)
    expect(p.effective_from).toMatch(/lower rate needs notice/i)
    expect(p.effective_from).toMatch(/07 Nov 2026/)
  })
  it('honours configured bounds', () => {
    const bounded = { ...RATE, bounds: { min_percent: '2', max_percent: '10' } }
    expect(validateRateForm({ ...ok, next: '11' }, bounded).rate_percent).toMatch(/between 2% and 10%/)
    expect(validateRateForm({ ...ok, next: '1' }, bounded).rate_percent).toBeDefined()
    expect(validateRateForm({ ...ok, next: '10' }, bounded).rate_percent).toBeUndefined()
  })
  it('"back to standard" needs no rate text', () => expect(validateRateForm({ ...ok, next: null, effectiveFrom: '2026-11-07' }, RATE)).toEqual({}))
})

describe('every structured error code becomes a plain sentence on the right field', () => {
  it.each([
    ['notice_period', { earliest_effective_from: '2026-11-07' }, 'effective_from', /notice period.*07 Nov 2026/],
    ['effective_in_past', { earliest_effective_from: '2026-10-23' }, 'effective_from', /passed.*23 Oct 2026/],
    ['invalid_rate', {}, 'rate_percent', /between 0 and 100/],
    ['out_of_bounds', { min_percent: '2.0000', max_percent: '10.0000' }, 'rate_percent', /between 2% and 10%/],
    ['out_of_bounds', { min_percent: null, max_percent: '10.0000' }, 'rate_percent', /at most 10%/],
    ['reason_required', {}, 'reason', /10 characters/],
  ])('%s', (code, extra, field, message) => {
    const r = individualRateError(err(422, { code, message: 'English from the server', field, ...extra }))
    expect(r.field).toBe(field)
    expect(r.message).toMatch(message)
    expect(r.message).not.toMatch(/English from the server|\{/)
  })
  it('a 403 says only an Admin can change it; anything else is generic', () => {
    expect(individualRateError(new ApiError(403, 'x', 'Only Admin can do this.')).message).toMatch(/Only an Admin/)
    expect(individualRateError(new Error('boom')).field).toBe('general')
  })
})

describe('history, ranges and labels', () => {
  it('shows old → new from the row below; null on either side is the standard rate', () => {
    const lines = historyLines(RATE.history)
    expect(lines[0].row.individual_rate_id).toBe(5)
    expect(lines[0].before).toBe('8.0000')
    expect(lines[1].before).toBeNull()
  })
  it('range needs both dates, in order, within 366 days', () => {
    expect(rangeProblem('', '')).toBeNull()
    expect(rangeProblem('2026-10-01', '')).toMatch(/both/i)
    expect(rangeProblem('2026-10-10', '2026-10-01')).toMatch(/not be after/)
    expect(rangeProblem('2025-10-01', '2026-10-31')).toMatch(/366/)
    expect(rangeProblem('2026-01-01', '2026-12-31')).toBeNull()
  })
  it('rate keys read as plain English, both Associate keys included', () => {
    expect(rateKeyLabel('personal_sale.associate.sales')).toBe('Associate — sales')
    expect(rateKeyLabel('personal_sale.associate.execution')).toBe('Associate — execution')
    expect(rateKeyLabel('personal_sale.preferred_associate.state_head')).toBe('Preferred Associate — State Head')
    expect(rateKeyLabel('territory_state')).toBe('Territory — State')
  })
})

describe('no rate is hard-coded in the new screens', () => {
  const root = path.resolve(__dirname, '../..')
  const files = [
    'components/dashboard/associate-network/AssociateRateCard.tsx',
    'components/dashboard/associate-network/AssociatePerformancePanel.tsx',
    'components/associate/MyRateCard.tsx',
    'lib/commissions/individual-rate.ts',
  ]
  it.each(files)('%s has no percentage literal next to a number', (file) => {
    const source = readFileSync(path.join(root, file), 'utf8')
    expect(source.match(/\d\s*%|%\s*\d/g)).toBeNull()
  })
  it('the portal copy has none either, apart from the {placeholders}', () => {
    for (const lang of ['en', 'hi', 'bn']) {
      const text = JSON.stringify(JSON.parse(readFileSync(path.join(root, `messages/${lang}.json`), 'utf8')).portalEase.rate)
      expect(text.match(/\d\s*%|%\s*\d/g), lang).toBeNull()
    }
  })
})
