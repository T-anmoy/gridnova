import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'
import { buildUploadForm, dashboardFetchForm } from '@/lib/associate/onboarding-api-client'
import type { FileLinkResponse, UploadFileInput } from '@/lib/associate/onboarding-types'
import type {
  ExecutionQueueParams,
  PaginatedExecutionQueue,
  RecordStageInput,
  StaffExecutionDetail,
  WorkQueues,
} from './execution-types'

const BASE = '/api/v1/dashboard'
const detailPath = (id: number) => `${BASE}/onboardings/${id}/execution`

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

// ── Work queue badges (any staff role; each role sees only its own areas) ──

export function useWorkQueues() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['work-queues'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<WorkQueues>(`${BASE}/work-queues`, token)
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

// ── Operations queue + detail ─────────────────────────────────────────────

export function useExecutionQueue(params: ExecutionQueueParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['staff-execution-queue', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<PaginatedExecutionQueue>(`${BASE}/execution${qs(params as Record<string, string | number | boolean | undefined>)}`, token)
    },
    staleTime: 30_000,
  })
}

export function useStaffExecution(onboardingId: number, enabled = true) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['staff-execution', onboardingId],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<StaffExecutionDetail>(detailPath(onboardingId), token)
    },
    enabled: enabled && !!onboardingId,
  })
}

// Every mutation returns the refreshed detail, so it replaces the cached copy.
function useDetailMutation<TInput>(onboardingId: number, run: (token: string, input: TInput) => Promise<StaffExecutionDetail>) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TInput) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return run(token, input)
    },
    onSuccess: (detail) => {
      qc.setQueryData(['staff-execution', onboardingId], detail)
      void qc.invalidateQueries({ queryKey: ['staff-execution-queue'] })
      void qc.invalidateQueries({ queryKey: ['work-queues'] })
      void qc.invalidateQueries({ queryKey: ['staff-onboarding-progress'] })
    },
  })
}

export function useVerifySubmission(onboardingId: number) {
  return useDetailMutation<{ submissionId: number; note?: string }>(onboardingId, (token, { submissionId, note }) =>
    dashboardFetch(`${BASE}/execution/submissions/${submissionId}/verify`, token, { method: 'POST', body: JSON.stringify(note ? { note } : {}) })
  )
}

export function useRejectSubmission(onboardingId: number) {
  return useDetailMutation<{ submissionId: number; note: string }>(onboardingId, (token, { submissionId, note }) =>
    dashboardFetch(`${BASE}/execution/submissions/${submissionId}/reject`, token, { method: 'POST', body: JSON.stringify({ note }) })
  )
}

// Operations/Admin record a stage directly (Grid Nova mode); an Admin may do the
// same on an associate-mode project with admin_override_reason.
export function useRecordStage(onboardingId: number) {
  return useDetailMutation<{ stage: string } & RecordStageInput>(onboardingId, (token, { stage, ...body }) =>
    dashboardFetch(`${detailPath(onboardingId)}/${stage}`, token, { method: 'POST', body: JSON.stringify(body) })
  )
}

// Admin only. `grid_nova` is the only mode the backend accepts.
export function useSwitchExecutionMode(onboardingId: number) {
  return useDetailMutation<{ reason: string }>(onboardingId, (token, { reason }) =>
    dashboardFetch(`${detailPath(onboardingId)}/mode`, token, { method: 'POST', body: JSON.stringify({ execution_mode: 'grid_nova', reason }) })
  )
}

// Admin only: record a DCR override (unblocks subsidy_claimed).
export function useDcrOverride(onboardingId: number) {
  return useDetailMutation<{ reason: string }>(onboardingId, (token, { reason }) =>
    dashboardFetch(`${detailPath(onboardingId)}/dcr-override`, token, { method: 'POST', body: JSON.stringify({ reason }) })
  )
}

export function useUploadStaffExecutionFile(onboardingId: number) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UploadFileInput) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetchForm<StaffExecutionDetail>(`${detailPath(onboardingId)}/files`, token, buildUploadForm(input), input.onProgress)
    },
    onSuccess: (detail) => qc.setQueryData(['staff-execution', onboardingId], detail),
  })
}

// Signed links are fetched on click and never cached.
export async function fetchStaffExecutionFileLink(onboardingId: number, fileRef: string, token: string): Promise<FileLinkResponse> {
  return dashboardFetch(`${detailPath(onboardingId)}/files/${fileRef}`, token)
}
