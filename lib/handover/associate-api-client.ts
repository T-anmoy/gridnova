import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { apiFetch, apiFetchForm, notAuthenticatedError } from '@/lib/api/http'
import { ApiShapeError } from '@/lib/dashboard/api-error'
import { formatZodError } from '@/lib/dashboard/schemas'
import { packSchema, projectRequestsSchema, serviceRequestSchema, signedFileSchema, type Pack, type ProjectRequests, type ServiceRequest, type SignedFile } from './schemas'
import { buildServiceRequestForm, type ServiceRequestInput } from './service-request-form'

// Associate-audience handover and service-request endpoints (BE-5, /api/v1/associate/onboardings/{id}).
// The owner and a territory Preferred Associate read; only the owner raises a request.
const base = (id: number) => `/api/v1/associate/onboardings/${id}`

function useToken() {
  const { getToken } = useAuth()
  return async () => {
    const token = await getToken()
    if (!token) throw notAuthenticatedError()
    return token
  }
}

function checked<T>(schema: z.ZodType<T>, data: unknown, path: string): T {
  const r = schema.safeParse(data)
  if (!r.success) throw new ApiShapeError(path, formatZodError(r.error))
  return r.data
}

export function useMyHandoverPack(onboardingId: number) {
  const token = useToken()
  return useQuery({
    queryKey: ['my-handover-pack', onboardingId],
    queryFn: async ({ signal }) => apiFetch<Pack>(`${base(onboardingId)}/handover`, await token(), { signal }, packSchema),
    enabled: !!onboardingId,
    staleTime: 30_000,
  })
}

export function useMyServiceRequests(onboardingId: number) {
  const token = useToken()
  return useQuery({
    queryKey: ['my-service-requests', onboardingId],
    queryFn: async ({ signal }) =>
      apiFetch<ProjectRequests>(`${base(onboardingId)}/service-requests`, await token(), { signal }, projectRequestsSchema),
    enabled: !!onboardingId,
    staleTime: 15_000,
  })
}

export function useRaiseMyServiceRequest(onboardingId: number) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ServiceRequestInput) => {
      const path = `${base(onboardingId)}/service-requests`
      return checked(serviceRequestSchema, await apiFetchForm<unknown>(path, await token(), buildServiceRequestForm(input)), path) as ServiceRequest
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-service-requests', onboardingId] })
      void qc.invalidateQueries({ queryKey: ['home'] })
    },
  })
}

// Signed links are fetched on click and never cached. 404 until the PDF has been rendered.
export async function fetchMyHandoverPdfLink(onboardingId: number, token: string): Promise<SignedFile> {
  return apiFetch<SignedFile>(`${base(onboardingId)}/handover/pdf`, token, undefined, signedFileSchema)
}
