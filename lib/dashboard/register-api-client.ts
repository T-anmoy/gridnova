import { useAuth } from '@clerk/nextjs'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch, useEquipment } from '@/lib/dashboard/api-client'
import type { EquipmentCategory } from '@/lib/dashboard/types'
import type { CatalogueSource } from '@/components/execution/CataloguePicker'
import type { Register, RegisterUnit, RegisterWarning, SerialCheck, UnitInput } from '@/lib/associate/register-types'
import type { StaffExecutionDetail } from './execution-types'

// Staff serial-register endpoints under /api/v1/dashboard/onboardings/{id}/execution.
// Read: anyone who can see execution (including engineers) — the register rides
// along on the execution detail. Write: Operations and Admin.
const unitsPath = (id: number) => `/api/v1/dashboard/onboardings/${id}/execution`

export interface UnitsResult {
  warnings: RegisterWarning[]
  register: Register
}

function useRegisterMutation<TInput, TOut>(onboardingId: number, run: (token: string, input: TInput) => Promise<TOut>, refreshOnError = false) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TInput) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return run(token, input)
    },
    onSuccess: () => {
      // The register is part of the execution detail, so refetch that.
      void qc.invalidateQueries({ queryKey: ['staff-execution', onboardingId] })
      void qc.invalidateQueries({ queryKey: ['staff-execution-queue'] })
      void qc.invalidateQueries({ queryKey: ['work-queues'] })
    },
    // A refused match (e.g. already matched by someone else) means the register on screen is stale.
    onError: () => {
      if (refreshOnError) void qc.invalidateQueries({ queryKey: ['staff-execution', onboardingId] })
    },
  })
}

const body = (b: unknown) => ({ method: 'POST', body: JSON.stringify(b) })

export const useCreateUnit = (id: number) =>
  useRegisterMutation<UnitInput, UnitsResult & { unit: RegisterUnit }>(id, (t, unit) => dashboardFetch(`${unitsPath(id)}/units`, t, body(unit)))

export const useBulkCreateUnits = (id: number) =>
  useRegisterMutation<{ units: UnitInput[]; reason?: string }, UnitsResult & { units: RegisterUnit[] }>(id, (t, input) =>
    dashboardFetch(`${unitsPath(id)}/units/bulk`, t, body(input))
  )

export const useUpdateUnit = (id: number) =>
  useRegisterMutation<{ unitId: number; patch: Partial<UnitInput> & { reason?: string } }, UnitsResult & { unit: RegisterUnit }>(id, (t, { unitId, patch }) =>
    dashboardFetch(`${unitsPath(id)}/units/${unitId}`, t, { method: 'PATCH', body: JSON.stringify(patch) })
  )

// Staff match: link an unmatched unit to a catalogue item. `reason` only once the register is verified (admin only).
export const useMatchUnit = (id: number) =>
  useRegisterMutation<{ unitId: number; equipmentId: number; reason?: string }, { unit: RegisterUnit; register: Register }>(id, (t, { unitId, equipmentId, reason }) =>
    dashboardFetch(`${unitsPath(id)}/units/${unitId}/match`, t, body({ equipment_id: equipmentId, ...(reason ? { reason } : {}) })),
    true
  )

export const useVoidUnit = (id: number) =>
  useRegisterMutation<{ unitId: number; reason: string }, { unit: RegisterUnit; register: Register }>(id, (t, { unitId, reason }) =>
    dashboardFetch(`${unitsPath(id)}/units/${unitId}/void`, t, body({ reason }))
  )

// Locks the register; returns the refreshed execution detail.
export const useVerifyRegister = (id: number) =>
  useRegisterMutation<void, StaffExecutionDetail>(id, (t) => dashboardFetch(`${unitsPath(id)}/register/verify`, t, { method: 'POST' }))

// The duplicate check always goes to the backend — there is no client-side duplicate logic.
export async function checkSerial(onboardingId: number, serial: string, token: string): Promise<SerialCheck> {
  return dashboardFetch(`${unitsPath(onboardingId)}/units/check-serial?serial=${encodeURIComponent(serial)}`, token)
}

// ── Staff catalogue (GET /api/v1/equipment/, any employee) ────────────────

/** The one CatalogueSource implementation for now: the staff equipment master. */
export function useStaffCatalogue(category: EquipmentCategory): CatalogueSource {
  const q = useEquipment({ category, is_active: true })
  return { items: q.data, isLoading: q.isLoading, error: q.error, refetch: () => void q.refetch() }
}
