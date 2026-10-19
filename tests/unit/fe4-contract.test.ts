import { describe, it, expect } from 'vitest'
import { loadOpenApi, requestSchema, validate } from './helpers/openapi'
import {
  approveResultSchema,
  associateCommissionsSchema,
  associatePayoutsSchema,
  commissionQuerySchema,
  networkSummarySchema,
  payoutBatchSchema,
  rateSchedulesSchema,
} from '@/lib/commissions/schemas'
import {
  ASSOCIATE_COMMISSIONS,
  ASSOCIATE_PAYOUTS,
  NETWORK_SUMMARY,
  PENDING_ENTRY,
  RATE_KEYS,
  RATE_SCHEDULES,
  RECOVERY_ENTRY,
  REVERSAL_ENTRY,
  makeBatch,
  makeEntry,
  makeQuery,
} from './fixtures/commissions-contract'

const spec = loadOpenApi()
const wire = (v: unknown) => JSON.parse(JSON.stringify(v))

function expectBodyValid(route: string, method: string, body: unknown) {
  const schema = requestSchema(spec, route, method)
  expect(schema, `${method.toUpperCase()} ${route} has no JSON request schema`).toBeDefined()
  expect(validate(spec, schema!, wire(body))).toEqual([])
}

describe('FE-4 commission request bodies satisfy openapi.json', () => {
  it('associate: raise a query', () => {
    expectBodyValid('/api/v1/associate/commissions/{entry_id}/queries', 'post', { message: 'Why is my rate 5%?' })
  })
  it('staff: approve, reverse, publish, re-rate, batches, respond', () => {
    const dash = '/api/v1/dashboard'
    expectBodyValid(`${dash}/commissions/approve`, 'post', { entry_ids: [1, 2, 3] })
    expectBodyValid(`${dash}/commissions/{entry_id}/reverse`, 'post', { reason: 'False information' })
    expectBodyValid(`${dash}/commission-rate-schedules`, 'post', {
      effective_from: '2026-11-01',
      is_placeholder: false,
      rates: Object.fromEntries(RATE_KEYS.map((k) => [k, '2.5'])),
      note: 'Q4 schedule',
    })
    expectBodyValid(`${dash}/commission-rate-schedules/{schedule_id}/re-rate`, 'post', { reason: 'Rates confirmed' })
    expectBodyValid(`${dash}/payout-batches`, 'post', { period: '2026-10' })
    expectBodyValid(`${dash}/payout-batches/{batch_id}/approve`, 'post', { reason: 'Only Accounts user available' })
    expectBodyValid(`${dash}/payout-batches/{batch_id}/mark-paid`, 'post', { lines: [{ associate_id: 'GNA-WB-26-00007', bank_reference: 'UTR123456' }] })
    expectBodyValid(`${dash}/payout-batches/{batch_id}/cancel`, 'post', { reason: 'Stale draft' })
    expectBodyValid(`${dash}/commission-queries/{query_id}/respond`, 'post', { response: 'Rate is per schedule v1.' })
  })
  it('the validator rejects a wrong body (guards the guard)', () => {
    const schema = requestSchema(spec, '/api/v1/dashboard/payout-batches', 'post')!
    expect(validate(spec, schema, { month: '2026-10' })).not.toEqual([])
  })
})

describe('FE-4 commission reply fixtures parse with the app’s zod schemas', () => {
  it.each([
    ['associate commissions', associateCommissionsSchema, ASSOCIATE_COMMISSIONS],
    ['associate payouts', associatePayoutsSchema, ASSOCIATE_PAYOUTS],
    ['payout batch with lines', payoutBatchSchema, makeBatch()],
    ['rate schedules', rateSchedulesSchema, RATE_SCHEDULES],
    ['commission query', commissionQuerySchema, makeQuery()],
    ['network summary', networkSummarySchema, NETWORK_SUMMARY],
    ['approve result', approveResultSchema, { approved: 1, items: [makeEntry({ status: 'approved' })] }],
  ])('%s', (_name, schema, fixture) => {
    const parsed = schema.safeParse(fixture)
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true)
  })

  it('reversal, recovery and waiting entries parse; money stays a string', () => {
    for (const e of [REVERSAL_ENTRY, RECOVERY_ENTRY, PENDING_ENTRY]) {
      const r = associateCommissionsSchema.shape.items.element.safeParse(e)
      expect(r.success).toBe(true)
    }
    expect(typeof REVERSAL_ENTRY.amount).toBe('string')
    expect(PENDING_ENTRY.amount).toBeNull()
  })

  it('a number where the contract says a decimal string is a loud shape error', () => {
    const bad = { ...ASSOCIATE_COMMISSIONS, summary: { ...ASSOCIATE_COMMISSIONS.summary, earned: 1000 } }
    expect(associateCommissionsSchema.safeParse(bad).success).toBe(false)
  })
})
