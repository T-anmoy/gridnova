// FE-20 contract drift: the direct-customer payment routes the screens call are in the BE-20
// openapi.json, the bodies they build validate, every error code docs/api/direct_payments.md lists
// for recording has its own plain sentence, and the codes associate_journeys.md §9 names (slots,
// documents, segments) are the ones the copy translates. A BE-20 change that moves any of these
// fails here first.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { loadOpenApi, requestSchema, validate, type OpenApi } from './helpers/openapi'
import { PAYMENT_IN_CHEQUE } from './fixtures/payments-contract'
import { ApiError } from '@/lib/dashboard/api-error'
import { staffPaymentError } from '@/lib/dashboard/payment-ui'
import { STAFF_PAYMENT_COPY } from '@/lib/dashboard/staff-copy'
import { ESTIMATE_SEGMENTS } from '@/lib/associate/onboarding-types'
import en from '@/messages/en.json'

const root = path.resolve(__dirname, '../..')
const spec: OpenApi = loadOpenApi()
const read = (f: string) => readFileSync(path.join(root, f), 'utf8')
const doc = read('docs/api/direct_payments.md')
const journeys = read('docs/api/associate_journeys.md')
const client = read('lib/dashboard/lead-payments-api-client.ts') + read('lib/associate/api-client.ts') + read('lib/dashboard/accounts-api-client.ts')
const wire = (v: unknown) => JSON.parse(JSON.stringify(v))
const D = '/api/v1/dashboard'

describe('every BE-20 route the screens call is published', () => {
  it.each([
    ['get', `${D}/leads/{lead_id}/payments`],
    ['post', `${D}/leads/{lead_id}/payments`],
    ['get', `${D}/leads/{lead_id}/payments/{payment_id}/receipt`],
    ['get', `${D}/associates/{associate_id}/customers`],
    ['post', `${D}/payments/{payment_id}/verify`],
    ['post', `${D}/payments/{payment_id}/dishonour`],
    ['post', `${D}/payments/{payment_id}/deposit`],
    ['post', `${D}/payments/{payment_id}/cancel`],
    ['post', `${D}/payments/{payment_id}/receipt/resend`],
  ])('%s %s', (method, route) => {
    expect(spec.paths[route]?.[method], `${method} ${route}`).toBeDefined()
    const tail = route.replace(/\{[^}]+\}/g, '').replace(/\/+$/, '').split('/').filter(Boolean).pop()!
    expect(client, tail).toContain(tail)
  })

  it('the payments list takes lead_id (the Accounts "Lead #N only" filter)', () => {
    const params = (spec.paths[`${D}/payments`]?.get as { parameters?: { name: string }[] }).parameters?.map((p) => p.name)
    expect(params).toContain('lead_id')
  })

  it('the lead timeline knows the three payment events', () => {
    const s = JSON.stringify(spec)
    for (const e of ['payment_recorded', 'payment_verified', 'payment_dishonoured']) expect(s).toContain(`"${e}"`)
  })
})

describe('request bodies satisfy openapi.json', () => {
  it('POST …/leads/{lead_id}/payments takes the associate customers’ PaymentIn', () => {
    const schema = requestSchema(spec, `${D}/leads/{lead_id}/payments`, 'post')
    expect(schema).toBeDefined()
    expect(validate(spec, schema!, wire(PAYMENT_IN_CHEQUE))).toEqual([])
    expect(validate(spec, schema!, wire({ amount: '54450.00', mode: 'neft', reference: 'UTR0001' }))).toEqual([])
  })

  it('reassign-customers takes the ticked onboarding_ids', () => {
    const schema = requestSchema(spec, `${D}/associates/{associate_id}/reassign-customers`, 'post')
    expect(validate(spec, schema!, wire({ to_associate_id: 'GNA-WB-26-00002', reason: 'Suspended', onboarding_ids: [4, 9] }))).toEqual([])
  })
})

describe('every recording rule in direct_payments.md has its own sentence', () => {
  // The rule table's `code`s, read from the doc itself.
  const table = doc.slice(doc.indexOf('| Rule | Error |'), doc.indexOf('- **Partial payments:**'))
  const codes = [...table.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]).filter((c) => !['amount', 'mode', 'reference', 'bank_name', 'instrument_date', 'milestone_id', 'accepted_total', 'already_recorded', 'outstanding'].includes(c))

  it('reads the table (sanity)', () => {
    expect(codes).toEqual(expect.arrayContaining(['not_accepted', 'no_accepted_total', 'invalid_amount', 'mode_not_enabled', 'reference_required', 'instrument_details_required', 'date_in_future', 'unknown_milestone', 'exceeds_outstanding', 'duplicate_payment_reference']))
  })

  it.each(['not_accepted', 'no_accepted_total', 'invalid_amount', 'mode_not_enabled', 'reference_required', 'instrument_details_required', 'date_in_future', 'unknown_milestone', 'exceeds_outstanding', 'duplicate_payment_reference', 'self_verification', 'invalid_transition', 'associate_customer'])(
    '%s',
    (code) => {
      expect(codes.includes(code) || doc.includes(code)).toBe(true)
      const text = staffPaymentError(new ApiError(409, 'x', 'Server English', { code, outstanding: '1.00', accepted_total: '2.00', already_recorded: '1.00' }))
      expect(text).not.toBe(STAFF_PAYMENT_COPY.errors.generic)
      expect(text).not.toContain('Server English')
    },
  )

  it('enabled modes: cheque, NEFT, RTGS, IMPS — the doc and the labels agree', () => {
    expect(doc).toContain('cheque, neft, rtgs, imps')
    for (const m of ['cheque', 'neft', 'rtgs', 'imps']) expect(STAFF_PAYMENT_COPY.modes[m as keyof typeof STAFF_PAYMENT_COPY.modes]).toBeTruthy()
  })
})

describe('associate_journeys.md §9 codes are the ones the copy translates', () => {
  const section = journeys.slice(journeys.indexOf('## 9. Documents and photos'), journeys.indexOf('## 10.'))
  const rows = (heading: string) => {
    const start = section.indexOf(heading)
    const block = section.slice(start, section.indexOf('\n\n', start))
    return [...block.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1])
  }

  it('site photos', () => {
    const codes = rows('| Site-photo code |')
    expect(codes).toHaveLength(7)
    expect(Object.keys(en.associates.portal.wizard.photos.slotLabels).sort()).toEqual([...codes].sort())
  })

  it('site documents', () => {
    const codes = rows('| Document code |')
    expect(codes).toHaveLength(6)
    expect(Object.keys(en.associates.portal.wizard.documents.typeLabels).sort()).toEqual([...codes].sort())
  })

  it('estimate segments', () => {
    const line = section.slice(section.indexOf('`segment` is one of')).split('\n')[0]
    expect([...line.matchAll(/`([a-z]+)`/g)].map((m) => m[1]).filter((c) => c !== 'segment')).toEqual([...ESTIMATE_SEGMENTS])
  })

  it('duplicate_onboarding names the existing record', () => {
    expect(journeys).toContain('"existing_onboarding_id"')
    expect(journeys).toContain('"client_code"')
    expect(read('components/associate/OnboardingWizard.tsx')).toMatch(/existing_onboarding_id[\s\S]*client_code/)
  })

  it('the associate customers list carries what the tick list shows', () => {
    for (const f of ['onboarding_id', 'client_code', 'customer_name', 'status', 'project_stage', 'open']) expect(journeys).toContain(`"${f}"`)
  })
})
