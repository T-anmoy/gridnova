import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { loadOpenApi } from './helpers/openapi'
import * as nova from '@/lib/nova/api-client'
import * as archive from '@/lib/archive/api-client'

// Same guard as fe4-endpoints.test.tsx, for the FE-7 clients: drives every hook against a recording fetch and checks
// that each request it makes — method AND path — is one the backend publishes in docs/api/openapi.json. The clients
// build their paths from a base constant, so the static drift test cannot see a mistyped route; this can.

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
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

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

const file = new File(['a'], 'p.csv', { type: 'text/csv' })

describe('every request the FE-7 clients make is a published route', () => {
  it('Nova Records', async () => {
    await runMutation(nova.useNovaAsk, { question: 'q', conversation_id: 'a'.repeat(32), context: { lead_id: 1 } })
    await runQuery(() => nova.useNovaConversations())
    await runQuery(() => nova.useNovaConversation('b'.repeat(32)))
    await runMutation(nova.useNovaFeedback, { turnId: 'c'.repeat(32), helpful: true, note: 'n' })
    const { result } = renderHook(() => nova.useLoadNovaConversation(), { wrapper })
    await result.current('d'.repeat(32)).catch(() => undefined)
    expect(seen.map((r) => `${r.method} ${r.path.replace(/[0-9a-f]{32}/g, ':id')}`).sort()).toEqual([
      'get /api/v1/dashboard/nova/conversations',
      'get /api/v1/dashboard/nova/conversations/:id',
      'get /api/v1/dashboard/nova/conversations/:id',
      'post /api/v1/dashboard/nova/ask',
      'post /api/v1/dashboard/nova/turns/:id/feedback',
    ])
  })

  it('Project Archive', async () => {
    await runQuery(() => archive.useArchiveProjects({ page: 1, page_size: 25, district: 'Howrah' }))
    await runQuery(() => archive.useArchiveStats({ district: 'Howrah' }))
    await runQuery(() => archive.useArchiveProject(41))
    await runQuery(() => archive.useArchiveBatches())
    await runQuery(() => archive.useArchiveBatch(7))
    await runMutation(archive.useArchiveImport, { file, dryRun: true })
    await runMutation(archive.useArchiveImport, { file, dryRun: false, batchToken: 'tok' })
    await runMutation(archive.useVoidArchiveBatch, { batchId: 7, reason: 'Wrong file' })
    const { result } = renderHook(() => archive.useDownloadArchiveTemplate(), { wrapper })
    await result.current().catch(() => undefined)
    expect(seen.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
      'get /api/v1/dashboard/archive/imports',
      'get /api/v1/dashboard/archive/imports/7',
      'get /api/v1/dashboard/archive/projects',
      'get /api/v1/dashboard/archive/projects/41',
      'get /api/v1/dashboard/archive/stats',
      'get /api/v1/dashboard/archive/template.csv',
      'post /api/v1/dashboard/archive/imports',
      'post /api/v1/dashboard/archive/imports',
      'post /api/v1/dashboard/archive/imports/7/void',
    ])
  })
})

afterEach(() => {
  const missing = seen.filter((r) => !templates.some((t) => t.re.test(r.path) && t.methods.has(r.method)))
  expect(missing, 'requests with no matching route in openapi.json').toEqual([])
})
