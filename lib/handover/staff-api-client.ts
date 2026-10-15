import { useAuth } from '@clerk/nextjs'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { apiFetch, apiFetchForm, buildQS, notAuthenticatedError } from '@/lib/api/http'
import { ApiShapeError } from '@/lib/dashboard/api-error'
import { formatZodError } from '@/lib/dashboard/schemas'
import {
  issuedLinkSchema,
  packSchema,
  projectRequestsSchema,
  serviceQueueSchema,
  serviceRequestSchema,
  signedFileSchema,
  type IssuedLink,
  type Pack,
  type ProjectRequests,
  type ServiceQueue,
  type ServiceRequest,
  type SignedFile,
} from './schemas'
import { buildServiceRequestForm, type ServiceRequestInput } from './service-request-form'

// Staff-audience handover, warranty and service-request endpoints (BE-5, /api/v1/dashboard).
const BASE = '/api/v1/dashboard'
const pack = (id: number) => `${BASE}/onboardings/${id}/handover`

function useToken() {
  const { getToken } = useAuth()
  return async () => {
    const token = await getToken()
    if (!token) throw notAuthenticatedError()
    return token
  }
}

const postInit = (body?: unknown): RequestInit => ({ method: 'POST', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })

/** Multipart responses are not schema-checked by the transport, so check them here. */
function checked<T>(schema: z.ZodType<T>, data: unknown, path: string): T {
  const r = schema.safeParse(data)
  if (!r.success) throw new ApiShapeError(path, formatZodError(r.error))
  return r.data
}

// ── The pack ───────────────────────────────────────────────────────────────

export function useHandoverPack(onboardingId: number, enabled = true) {
  const token = useToken()
  return useQuery({
    queryKey: ['handover-pack', onboardingId],
    queryFn: async ({ signal }) => apiFetch<Pack>(pack(onboardingId), await token(), { signal }, packSchema),
    enabled: enabled && !!onboardingId,
    staleTime: 15_000,
  })
}

/** Every pack mutation answers with the refreshed pack, which replaces the cached one. */
function usePackMutation<TInput>(onboardingId: number, run: (token: string, input: TInput) => Promise<Pack>) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TInput) => run(await token(), input),
    onSuccess: (next) => {
      qc.setQueryData(['handover-pack', onboardingId], next)
      void qc.invalidateQueries({ queryKey: ['work-queues'] })
    },
  })
}

export const useTickOrientation = (id: number) =>
  usePackMutation<{ done: boolean; note?: string }>(id, (t, b) => apiFetch<Pack>(`${pack(id)}/orientation`, t, postInit(b), packSchema))
export const useTickOmContact = (id: number) =>
  usePackMutation<{ done: boolean; note?: string }>(id, (t, b) => apiFetch<Pack>(`${pack(id)}/om-contact`, t, postInit(b), packSchema))
export const useRevokeLink = (id: number) => usePackMutation<void>(id, (t) => apiFetch<Pack>(`${pack(id)}/link/revoke`, t, postInit(), packSchema))
export const useRegeneratePdf = (id: number) => usePackMutation<void>(id, (t) => apiFetch<Pack>(`${pack(id)}/pdf/regenerate`, t, postInit(), packSchema))

export interface AcknowledgeInput {
  method: 'signature' | 'in_person'
  customer_name: string
  note?: string
  file?: Blob
}
export const useAcknowledge = (id: number) =>
  usePackMutation<AcknowledgeInput>(id, async (t, b) => {
    const form = new FormData()
    form.set('method', b.method)
    form.set('customer_name', b.customer_name.trim())
    if (b.note?.trim()) form.set('note', b.note.trim())
    if (b.file) form.set('file', b.file, 'signature.png')
    return checked(packSchema, await apiFetchForm<unknown>(`${pack(id)}/acknowledgement`, t, form), `${pack(id)}/acknowledgement`)
  })

