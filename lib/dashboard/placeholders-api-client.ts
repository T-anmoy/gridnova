import { notAuthenticatedError } from '@/lib/api/http'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'

// Data checklist (placeholder registry). Read: admin, management. Resolve: admin,
// manual entries only (probe === 'manual'). Approve / revoke: admin, wording entries only
// (probe === 'approved_text', BE-22 — docs/api/launch_content.md §2).
export type Blocking = 'blocks_launch' | 'blocks_feature' | 'tunable'

export type ApprovalState = 'approved' | 'not_approved' | 'lapsed'

export interface WordingApproval {
  by: string
  at: string
  note: string | null
  legal_review_confirmed: boolean
  content_sha256: string
}

export interface PlaceholderItem {
  id: string
  area: string
  location: string
  description: string
  dummy_value: string
  needed_from_grid_nova: string
  blocking: Blocking
  probe: string | null
  resolved: boolean
  probe_error: string | null
  resolution: { resolved_by: string; resolved_at: string; note: string } | null
  // BE-22: null (or absent) on every entry that is not wording.
  legal_review_required?: boolean | null
  current_text?: string | null
  current_sha256?: string | null
  approval?: WordingApproval | null
  approval_state?: ApprovalState | null
}

export interface PlaceholdersResponse {
  summary: { total: number; unresolved: number; by_blocking: Record<string, { total: number; unresolved: number }> }
  areas: { area: string; items: PlaceholderItem[] }[]
}

export function usePlaceholders() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['placeholders'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<PlaceholdersResponse>('/api/v1/dashboard/placeholders', token)
    },
    staleTime: 60_000,
  })
}

export function useResolvePlaceholder() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<PlaceholderItem>(`/api/v1/dashboard/placeholders/${encodeURIComponent(id)}/resolve`, token, { method: 'POST', body: JSON.stringify({ note }) })
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['placeholders'] }),
  })
}

export interface ApproveWordingInput {
  id: string
  /** The current_sha256 of the text the Admin read — a changed text answers 409 text_changed. */
  content_sha256: string
  note?: string
  legal_review_confirmed: boolean
}

export function useApproveWording() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: ApproveWordingInput) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<PlaceholderItem>(`/api/v1/dashboard/placeholders/${encodeURIComponent(id)}/approve`, token, { method: 'POST', body: JSON.stringify(body) })
    },
    // Settled, not success: a 409 text_changed means the list is stale too.
    onSettled: () => void qc.invalidateQueries({ queryKey: ['placeholders'] }),
  })
}

export function useRevokeWording() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<PlaceholderItem>(`/api/v1/dashboard/placeholders/${encodeURIComponent(id)}/revoke`, token, { method: 'POST', body: JSON.stringify({ note }) })
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['placeholders'] }),
  })
}
