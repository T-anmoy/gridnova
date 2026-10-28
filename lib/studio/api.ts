'use client'

import { useAuth } from '@clerk/nextjs'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDownload, apiFetch, apiFetchBlob, apiFetchForm, buildQS, getTokenOrThrow } from '@/lib/api/http'
import { ApiError } from '@/lib/dashboard/api-error'
import type {
  AssistantResponse,
  CustomerInput,
  CustomerResponse,
  ImportCreated,
  LibraryItem,
  LibraryKind,
  SectionEditResponse,
  StudioCustomer,
  StudioEvent,
  StudioListParams,
  StudioListResponse,
  StudioOptions,
  StudioSummary,
  StudioView,
  VersionDiff,
} from './types'

// The Proposal Studio's staff routes (docs/api/proposal_studio.md). Every call is
// permission-checked by the server; the screens only hide what the person cannot do.

export const STUDIO = '/api/v1/dashboard/studio'
const P = `${STUDIO}/proposals`

/** A 4xx is an answer (not permitted, not found, locked…), never retried. */
const noRetryOn4xx = (count: number, err: unknown) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2

function useToken() {
  const { getToken } = useAuth()
  return () => getTokenOrThrow(getToken)
}

export const studioKeys = {
  options: ['studio', 'options'] as const,
  summary: (owner?: string) => ['studio', 'summary', owner ?? null] as const,
  list: (params: StudioListParams) => ['studio', 'proposals', params] as const,
  proposal: (id: number, version?: number) => ['studio', 'proposal', id, version ?? 'current'] as const,
  events: (id: number) => ['studio', 'events', id] as const,
  diff: (id: number, a: number, b: number) => ['studio', 'diff', id, a, b] as const,
  customers: (q: string) => ['studio', 'customers', q] as const,
  customer: (id: number) => ['studio', 'customer', id] as const,
  library: (kind: string, includeRetired: boolean) => ['studio', 'library', kind, includeRetired] as const,
}

// ── Queries ─────────────────────────────────────────────────────────────────

export function useStudioOptions(enabled = true) {
  const token = useToken()
  return useQuery({
    queryKey: studioKeys.options,
    queryFn: async ({ signal }) => apiFetch<StudioOptions>(`${STUDIO}/options`, await token(), { signal }),
    staleTime: 10 * 60_000,
    enabled,
    retry: noRetryOn4xx,
  })
}

export function useStudioSummary(ownerId?: string) {
  const token = useToken()
  return useQuery({
    queryKey: studioKeys.summary(ownerId),
    queryFn: async ({ signal }) => apiFetch<StudioSummary>(`${STUDIO}/summary${buildQS({ owner_id: ownerId })}`, await token(), { signal }),
    retry: noRetryOn4xx,
  })
}

export function useStudioProposals(params: StudioListParams, options: { enabled?: boolean } = {}) {
  const token = useToken()
  return useQuery({
    queryKey: studioKeys.list(params),
    queryFn: async ({ signal }) =>
      apiFetch<StudioListResponse>(`${P}${buildQS(params as Record<string, string | number | undefined>)}`, await token(), { signal }),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    retry: noRetryOn4xx,
  })
}

/** Studio proposals waiting for an approver — the menu badge and the "Awaiting approval" lists. */
export function useStudioPendingApprovals(options: { enabled?: boolean; pageSize?: number } = {}) {
  return useStudioProposals({ status: 'pending_approval', page_size: options.pageSize ?? 25 }, { enabled: options.enabled })
}

export function useStudioProposal(id: number, version?: number) {
  const token = useToken()
  return useQuery({
    queryKey: studioKeys.proposal(id, version),
    queryFn: async ({ signal }) => apiFetch<StudioView>(`${P}/${id}${buildQS({ version })}`, await token(), { signal }),
    enabled: Number.isFinite(id),
    // An editor: never refetch underneath someone's typing.
    refetchOnWindowFocus: false,
    retry: noRetryOn4xx,
  })
}

export function useStudioEvents(id: number) {
  const token = useToken()
  return useQuery({
    queryKey: studioKeys.events(id),
    queryFn: async ({ signal }) => apiFetch<{ items: StudioEvent[] }>(`${P}/${id}/events`, await token(), { signal }),
    enabled: Number.isFinite(id),
    retry: noRetryOn4xx,
  })
}

export function useVersionDiff(id: number, a: number | null, b: number | null) {
  const token = useToken()
  return useQuery({
    queryKey: studioKeys.diff(id, a ?? 0, b ?? 0),
    queryFn: async ({ signal }) => apiFetch<VersionDiff>(`${P}/${id}/versions/${a}/diff/${b}`, await token(), { signal }),
    enabled: a != null && b != null && a !== b,
    retry: noRetryOn4xx,
  })
}