/** Issues a NEW link (the old one stops). The URL is in the answer once and cannot be read back later. */
export function useIssueLink(onboardingId: number) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sendEmail: boolean) =>
      apiFetch<IssuedLink>(`${pack(onboardingId)}/link`, await token(), postInit({ send_email: sendEmail }), issuedLinkSchema),
    onSuccess: (r) => qc.setQueryData(['handover-pack', onboardingId], r.pack),
  })
}

// Signed links are fetched on click and never cached.
export async function fetchPackPdfLink(onboardingId: number, token: string): Promise<SignedFile> {
  return apiFetch<SignedFile>(`${pack(onboardingId)}/pdf`, token, undefined, signedFileSchema)
}

// ── Service requests ───────────────────────────────────────────────────────

export interface ServiceQueueParams {
  status?: string
  open?: boolean
  overdue?: boolean
  within_warranty?: boolean
  category?: string
  assignee?: string
  onboarding_id?: number
  page?: number
  page_size?: number
}

export function useServiceQueue(params: ServiceQueueParams) {
  const token = useToken()
  return useQuery({
    queryKey: ['service-requests', params],
    queryFn: async ({ signal }) => apiFetch<ServiceQueue>(`${BASE}/service-requests${buildQS({ ...params })}`, await token(), { signal }, serviceQueueSchema),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  })
}

export function useProjectServiceRequests(onboardingId: number, enabled = true) {
  const token = useToken()
  return useQuery({
    queryKey: ['project-service-requests', onboardingId],
    queryFn: async ({ signal }) =>
      apiFetch<ProjectRequests>(`${BASE}/onboardings/${onboardingId}/service-requests`, await token(), { signal }, projectRequestsSchema),
    enabled: enabled && !!onboardingId,
    staleTime: 15_000,
  })
}

export function useServiceRequest(requestId: number) {
  const token = useToken()
  return useQuery({
    queryKey: ['service-request', requestId],
    queryFn: async ({ signal }) => apiFetch<ServiceRequest>(`${BASE}/service-requests/${requestId}`, await token(), { signal }, serviceRequestSchema),
    enabled: !!requestId,
  })
}

function useInvalidateRequests() {
  const qc = useQueryClient()
  return () => {
    for (const key of ['service-requests', 'service-request', 'project-service-requests', 'work-queues']) void qc.invalidateQueries({ queryKey: [key] })
  }
}

export function useRaiseServiceRequest(onboardingId: number) {
  const token = useToken()
  const done = useInvalidateRequests()
  return useMutation({
    mutationFn: async (input: ServiceRequestInput) => {
      const path = `${BASE}/onboardings/${onboardingId}/service-requests`
      return checked(serviceRequestSchema, await apiFetchForm<unknown>(path, await token(), buildServiceRequestForm(input)), path)
    },
    onSuccess: done,
  })
}

function useRequestAction<TInput extends { requestId: number }>(action: string, body: (i: TInput) => unknown) {
  const token = useToken()
  const done = useInvalidateRequests()
  return useMutation({
    mutationFn: async (input: TInput) =>
      apiFetch<ServiceRequest>(`${BASE}/service-requests/${input.requestId}/${action}`, await token(), postInit(body(input)), serviceRequestSchema),
    onSuccess: done,
  })
}

export const useAssignRequest = () => useRequestAction<{ requestId: number; assigneeId: string | null }>('assign', (i) => ({ assignee_id: i.assigneeId }))
export const useSetRequestStatus = () =>
  useRequestAction<{ requestId: number; status: 'in_progress' | 'resolved' | 'rejected'; note?: string }>('status', (i) => ({ status: i.status, ...(i.note ? { note: i.note } : {}) }))
export const useAddRequestNote = () => useRequestAction<{ requestId: number; note: string }>('notes', (i) => ({ note: i.note }))

// Signed links are fetched on click and never cached.
export async function fetchRequestPhotoLink(requestId: number, fileRef: string, token: string): Promise<SignedFile> {
  return apiFetch<SignedFile>(`${BASE}/service-requests/${requestId}/photos/${fileRef}`, token, undefined, signedFileSchema)
}
