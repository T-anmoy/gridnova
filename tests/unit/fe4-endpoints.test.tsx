import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { loadOpenApi } from './helpers/openapi'
import * as commissionStaff from '@/lib/commissions/staff-api-client'
import * as commissionAssociate from '@/lib/commissions/associate-api-client'
import * as handoverStaff from '@/lib/handover/staff-api-client'
import * as handoverAssociate from '@/lib/handover/associate-api-client'
import { loadPublicHandover, loadPublicRequests } from '@/lib/handover/public'

// Drives every FE-4 hook / loader against a recording fetch and checks that each request it makes
// — method AND path — is one the backend publishes. The static drift test only sees string
// literals, and these clients build their paths from a base constant, so this is the guard that
// would catch a mistyped route.

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))
vi.mock('@/lib/config', () => ({ API_BASE_URL: 'https://api.test' }))

const spec = loadOpenApi()
const templates = Object.entries(spec.paths).map(([p, methods]) => ({
  re: new RegExp(`^${p.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+')}$`),
  methods: new Set(Object.keys(methods)),
  path: p,
}))

const seen: { method: string; path: string }[] = []
beforeEach(() => {
  seen.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      seen.push({ method: (init?.method ?? 'GET').toLowerCase(), path: new URL(url).pathname })
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => vi.unstubAllGlobals())

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

async function runQuery(hook: () => { isFetching: boolean; isFetched?: boolean }) {
  const { result } = renderHook(hook, { wrapper })
  await waitFor(() => expect(result.current.isFetched ?? !result.current.isFetching).toBe(true))
}
async function runMutation<T>(hook: () => { mutateAsync: (v: T) => Promise<unknown> }, input: T) {
  const { result } = renderHook(hook, { wrapper })
  await result.current.mutateAsync(input).catch(() => undefined) // the stub body is not the contract's; only the request matters
}

const lines = [{ associate_id: 'GNA-1', bank_reference: 'UTR1' }]
const schedule = { effective_from: '2026-11-01', is_placeholder: false, rates: { a: '1' } }

describe('every request the FE-4 clients make is a published route', () => {
  it('commission clients', async () => {
    await runQuery(() => commissionStaff.useStaffCommissions({ status: 'earned' }))
    await runQuery(() => commissionStaff.useRateSchedules())
    await runQuery(() => commissionStaff.usePayoutBatches())
    await runQuery(() => commissionStaff.usePayoutBatch(3))
    await runQuery(() => commissionStaff.useStaffCommissionQueries({}))
    await runQuery(() => commissionStaff.useNetworkSummary({}))
    await runQuery(() => commissionAssociate.useMyCommissions({}))
    await runQuery(() => commissionAssociate.useMyPayouts())
    await runQuery(() => commissionAssociate.useEntryQueries(12, true))
    await runMutation(commissionStaff.useApproveCommissions, [1])
    await runMutation(commissionStaff.useReverseCommission, { entryId: 1, reason: 'r' })
    await runMutation(commissionStaff.usePublishRateSchedule, schedule)
    await runMutation(commissionStaff.useReRate, { scheduleId: 2, reason: 'r' })
    await runMutation(commissionStaff.useCreatePayoutBatch, '2026-10')
    await runMutation(commissionStaff.useApprovePayoutBatch, { batchId: 3 })
    await runMutation(commissionStaff.useMarkPayoutPaid, { batchId: 3, lines })
    await runMutation(commissionStaff.useCancelPayoutBatch, { batchId: 3, reason: 'r' })
    await runMutation(commissionStaff.useRespondToQuery, { queryId: 8, response: 'r' })
    await runMutation(commissionAssociate.useRaiseCommissionQuery, { entryId: 12, message: 'm' })
    const { result } = renderHook(() => commissionStaff.useCommissionExport(), { wrapper })
    await result.current({ kind: 'commissions', date_from: '2026-10-01' }).catch(() => undefined)
    await result.current({ kind: 'tds', financial_year: '2026-27' }).catch(() => undefined)
    await result.current({ kind: 'bank', batchId: 3 }).catch(() => undefined)
    expect(seen.length).toBeGreaterThanOrEqual(22)
  })

  it('handover and service-request clients', async () => {
    await runQuery(() => handoverStaff.useHandoverPack(12))
    await runQuery(() => handoverStaff.useServiceQueue({ open: true }))
    await runQuery(() => handoverStaff.useProjectServiceRequests(12))
    await runQuery(() => handoverStaff.useServiceRequest(31))
    await runQuery(() => handoverAssociate.useMyHandoverPack(12))
    await runQuery(() => handoverAssociate.useMyServiceRequests(12))
    await runMutation(() => handoverStaff.useTickOrientation(12), { done: true })
    await runMutation(() => handoverStaff.useTickOmContact(12), { done: true })
    await runMutation(() => handoverStaff.useAcknowledge(12), { method: 'in_person' as const, customer_name: 'A' })
    await runMutation(() => handoverStaff.useIssueLink(12), true)
    await runMutation(() => handoverStaff.useRevokeLink(12), undefined)
    await runMutation(() => handoverStaff.useRegeneratePdf(12), undefined)
    await runMutation(() => handoverStaff.useRaiseServiceRequest(12), { category: 'other', description: 'x', files: [] })
    await runMutation(handoverStaff.useAssignRequest, { requestId: 31, assigneeId: null })
    await runMutation(handoverStaff.useSetRequestStatus, { requestId: 31, status: 'in_progress' as const })
    await runMutation(handoverStaff.useAddRequestNote, { requestId: 31, note: 'n' })
    await runMutation(() => handoverAssociate.useRaiseMyServiceRequest(12), { category: 'other', description: 'x', files: [] })
    await handoverStaff.fetchPackPdfLink(12, 'tok').catch(() => undefined)
    await handoverStaff.fetchRequestPhotoLink(31, 'ph-1', 'tok').catch(() => undefined)
    await handoverAssociate.fetchMyHandoverPdfLink(12, 'tok').catch(() => undefined)
    await loadPublicHandover('TOK')
    await loadPublicRequests('TOK')
    expect(seen.length).toBeGreaterThanOrEqual(21)
  })
})

function assertPublished() {
  const missing = seen.filter((r) => !templates.some((t) => t.re.test(r.path) && t.methods.has(r.method)))
  expect(missing, `requests with no matching route in openapi.json`).toEqual([])
}
afterEach(assertPublished)
