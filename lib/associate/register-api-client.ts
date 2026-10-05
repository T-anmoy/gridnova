import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import type { CatalogueItem } from '@/components/execution/CataloguePicker'
import type { Register, RegisterUnit, RegisterWarning, SerialCheck, UnitCategory, UnitInput } from './register-types'

// Associate-audience serial-register endpoints. The owner writes (before the
// register is verified); a territory Preferred Associate only reads. Nothing here
// touches the staff routes or the staff equipment master.
const BASE = '/api/v1/associate'
const unitsPath = (onboardingId: number) => `${BASE}/onboardings/${onboardingId}/execution/units`

export interface AssociateUnitsResult {
  warnings: RegisterWarning[]
  register: Register
}

function useAssociateMutation<TInput, TOut>(onboardingId: number, run: (token: string, input: TInput) => Promise<TOut>) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TInput) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return run(token, input)
    },
    // The register rides along on the execution status, so refetch that.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['execution', onboardingId] })
      void qc.invalidateQueries({ queryKey: ['onboarding-progress', onboardingId] })
    },
  })
}

const post = (b: unknown) => ({ method: 'POST', body: JSON.stringify(b) })

export const useAssociateCreateUnit = (id: number) =>
  useAssociateMutation<UnitInput, AssociateUnitsResult & { unit: RegisterUnit }>(id, (t, unit) => dashboardFetch(unitsPath(id), t, post(unit)))

export const useAssociateBulkCreateUnits = (id: number) =>
  useAssociateMutation<{ units: UnitInput[] }, AssociateUnitsResult & { units: RegisterUnit[] }>(id, (t, input) =>
    dashboardFetch(`${unitsPath(id)}/bulk`, t, post(input))
  )

export const useAssociateUpdateUnit = (id: number) =>
  useAssociateMutation<{ unitId: number; patch: Partial<Omit<UnitInput, 'equipment_id'>> & { equipment_id?: number | null } }, AssociateUnitsResult & { unit: RegisterUnit }>(
    id,
    (t, { unitId, patch }) => dashboardFetch(`${unitsPath(id)}/${unitId}`, t, { method: 'PATCH', body: JSON.stringify(patch) })
  )

export const useAssociateVoidUnit = (id: number) =>
  useAssociateMutation<{ unitId: number; reason: string }, { unit: RegisterUnit; register: Register }>(id, (t, { unitId, reason }) =>
    dashboardFetch(`${unitsPath(id)}/${unitId}/void`, t, post({ reason }))
  )

// The duplicate check always goes to the backend — no client-side duplicate logic.
export async function checkAssociateSerial(onboardingId: number, serial: string, token: string): Promise<SerialCheck> {
  return dashboardFetch(`${unitsPath(onboardingId)}/check-serial?serial=${encodeURIComponent(serial)}`, token)
}

// ── Associate catalogue (GET /api/v1/associate/equipment) ─────────────────
// Price-free, active models only. 60 requests a minute per associate, so the
// search term is debounced by the caller and answers are cached per (category, q).

export interface AssociateCatalogueState {
  items: CatalogueItem[] | undefined
  isLoading: boolean
  error?: unknown
  rateLimited: boolean
  refetch: () => void
}

export function useAssociateCatalogue(category: Exclude<UnitCategory, 'other'>, q: string): AssociateCatalogueState {
  const { getToken } = useAuth()
  const term = q.trim()
  const query = useQuery({
    queryKey: ['associate-catalogue', category, term],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const params = new URLSearchParams({ category })
      if (term) params.set('q', term)
      return dashboardFetch<{ items: CatalogueItem[] }>(`${BASE}/equipment?${params.toString()}`, token).then((r) => r.items)
    },
    staleTime: 60_000,
    // A 429 is shown to the person with a Retry button; retrying on our own would only spend more of the limit.
    retry: false,
  })
  return {
    items: query.data,
    isLoading: query.isLoading,
    error: query.error,
    rateLimited: query.error instanceof ApiError && query.error.status === 429,
    refetch: () => void query.refetch(),
  }
}
