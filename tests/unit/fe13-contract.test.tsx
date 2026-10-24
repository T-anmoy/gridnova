import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { loadOpenApi, requestSchema, responseSchema, validate, type OpenApi } from './helpers/openapi'
import { ACCEPT_GET_WITH_DOCUMENT, NO_DOCUMENT_VIEW, documentView, editResponse, technicalView } from './fixtures/proposal-document-contract'
import { proposalAcceptResponseSchema } from '@/lib/dashboard/schemas'
import { adjustPricingBody } from '@/lib/dashboard/api-client'

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: () => Promise.resolve('token') }) }))

const spec: OpenApi = loadOpenApi()
const wire = (v: unknown) => JSON.parse(JSON.stringify(v))
const DOC = '/api/v1/dashboard/proposals/{proposal_id}/document'
const ADJUST = '/api/v1/dashboard/proposals/{proposal_id}/adjust-pricing'

describe('BE-13 fixtures satisfy the copied openapi.json', () => {
  it.each([
    ['full document (Admin / Sales / Management)', documentView()],
    ['Engineer technical view', technicalView()],
    ['older proposal without a document', NO_DOCUMENT_VIEW],
    ['locked after approval', documentView({ locked: true, editable_sections: [], status: 'approved', document_reference: 'GN/23/10/2026/01', document_date: '2026-10-23' })],
  ])('GET …/document — %s', (_label, body) => {
    const schema = responseSchema(spec, DOC, 'get')
    expect(schema).toBeDefined()
    expect(validate(spec, schema!, wire(body))).toEqual([])
  })

  it('PATCH …/document response', () => {
    const schema = responseSchema(spec, DOC, 'patch')!
    expect(validate(spec, schema, wire(editResponse()))).toEqual([])
    expect(validate(spec, schema, wire(editResponse({ ...technicalView({ revision: 4 }), total_value: null, requires_manager_signoff: null })))).toEqual([])
  })

  it('PATCH …/document request: one section, whole value, base revision', () => {
    const schema = requestSchema(spec, DOC, 'patch')!
    expect(validate(spec, schema, { base_revision: 3, section: 'boq', value: documentView().document && (documentView().document as { boq: unknown[] }).boq })).toEqual([])
    expect(validate(spec, schema, { base_revision: 3, section: 'connection', value: { discom: 'WBSEDCL' } })).toEqual([])
    // guards the guard: a missing base_revision must fail
    expect(validate(spec, schema, { section: 'boq', value: [] })).not.toEqual([])
  })

  it('preview.pdf is a PDF route', () => {
    const route = spec.paths['/api/v1/dashboard/proposals/{proposal_id}/preview.pdf']?.get
    expect(route).toBeDefined()
    const content = (route?.responses?.['200'] as { content?: Record<string, unknown> } | undefined)?.content ?? {}
    expect(Object.keys(content)).toContain('application/pdf')
  })

  it.each([
    ['new_value', { proposalId: 1, newValue: 250000, reason: 'r' }, { new_value: 250000, reason: 'r' }],
    ['basic_price', { proposalId: 1, basicPrice: '185000.00', reason: 'r' }, { basic_price: '185000.00', reason: 'r' }],
    ['rate_per_kwp', { proposalId: 1, ratePerKwp: '61666.67', reason: 'r' }, { rate_per_kwp: '61666.67', reason: 'r' }],
  ] as const)('adjust-pricing sends exactly one price field — %s', (_k, input, body) => {
    const sent = adjustPricingBody(input as never)
    expect(sent).toEqual(body)
    expect(Object.keys(sent).filter((k) => ['new_value', 'basic_price', 'rate_per_kwp'].includes(k))).toHaveLength(1)
    expect(validate(spec, requestSchema(spec, ADJUST, 'patch')!, sent)).toEqual([])
  })

  it('the accept GET with a document parses with the app’s zod schema and keeps the document', () => {
    const parsed = proposalAcceptResponseSchema.safeParse(ACCEPT_GET_WITH_DOCUMENT)
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true)
    expect(parsed.success && parsed.data.document?.total).toBe('201465.00')
    expect(proposalAcceptResponseSchema.safeParse({ ...ACCEPT_GET_WITH_DOCUMENT, document: null }).success).toBe(true)
  })
})

// The static path scan in contract-drift cannot see paths built from a base constant.
describe('every FE-13 call hits a published route', () => {
  const templates = Object.keys(spec.paths).map((p) => new RegExp(`^${p.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+')}$`))
  const calls: { method: string; path: string }[] = []

  beforeEach(() => {
    calls.length = 0
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:8000')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ method: (init?.method ?? 'GET').toLowerCase(), path: new URL(url).pathname })
        if (url.endsWith('.pdf')) return new Response('%PDF-1.4', { status: 200, headers: { 'Content-Type': 'application/pdf' } })
        return new Response(JSON.stringify(url.includes('/document') && init?.method === 'PATCH' ? editResponse() : documentView()), { status: 200 })
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('GET / PATCH …/document and GET …/preview.pdf', async () => {
    vi.resetModules()
    const mod = await import('@/lib/proposals/document-api-client')
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const read = renderHook(() => mod.useProposalDocument(12), { wrapper })
    await waitFor(() => expect(read.result.current.data).toBeDefined())
    const edit = renderHook(() => mod.useEditDocumentSection(), { wrapper })
    await edit.result.current.mutateAsync({ proposalId: 12, base_revision: 3, section: 'connection', value: { discom: 'WBSEDCL' } })
    await mod.fetchPreviewPdf(12, 'token')

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'get /api/v1/dashboard/proposals/12/document',
      'patch /api/v1/dashboard/proposals/12/document',
      'get /api/v1/dashboard/proposals/12/preview.pdf',
    ])
    for (const c of calls) {
      const route = Object.keys(spec.paths).find((p, i) => templates[i].test(c.path))
      expect(route, c.path).toBeDefined()
      expect(spec.paths[route!][c.method], `${c.method} ${route}`).toBeDefined()
    }
  })
})
