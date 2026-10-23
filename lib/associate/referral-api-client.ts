import { buildQS, notAuthenticatedError } from '@/lib/api/http'
import { useAuth } from '@clerk/nextjs'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'

// BE-10 referral links (docs/api/associate_ease.md §1). Both portals use the
// same /associate routes — there is no separate Preferred route.

export const REFERRAL_LINK_PATH = '/api/v1/associate/referral-link'
export const REFERRALS_PATH = '/api/v1/associate/referrals'

export interface ReferralLink {
  associate_id: string
  /** Relative to the public website, e.g. "/estimate?ref=GNA-WB-26-00001". */
  share_path: string
}

export type ReferralKind = 'estimate' | 'call_booked' | 'other'
export type ReferralStatus = 'received' | 'in_progress' | 'proposal_sent' | 'won' | 'closed'

export interface ReferralItem {
  lead_id: number
  created_at: string
  customer_name: string | null
  /** City and state as the customer typed them; there is no district. */
  location: string | null
  pin_code: string | null
  enquiry_kind: ReferralKind
  status: ReferralStatus
  share_with_referrer: boolean
  /** Present only with the customer's consent — the key is absent otherwise. */
  customer_mobile?: string
}

export interface ReferralList {
  items: ReferralItem[]
  page: number
  page_size: number
  total: number
}

export function useReferralLink() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['associate-referral-link'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<ReferralLink>(REFERRAL_LINK_PATH, token)
    },
    staleTime: 10 * 60_000,
  })
}

export function useReferrals(page: number, pageSize = 25) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['associate-referrals', page, pageSize],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<ReferralList>(`${REFERRALS_PATH}${buildQS({ page, page_size: pageSize })}`, token)
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