export function useStudioCustomers(q: string, options: { enabled?: boolean; limit?: number } = {}) {
  const token = useToken()
  return useQuery({
    queryKey: studioKeys.customers(q),
    queryFn: async ({ signal }) =>
      apiFetch<{ items: StudioCustomer[] }>(`${STUDIO}/customers${buildQS({ q: q || undefined, limit: options.limit ?? 20 })}`, await token(), { signal }),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    retry: noRetryOn4xx,
  })
}

export function useStudioCustomer(id: number | null) {
  const token = useToken()
  return useQuery({
    queryKey: studioKeys.customer(id ?? 0),
    queryFn: async ({ signal }) => apiFetch<CustomerResponse>(`${STUDIO}/customers/${id}`, await token(), { signal }),
    enabled: id != null && Number.isFinite(id),
    retry: noRetryOn4xx,
  })
}

export function useLibrary(kind: LibraryKind | '' = '', includeRetired = false, projectType?: string) {
  const token = useToken()
  return useQuery({
    queryKey: [...studioKeys.library(kind, includeRetired), projectType ?? null],
    queryFn: async ({ signal }) =>
      apiFetch<{ items: LibraryItem[] }>(
        `${STUDIO}/library${buildQS({ kind: kind || undefined, include_retired: includeRetired || undefined, project_type: projectType })}`,
        await token(),
        { signal },
      ),
    retry: noRetryOn4xx,
  })
}

/**
 * The equipment catalogue's brands (GET /api/v1/equipment/, any staff) — the make picker's
 * list. The server also accepts the price list's makes, which no route exposes (a contract
 * gap); the picker adds the makes the document's own rows already carry.
 */
export function useCatalogueBrands() {
  const token = useToken()
  return useQuery({
    queryKey: ['studio', 'catalogue-brands'],
    queryFn: async ({ signal }) => {
      const res = await apiFetch<{ items: { brand: string; is_active: boolean; is_placeholder?: boolean }[] }>(
        `/api/v1/equipment/${buildQS({ is_active: true })}`,
        await token(),
        { signal },
      )
      const brands = new Set<string>()
      for (const e of res?.items ?? []) if (e.is_active && !e.is_placeholder && e.brand?.trim()) brands.add(e.brand.trim())
      return [...brands].sort((a, b) => a.localeCompare(b))
    },
    staleTime: 10 * 60_000,
    retry: noRetryOn4xx,
  })
}

// ── Plain calls (the wizard's autosave queue and one-off actions) ───────────

type Token = () => Promise<string>

