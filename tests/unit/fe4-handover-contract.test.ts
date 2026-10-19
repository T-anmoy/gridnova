import { describe, it, expect } from 'vitest'
import { loadOpenApi, requestSchema, validate } from './helpers/openapi'
import { issuedLinkSchema, packSchema, publicHandoverSchema, serviceQueueSchema, serviceRequestSchema, signedFileSchema } from '@/lib/handover/schemas'
import { buildServiceRequestForm, serviceRequestProblem } from '@/lib/handover/service-request-form'
import { customerPageUrl, missingFromGate } from '@/lib/handover/labels'
import { ApiError } from '@/lib/dashboard/api-error'
import { COMPLETE_PACK, GATE_422_BODY, HANDED_OVER_PACK, PUBLIC_HANDOVER, makePack, makeRequest } from './fixtures/handover-contract'

const spec = loadOpenApi()
const wire = (v: unknown) => JSON.parse(JSON.stringify(v))
const dash = '/api/v1/dashboard'

function bodyValid(route: string, body: unknown) {
  const schema = requestSchema(spec, route, 'post')
  expect(schema, route).toBeDefined()
  expect(validate(spec, schema!, wire(body))).toEqual([])
}

describe('FE-4 handover request bodies satisfy openapi.json', () => {
  it('ticks, link and status/assign/note', () => {
    bodyValid(`${dash}/onboardings/{onboarding_id}/handover/orientation`, { done: true, note: 'Walked through the app' })
    bodyValid(`${dash}/onboardings/{onboarding_id}/handover/om-contact`, { done: false })
    bodyValid(`${dash}/onboardings/{onboarding_id}/handover/link`, { send_email: false })
    bodyValid(`${dash}/service-requests/{request_id}/status`, { status: 'resolved', note: 'Replaced the fuse.' })
    bodyValid(`${dash}/service-requests/{request_id}/status`, { status: 'in_progress' })
    bodyValid(`${dash}/service-requests/{request_id}/assign`, { assignee_id: null })
    bodyValid(`${dash}/service-requests/{request_id}/assign`, { assignee_id: 'EMP-OPS-1' })
    bodyValid(`${dash}/service-requests/{request_id}/notes`, { note: 'Called the customer.' })
  })

  it('the validator rejects a status the contract does not have', () => {
    const schema = requestSchema(spec, `${dash}/service-requests/{request_id}/status`, 'post')!
    expect(validate(spec, schema, { status: 'closed' })).not.toEqual([])
  })

  it('the multipart service-request body carries category, description, phone and repeated files', () => {
    const form = buildServiceRequestForm({ category: 'no_generation', description: '  No power  ', contact_phone: ' 9800000000 ', files: [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')] })
    expect(form.get('category')).toBe('no_generation')
    expect(form.get('description')).toBe('No power')
    expect(form.get('contact_phone')).toBe('9800000000')
    expect(form.getAll('files')).toHaveLength(2)
    for (const route of [`${dash}/onboardings/{onboarding_id}/service-requests`, '/api/v1/associate/onboardings/{onboarding_id}/service-requests', '/api/v1/public/handover/{token}/service-requests']) {
      const body = spec.paths[route]?.post?.requestBody?.content?.['multipart/form-data']?.schema as { $ref?: string } | undefined
      const name = body?.$ref?.replace('#/components/schemas/', '')
      const props = Object.keys((spec.components.schemas[name!] as { properties?: object }).properties ?? {})
      for (const field of ['category', 'description', 'contact_phone', 'files']) expect(props, `${route} ${field}`).toContain(field)
    }
  })

  it('refuses an unknown category or empty description locally', () => {
    expect(serviceRequestProblem({ category: 'weather', description: 'x' })).toBe('category')
    expect(serviceRequestProblem({ category: 'other', description: '   ' })).toBe('description')
    expect(serviceRequestProblem({ category: 'other', description: 'x'.repeat(2001) })).toBe('description')
    expect(serviceRequestProblem({ category: 'other', description: 'ok', contact_phone: '9'.repeat(33) })).toBe('phone')
    expect(serviceRequestProblem({ category: 'other', description: 'ok' })).toBeNull()
  })

  it('the acknowledgement multipart body has the documented fields', () => {
    const body = spec.paths[`${dash}/onboardings/{onboarding_id}/handover/acknowledgement`].post.requestBody!.content!['multipart/form-data'].schema as { $ref: string }
    const props = Object.keys((spec.components.schemas[body.$ref.replace('#/components/schemas/', '')] as { properties: object }).properties)
    expect(props.sort()).toEqual(['customer_name', 'file', 'method', 'note'])
  })
})

describe('FE-4 handover reply fixtures parse with the app’s zod schemas', () => {
  it.each([
    ['pack (incomplete)', packSchema, makePack()],
    ['pack (complete)', packSchema, COMPLETE_PACK],
    ['pack (handed over, with warranty)', packSchema, HANDED_OVER_PACK],
    ['issued link', issuedLinkSchema, { link: { url: 'https://api.example/api/v1/public/handover/abc/pdf', expires_at: null }, pack: HANDED_OVER_PACK }],
    ['signed file', signedFileSchema, { url: 'https://r2.example/x?sig=1', expires_at: '2026-11-02T06:00:00Z', filename: 'pack.pdf', file_ref: 'f' }],
    ['service request', serviceRequestSchema, makeRequest()],
    ['service queue', serviceQueueSchema, { items: [makeRequest()], page: 1, page_size: 25, total: 1, can_handle: true }],
    ['public handover page', publicHandoverSchema, PUBLIC_HANDOVER],
  ])('%s', (_n, schema, fixture) => {
    const r = schema.safeParse(fixture)
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true)
  })

  it('unconfirmed warranty values stay null instead of being filled in', () => {
    const w = HANDED_OVER_PACK.warranty!
    expect(w.om.terms_after_free_period).toBeNull()
    expect(w.panel_performance_life_years).toBeNull()
    expect(w.units[1].warranty_end).toBeNull()
  })
})

describe('the gate’s 422', () => {
  it('is read as a list of keys and labels', () => {
    const err = new ApiError(422, 'x', 'The handover pack is incomplete.', GATE_422_BODY)
    expect(missingFromGate(err)).toEqual({ keys: ['orientation', 'acknowledgement'], labels: ['Customer orientation', 'Customer acknowledgement'] })
    expect(missingFromGate(new ApiError(422, 'x', 'x', { code: 'other' }))).toBeNull()
  })
  it('falls back to readable labels when the server sends only keys', () => {
    expect(missingFromGate(new ApiError(422, 'x', 'x', { code: 'handover_pack_incomplete', missing: ['om_contact'] }))?.labels).toEqual(['O&M contact given'])
  })
})

describe('the customer page link', () => {
  it('is derived from the one-time PDF link’s token', () => {
    expect(customerPageUrl('https://api.gridnova.in/api/v1/public/handover/Zx9-_k/pdf', 'https://www.gridnova.in/')).toBe('https://www.gridnova.in/handover/Zx9-_k')
    expect(customerPageUrl('https://elsewhere.example/x', 'https://www.gridnova.in')).toBeNull()
  })
})
