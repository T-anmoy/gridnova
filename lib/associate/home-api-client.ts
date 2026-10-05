import { useAuth } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'

// GET /api/v1/associate/home — the caller's OWN customers only (including for
// Preferred Associates). Items carry message keys + params, never English text.
export interface HomeItem {
  kind: string
  message_key: string
  onboarding_id: number
  customer_name: string
  priority: 1 | 2 | 3
  params: Record<string, unknown>
}

export interface HomeResponse {
  items: HomeItem[]
  totals: { customers: number; awaiting_grid_nova: number; needing_action: number }
}

export function useAssociateHome() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['home'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<HomeResponse>('/api/v1/associate/home', token)
    },
    staleTime: 30_000,
  })
}