export const studioApi = {
  createCustomer: async (token: Token, body: CustomerInput) =>
    apiFetch<CustomerResponse>(`${STUDIO}/customers`, await token(), { method: 'POST', body: JSON.stringify(body) }),
  getCustomer: async (token: Token, id: number) => apiFetch<CustomerResponse>(`${STUDIO}/customers/${id}`, await token()),
  updateCustomer: async (token: Token, id: number, body: Partial<CustomerInput>) =>
    apiFetch<CustomerResponse>(`${STUDIO}/customers/${id}`, await token(), { method: 'PATCH', body: JSON.stringify(body) }),
  createProposal: async (token: Token, body: { customer_id: number; project_type: string; template_id?: number | null }) =>
    apiFetch<StudioView>(P, await token(), { method: 'POST', body: JSON.stringify(body) }),
  editSection: async (token: Token, id: number, body: { base_revision: number; section: string; value: unknown }, signal?: AbortSignal) =>
    apiFetch<SectionEditResponse>(`${P}/${id}/document`, await token(), { method: 'PATCH', body: JSON.stringify(body), signal }),
  acknowledge: async (token: Token, id: number, fingerprints: string[]) =>
    apiFetch<StudioView>(`${P}/${id}/acknowledge-warnings`, await token(), { method: 'POST', body: JSON.stringify({ fingerprints }) }),
  ignoreWord: async (token: Token, id: number, word: string) =>
    apiFetch<StudioView>(`${P}/${id}/spelling/ignore`, await token(), { method: 'POST', body: JSON.stringify({ word }) }),
  submit: async (token: Token, id: number) =>
    apiFetch<StudioView & { result: 'pending_approval' | 'ready' }>(`${P}/${id}/submit`, await token(), { method: 'POST' }),
  approve: async (token: Token, id: number, comment: string | null) =>
    apiFetch<StudioView>(`${P}/${id}/approve`, await token(), { method: 'POST', body: JSON.stringify({ comment: comment || null }) }),
  reject: async (token: Token, id: number, comment: string) =>
    apiFetch<StudioView>(`${P}/${id}/reject`, await token(), { method: 'POST', body: JSON.stringify({ comment }) }),
  issue: async (token: Token, id: number) =>
    apiFetch<StudioView & { public_url: string }>(`${P}/${id}/issue`, await token(), { method: 'POST' }),
  /** BE-19: `subject` replaces the configured one; `message` is staff's own text above the fixed lines. */
  email: async (token: Token, id: number, body: { to?: string | null; subject?: string | null; message?: string | null }) =>
    apiFetch<{ sent: boolean; to: string }>(`${P}/${id}/email`, await token(), {
      method: 'POST',
      body: JSON.stringify({ to: body.to || null, subject: body.subject || null, message: body.message || null }),
    }),
  whatsappLink: async (token: Token, id: number) =>
    apiFetch<{ url: string; text: string; link: string }>(`${P}/${id}/whatsapp-link`, await token(), { method: 'POST' }),
  revise: async (token: Token, id: number) => apiFetch<StudioView>(`${P}/${id}/revise`, await token(), { method: 'POST' }),
  duplicate: async (token: Token, id: number, body: { version?: number; customer_id?: number }) =>
    apiFetch<StudioView>(`${P}/${id}/duplicate`, await token(), { method: 'POST', body: JSON.stringify(body) }),
  markAccepted: async (token: Token, id: number, acceptedOn: string, signedCopy: File) => {
    const form = new FormData()
    form.append('accepted_on', acceptedOn)
    form.append('signed_copy', signedCopy)
    return apiFetchForm<StudioView & { convert_offered: boolean }>(`${P}/${id}/mark-accepted`, await token(), form)
  },
  markLost: async (token: Token, id: number, reason: string) =>
    apiFetch<StudioView>(`${P}/${id}/mark-lost`, await token(), { method: 'POST', body: JSON.stringify({ reason }) }),
  convert: async (token: Token, id: number) =>
    apiFetch<{ lead_id: number; proposal_id: number; created: boolean }>(`${P}/${id}/convert`, await token(), { method: 'POST' }),
  saveAsTemplate: async (token: Token, id: number, name: string) =>
    apiFetch<LibraryItem>(`${P}/${id}/save-as-template`, await token(), { method: 'POST', body: JSON.stringify({ name }) }),
  suggest: async (token: Token, id: number, text: string) =>
    apiFetch<AssistantResponse>(`${P}/${id}/suggest-from-notes`, await token(), { method: 'POST', body: JSON.stringify({ text }) }),
  createLibraryItem: async (token: Token, body: { kind: LibraryKind; name: string; project_type?: string | null; body: Record<string, unknown> }) =>
    apiFetch<LibraryItem>(`${STUDIO}/library`, await token(), { method: 'POST', body: JSON.stringify(body) }),
  updateLibraryItem: async (token: Token, id: number, body: { name?: string; body?: Record<string, unknown>; active?: boolean }) =>
    apiFetch<LibraryItem>(`${STUDIO}/library/${id}`, await token(), { method: 'PATCH', body: JSON.stringify(body) }),
  importSheet: async (token: Token, file: File, onProgress?: (p: number) => void) => {
    const form = new FormData()
    form.append('file', file)
    return apiFetchForm<{ created: ImportCreated[] }>(`${STUDIO}/import`, await token(), form, onProgress)
  },
  previewPdf: async (token: Token, id: number, version?: number, signal?: AbortSignal) =>
    apiFetchBlob(`${P}/${id}/preview.pdf${buildQS({ version })}`, await token(), { signal }),
  /** BE-19: the issued file as a short-lived signed link in JSON (no bucket CORS needed). */
  pdfLink: async (token: Token, id: number, version?: number) =>
    apiFetch<{ url: string; expires_at: string; filename: string }>(`${P}/${id}/pdf-link${buildQS({ version })}`, await token()),
  /** BE-19: puts a section back to its generated default. */
  resetSection: async (token: Token, id: number, section: string, baseRevision: number) =>
    apiFetch<SectionEditResponse>(`${P}/${id}/sections/${encodeURIComponent(section)}/reset`, await token(), {
      method: 'POST',
      body: JSON.stringify({ base_revision: baseRevision }),
    }),
  downloadImportTemplate: async (token: Token) =>
    apiDownload(`${STUDIO}/import-template.xlsx`, await token(), 'GridNova_Proposal_Studio_Import.xlsx'),
}

/** A token getter for `studioApi` calls from components. */
export function useStudioToken(): Token {
  const { getToken } = useAuth()
  return () => getTokenOrThrow(getToken)
}

/**
 * Runs one Studio action and puts the returned View into the cache, so the page shows the
 * server's answer straight away; lists, the summary and the timeline are refreshed.
 */
export function useStudioAction<A extends unknown[], R>(proposalId: number, fn: (token: Token, ...args: A) => Promise<R>) {
  const token = useStudioToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: A) => fn(token, ...args),
    onSuccess: (data) => {
      if (data && typeof data === 'object' && 'proposal' in data && 'version' in data) {
        const view = data as unknown as StudioView
        if (view.proposal.id === proposalId) qc.setQueryData(studioKeys.proposal(proposalId), view)
      }
      void qc.invalidateQueries({ queryKey: ['studio', 'proposals'] })
      void qc.invalidateQueries({ queryKey: ['studio', 'summary'] })
      void qc.invalidateQueries({ queryKey: studioKeys.events(proposalId) })
    },
  })
}
