// FE-18 contract drift: every Studio route the screens call is in the BE-18 openapi.json, every
// request body the screens build validates against its published schema, and the fields,
// statuses, events and permissions the screens read are the ones docs/api/proposal_studio.md
// names. A BE-18 change that moves any of these fails here first.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { loadOpenApi, requestSchema, validate, type OpenApi } from './helpers/openapi'
import { PERMISSIONS } from '@/lib/access/permissions'
import { STUDIO_STATUSES } from '@/lib/studio/types'
import { eventLabel } from '@/lib/studio/logic'
import { cleanCustomer, emptyCustomer } from '@/components/dashboard/studio/CustomerForm'
import { priceValue } from '@/components/dashboard/studio/WizardSteps'
import { OPTIONS, PUBLIC_OPEN, VERIFIED, makeView } from './fixtures/studio'

const root = path.resolve(__dirname, '../..')
const spec: OpenApi = loadOpenApi()
const doc = readFileSync(path.join(root, 'docs/api/proposal_studio.md'), 'utf8')
const api = readFileSync(path.join(root, 'lib/studio/api.ts'), 'utf8') + readFileSync(path.join(root, 'lib/studio/public-api.ts'), 'utf8')
const D = '/api/v1/dashboard/studio'
const PP = `${D}/proposals/{proposal_id}`

describe('every Studio route the screens call is published', () => {
  it.each([
    ['get', `${D}/options`], ['get', `${D}/summary`], ['get', `${D}/customers`], ['post', `${D}/customers`],
    ['get', `${D}/customers/{customer_id}`], ['patch', `${D}/customers/{customer_id}`],
    ['get', `${D}/proposals`], ['post', `${D}/proposals`], ['get', PP], ['patch', `${PP}/document`],
    ['post', `${PP}/acknowledge-warnings`], ['post', `${PP}/spelling/ignore`], ['post', `${PP}/submit`], ['post', `${PP}/approve`],
    ['post', `${PP}/reject`], ['post', `${PP}/issue`], ['get', `${PP}/preview.pdf`], ['get', `${PP}/pdf`], ['post', `${PP}/email`],
    ['post', `${PP}/whatsapp-link`], ['post', `${PP}/revise`], ['post', `${PP}/duplicate`], ['post', `${PP}/mark-accepted`],
    ['post', `${PP}/mark-lost`], ['post', `${PP}/convert`], ['get', `${PP}/events`], ['get', `${PP}/versions/{a}/diff/{b}`],
    ['post', `${PP}/suggest-from-notes`], ['post', `${PP}/save-as-template`], ['get', `${D}/library`], ['post', `${D}/library`],
    ['patch', `${D}/library/{item_id}`], ['get', `${D}/import-template.xlsx`], ['post', `${D}/import`],
    ['get', '/api/v1/public/studio/{token}'], ['post', '/api/v1/public/studio/{token}/accept'], ['post', '/api/v1/public/studio/{token}/decline'],
    ['get', '/api/v1/public/proposals/verify/{code}'], ['get', '/api/v1/equipment/'],
  ])('%s %s', (method, route) => {
    expect(spec.paths[route]?.[method], `${method} ${route}`).toBeDefined()
    const literal = route.replace(/\{[^}]+\}/g, '').replace(/\/+$/, '').split('/').filter(Boolean).pop()!
    expect(api, literal).toContain(literal)
  })

  it('the list and summary query parameters exist', () => {
    const names = (route: string) => (spec.paths[route]?.get as { parameters?: { name: string }[] })?.parameters?.map((p) => p.name) ?? []
    expect(names(`${D}/proposals`)).toEqual(expect.arrayContaining(['status', 'project_type', 'owner_id', 'date_from', 'date_to', 'q', 'page', 'page_size']))
    expect(names(`${D}/customers`)).toEqual(expect.arrayContaining(['q', 'limit']))
    expect(names(`${D}/library`)).toEqual(expect.arrayContaining(['kind', 'project_type', 'include_retired']))
    expect(names(PP)).toEqual(expect.arrayContaining(['version']))
  })
})

