import { notAuthenticatedError } from '@/lib/api/http'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'

// Data checklist (placeholder registry). Read: admin, management. Resolve: admin,
// manual entries only (probe === 'manual').
export type Blocking = 'blocks_launch' | 'blocks_feature' | 'tunable'

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
