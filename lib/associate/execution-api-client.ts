import { notAuthenticatedError } from '@/lib/api/http'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'
import { buildUploadForm, dashboardFetchForm } from './onboarding-api-client'
import type { FileLinkResponse, UploadFileInput } from './onboarding-types'
import type { ExecutionStatus, StageSubmission, SubmissionsResponse, SubmitStageInput } from './execution-types'

// Associate-audience execution endpoints. The owner reads and writes (in
// associate mode); a Preferred Associate whose territory holds the site reads.
const BASE = '/api/v1/associate/onboardings'
const executionPath = (id: number) => `${BASE}/${id}/execution`

export function useExecution(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['execution', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<ExecutionStatus>(executionPath(id), token)
    },
    enabled: !!id,
  })
}

export function useExecutionSubmissions(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['execution-submissions', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<SubmissionsResponse>(`${executionPath(id)}/submissions`, token).then((r) => r.items)
    },
    enabled: !!id,
  })
}

// The upload response is the refreshed execution status, so it replaces the
// cached copy directly — a slot only ever shows "on file" once the server says so.
export function useUploadExecutionFile(id: number) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UploadFileInput) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetchForm<ExecutionStatus>(`${executionPath(id)}/files`, token, buildUploadForm(input), input.onProgress)
    },
    onSuccess: (status) => {
      qc.setQueryData(['execution', id], status)
    },
  })
}

export function useSubmitExecutionStage(id: number) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SubmitStageInput) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<StageSubmission>(`${executionPath(id)}/submissions`, token, { method: 'POST', body: JSON.stringify(input) })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['execution', id] })
      void qc.invalidateQueries({ queryKey: ['execution-submissions', id] })
      void qc.invalidateQueries({ queryKey: ['onboarding-progress', id] })
    },
  })
}

// Signed links are fetched on click and never cached.
export async function fetchExecutionFileLink(id: number, fileRef: string, token: string): Promise<FileLinkResponse> {
  return dashboardFetch(`${executionPath(id)}/files/${fileRef}`, token)
}