describe('request bodies the screens build satisfy openapi.json', () => {
  const ok = (route: string, method: string, body: unknown) => {
    const schema = requestSchema(spec, route, method)
    expect(schema, `${method} ${route}`).toBeDefined()
    expect(validate(spec, schema!, body), JSON.stringify(body)).toEqual([])
  }

  it('customers', () => {
    ok(`${D}/customers`, 'post', cleanCustomer({ ...emptyCustomer(), name: 'Ramesh Das', mobile: '9830000001', address_lines: ['5 Station Road', ''] }))
    ok(`${D}/customers`, 'post', cleanCustomer({ ...emptyCustomer(), customer_type: 'organisation', title: 'M/s', name: 'Sunrise Society', attention: 'Mr. Sen', mobile: '9830000001', email: 'a@b.in', address_lines: ['x'], gstin: '19abcde1234f1z5' }))
    ok(`${D}/customers/{customer_id}`, 'patch', { email: 'a@b.in' })
  })

  it('proposals and the section edit (every section the wizard sends)', () => {
    const v = makeView()
    ok(`${D}/proposals`, 'post', { customer_id: 3, project_type: 'residential_rooftop', template_id: null })
    for (const [section, value] of Object.entries({
      addressee: v.document.addressee, site: v.document.site, connection: v.document.connection, plant: v.document.plant, system: v.document.system,
      pm_surya_ghar: v.document.pm_surya_ghar, project: v.document.project, boq: v.document.boq, items: [], customer_scope: v.document.customer_scope,
      notes_free: ['x'], payment_terms: v.document.payment_terms, display: v.document.display, savings: null, cover_highlight: 'x', validity_days: 15,
      price: priceValue({ way: 'basic', amount: '170000', discountOn: true, discount: '5000', discountReason: 'Festival offer', reason: 'Competitor' }),
    })) {
      ok(`${PP}/document`, 'patch', { base_revision: 5, section, value })
    }
  })

  it('proof-check, approval, delivery, closing, library, assistant', () => {
    ok(`${PP}/acknowledge-warnings`, 'post', { fingerprints: ['9f0c'] })
    ok(`${PP}/spelling/ignore`, 'post', { word: 'recieve' })
    ok(`${PP}/approve`, 'post', { comment: null })
    ok(`${PP}/reject`, 'post', { comment: 'Keep the price master' })
    ok(`${PP}/email`, 'post', { to: null })
    ok(`${PP}/duplicate`, 'post', { version: 1 })
    ok(`${PP}/mark-lost`, 'post', { reason: 'Went elsewhere' })
    ok(`${PP}/save-as-template`, 'post', { name: '3 kW standard' })
    ok(`${PP}/suggest-from-notes`, 'post', { text: 'Ramesh Das, Habra' })
    ok(`${D}/library`, 'post', { kind: 'note', name: 'Earthing', project_type: null, body: { text: 'x' } })
    ok(`${D}/library/{item_id}`, 'patch', { active: false })
    ok('/api/v1/public/studio/{token}/accept', 'post', { full_name: 'Test Kumar Das', mobile_last4: '0001', accept_terms: true })
    ok('/api/v1/public/studio/{token}/decline', 'post', { reason: null })
  })

  it('multipart: the signed copy and the import file', () => {
    // requestSchema() reads JSON bodies; a multipart body's schema is a $ref under multipart/form-data.
    const form = (route: string) => {
      const op = spec.paths[route]?.post as { requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> } }
      const ref = op?.requestBody?.content?.['multipart/form-data']?.schema?.$ref ?? ''
      return (spec as unknown as { components: { schemas: Record<string, { required?: string[] }> } }).components.schemas[ref.split('/').pop()!]
    }
    expect(form(`${PP}/mark-accepted`)?.required).toEqual(expect.arrayContaining(['accepted_on', 'signed_copy']))
    expect(form(`${D}/import`)?.required).toEqual(['file'])
    expect(api).toContain("form.append('accepted_on'")
    expect(api).toContain("form.append('signed_copy'")
    expect(api).toContain("form.append('file'")
  })
})

describe('what the screens read is what proposal_studio.md names', () => {
  it('statuses (§3)', () => {
    for (const s of STUDIO_STATUSES) expect(doc).toContain(`\`${s}\``)
  })

  it('events (§10): every one has plain words on the timeline', () => {
    const list = doc.slice(doc.indexOf('`GET …/events`'), doc.indexOf('`GET …/versions'))
    const events = list.split('—')[1].replace(/\.\s*$/, '').split(',').map((s) => s.trim().replace(/[*`.\n]/g, '')).filter(Boolean)
    expect(events.length).toBeGreaterThan(20)
    for (const e of events) expect(eventLabel(e), e).not.toBe(e.replace(/_/g, ' '))
  })

  it('permissions (§1) are known to the dashboard', () => {
    for (const p of ['studio.view', 'studio.view_all', 'studio.edit', 'studio.price', 'studio.approve', 'studio.library.manage', 'studio.convert']) {
      expect(doc).toContain(`\`${p}\``)
      expect(PERMISSIONS).toContain(p)
    }
  })

  it('the View, figures, public page and verification fields the screens read', () => {
    const view = makeView()
    for (const k of ['missing_required', 'content_blockers', 'checks', 'errors', 'warnings_unacknowledged', 'approval_required', 'approval_reasons', 'versions', 'can', 'revision', 'layout']) {
      expect(doc, k).toContain(`"${k}"`)
      expect(view).toHaveProperty(k)
    }
    for (const k of Object.keys(view.can!)) expect(doc, `can.${k}`).toContain(`"${k}"`)
    for (const k of ['list_basic', 'below_price_master', 'discount', 'package_comparison', 'year1_savings', 'payback_years', 'total_savings_25_years', 'effective_cost', 'gst_groups']) expect(doc, k).toContain(k)
    for (const k of Object.keys(PUBLIC_OPEN)) expect(doc, `public.${k}`).toContain(k)
    for (const k of Object.keys(VERIFIED)) expect(doc, `verify.${k}`).toContain(k)
    for (const s of ['valid', 'superseded', 'expired', 'accepted', 'declined']) expect(doc).toContain(s)
    for (const s of ['open', 'accepted', 'declined', 'superseded', 'expired']) expect(doc).toContain(`${s}`)
  })

  it('the summary cards (§14)', () => {
    for (const k of ['drafts', 'awaiting_approval', 'issued_this_month', 'viewed_not_accepted', 'accepted', 'win_rate_90_days', 'expiring_in_7_days', 'median_days_issued_to_accepted']) expect(doc).toContain(k)
  })

  it('the online link path (§11) is the page the frontend serves', () => {
    expect(doc).toContain('FRONTEND_BASE_URL + "/proposal/" + token')
    expect(doc).toContain('/verify/p/<verification_code>')
  })

  it('GET /studio/options: the fields the wizard reads (shape from the BE-18 code — not written in the contract)', () => {
    expect(Object.keys(OPTIONS).sort()).toEqual(['assistant_enabled', 'categories', 'discoms', 'item_categories', 'item_units', 'module_technologies', 'packages', 'phases', 'price_modes', 'project_types', 'salutations', 'sections', 'titles', 'validity_days_default'])
  })
})
