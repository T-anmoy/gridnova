import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { loadOpenApi, requestSchema, responseSchema, validate, type OpenApi } from './helpers/openapi'
import { ADJUST_PRICING_REQUEST_BODY, REVIEW_PROPOSAL_INPUT_APPROVE_BODY, REVIEW_PROPOSAL_INPUT_REJECT_BODY } from './fixtures/dashboard-contract'
import { CHAT_REPLY_FIXTURE } from './fixtures/chat-contract'
import { PAYMENT_IN_CHEQUE, PAYMENT_IN_UPI } from './fixtures/payments-contract'
import { ONBOARDING_CREATE_BODY, ONBOARDING_PATCH_NAME } from './fixtures/onboarding-contract'
import { LEAD_LIST_FIXTURE } from './fixtures/leads-contract'
import { ACCEPT_POST_FIXTURE } from './fixtures/accept-contract'
import { chatMessageResponseSchema, leadListResponseSchema, proposalAcceptResponseSchema } from '@/lib/dashboard/schemas'

const spec: OpenApi = loadOpenApi()
const root = path.resolve(__dirname, '../..')

/** JSON-stringify then parse, which drops `undefined` exactly as the wire does. */
const wire = (v: unknown) => JSON.parse(JSON.stringify(v))

function expectRequestValid(route: string, method: string, body: unknown) {
  const schema = requestSchema(spec, route, method)
  expect(schema, `${method.toUpperCase()} ${route} has no request schema in the snapshot`).toBeDefined()
  expect(validate(spec, schema!, wire(body))).toEqual([])
}

describe('request bodies in the shared fixtures satisfy openapi.json', () => {
  it('POST /api/v1/associate/onboardings (new customer)', () => {
    expectRequestValid('/api/v1/associate/onboardings', 'post', ONBOARDING_CREATE_BODY)
  })

  it('PATCH /api/v1/associate/onboardings/{id} (one changed field)', () => {
    expectRequestValid('/api/v1/associate/onboardings/{onboarding_id}', 'patch', ONBOARDING_PATCH_NAME)
  })

  it.each([
    ['cheque (every optional field)', PAYMENT_IN_CHEQUE],
    ['UPI (required fields only)', PAYMENT_IN_UPI],
  ])('POST …/payments — %s, associate and staff', (_label, body) => {
    expectRequestValid('/api/v1/associate/onboardings/{onboarding_id}/payments', 'post', body)
    expectRequestValid('/api/v1/dashboard/onboardings/{onboarding_id}/payments', 'post', body)
  })

  it('PATCH …/adjust-pricing uses new_value + reason', () => {
    expectRequestValid('/api/v1/dashboard/proposals/{proposal_id}/adjust-pricing', 'patch', ADJUST_PRICING_REQUEST_BODY(300000, 'Equipment cost increased'))
  })

  it('PATCH /proposal-inputs/{id}/review uses rejection_reason (a field named `reason` would be ignored)', () => {
    expectRequestValid('/api/v1/proposal-inputs/{inputs_id}/review', 'patch', REVIEW_PROPOSAL_INPUT_APPROVE_BODY())
    expectRequestValid('/api/v1/proposal-inputs/{inputs_id}/review', 'patch', REVIEW_PROPOSAL_INPUT_REJECT_BODY('Photos unreadable'))
  })

  it('POST /api/v1/chat/message sends only the message and the session token', () => {
    expectRequestValid('/api/v1/chat/message', 'post', { message: 'hello' })
    expectRequestValid('/api/v1/chat/message', 'post', { message: 'hello', session_token: CHAT_REPLY_FIXTURE.session_token })
  })

  it('the validator really rejects a wrong body (guards the guard)', () => {
    const schema = requestSchema(spec, '/api/v1/dashboard/proposals/{proposal_id}/adjust-pricing', 'patch')!
    expect(validate(spec, schema, { new_total_value: 1, reason: 'x' })).not.toEqual([])
    expect(validate(spec, requestSchema(spec, '/api/v1/associate/onboardings/{onboarding_id}/payments', 'post')!, { amount: '1', mode: 'cash', reference: 'x' })).toEqual([])
    // `mode` is a free string on PaymentIn (the cash ban is enforced server-side), so no enum failure here;
    // a missing required field must still fail:
    expect(validate(spec, requestSchema(spec, '/api/v1/associate/onboardings/{onboarding_id}/payments', 'post')!, { amount: '1' })).not.toEqual([])
  })
})

describe('reply fixtures', () => {
  it('chat reply satisfies ChatResponse in openapi.json', () => {
    const schema = responseSchema(spec, '/api/v1/chat/message', 'post')
    expect(schema).toBeDefined()
    expect(validate(spec, schema!, wire(CHAT_REPLY_FIXTURE))).toEqual([])
  })

  // Routes that publish no response schema (`{}`) are checked against the zod schemas
  // the app itself parses the reply with; where one is published, both are checked.
  it('chat reply parses with the app’s zod schema', () => {
    expect(chatMessageResponseSchema.safeParse(CHAT_REPLY_FIXTURE).success).toBe(true)
  })

  it('lead list fixture parses with the app’s zod schema', () => {
    const published = responseSchema(spec, '/api/v1/dashboard/leads', 'get')
    if (published) expect(validate(spec, published, wire(LEAD_LIST_FIXTURE))).toEqual([])
    const parsed = leadListResponseSchema.safeParse(LEAD_LIST_FIXTURE)
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true)
  })

  it('proposal accept reply parses with the app’s zod schema', () => {
    expect(responseSchema(spec, '/api/v1/proposals/accept/{token}', 'post')).toBeUndefined()
    const parsed = proposalAcceptResponseSchema.safeParse(ACCEPT_POST_FIXTURE)
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true)
  })
})

describe('every backend path the app calls exists in the snapshot', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(full)
      return /\.(ts|tsx)$/.test(name) ? [full] : []
    })
  }
  const templates = Object.keys(spec.paths).map((p) => new RegExp(`^${p.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+')}/?$`))

  it('finds no /api/v1 path the backend does not publish', () => {
    const called = new Set<string>()
    for (const dir of ['lib', 'components', 'app']) {
      for (const file of sourceFiles(path.join(root, dir))) {
        const text = readFileSync(file, 'utf8')
        // String and template literals that start with /api/v1/, query strings and params normalised.
        for (const m of text.matchAll(/[`'"](\/api\/v1\/[A-Za-z0-9_\-/.${}()[\]?=&,: ]*)/g)) {
          let p = m[1].split('?')[0]
          // `/${id}` is a path parameter; a `${qs}` glued to the last segment is a query string.
          p = p.replace(/\/\$\{[^}]*\}/g, '/X').replace(/\$\{[^}]*\}/g, '')
          p = p.replace(/\/+$/, '')
          // Bare API roots held in constants (`const BASE = '/api/v1/dashboard'`) are prefixes, not endpoints.
          if (/^\/api\/v1\/[a-z]+$/.test(p) && !spec.paths[p]) continue
          if (!/^\/api\/v1\/[a-z]/.test(p) || p.includes(' ')) continue
          called.add(p)
        }
      }
    }
    const missing = [...called].filter((p) => !templates.some((t) => t.test(p) || t.test(`${p}/`)))
    expect(missing).toEqual([])
    expect(called.size).toBeGreaterThan(20)
  })
})
