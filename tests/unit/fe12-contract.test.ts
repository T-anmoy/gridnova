import { describe, it, expect } from 'vitest'
import { loadOpenApi, requestSchema, responseSchema, validate } from './helpers/openapi'
import { RATE, PERFORMANCE, MY_RATE } from './fixtures/individual-rate-contract'

// BE-12 against the copied openapi.json (tests/contract/openapi.json). Where the backend publishes
// no response schema the fixtures are checked by the zod schemas in fe12-rate-logic.test.ts.
const spec = loadOpenApi()
const wire = (v: unknown) => JSON.parse(JSON.stringify(v))
const RATE_ROUTE = '/api/v1/dashboard/associates/{associate_id}/commission-rate'

describe('FE-12 request bodies satisfy openapi.json', () => {
  const body = requestSchema(spec, RATE_ROUTE, 'post')
  const base = { effective_from: '2026-10-23', reason: 'Twelve installs this quarter, all on time' }

  it('sets a rate as a percentage STRING', () => {
    expect(body).toBeDefined()
    expect(validate(spec, body!, { ...base, rate_percent: '8.5' })).toEqual([])
  })
  it('“back to standard” is rate_percent: null', () => {
    expect(validate(spec, body!, wire({ ...base, rate_percent: null }))).toEqual([])
  })
  it('a JSON number or a missing key is refused (guards the guard)', () => {
    expect(validate(spec, body!, { ...base, rate_percent: 8.5 })).not.toEqual([])
    expect(validate(spec, body!, base)).not.toEqual([])
  })
})

describe('FE-12 reply fixtures satisfy the published response schemas', () => {
  it.each([
    [RATE_ROUTE, RATE],
    ['/api/v1/associate/commission-rate', MY_RATE],
    ['/api/v1/dashboard/associates/{associate_id}/performance', PERFORMANCE],
  ])('GET %s', (route, fixture) => {
    const schema = responseSchema(spec, route, 'get')
    expect(schema, `${route} publishes a response schema`).toBeDefined()
    expect(validate(spec, schema!, wire(fixture))).toEqual([])
  })

  it('POST …/commission-rate → {change, rate}', () => {
    const schema = responseSchema(spec, RATE_ROUTE, 'post')
    expect(schema).toBeDefined()
    expect(validate(spec, schema!, wire({ change: RATE.history[0], rate: RATE }))).toEqual([])
  })
})
