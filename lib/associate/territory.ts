import { useTerritoryBlocks, useTerritoryDistricts, useTerritoryStates } from './api-client'
import { ApiError } from '@/lib/dashboard/api-error'

// LGD codes as the form strings the selects hold ('' = nothing chosen yet).
export interface TerritoryValue {
  state: string
  district: string
  block: string
}

export type TerritoryDepth = 'state' | 'district' | 'block'

const toCode = (v: string) => (v ? Number(v) : undefined)

export function useTerritoryCascade(value: TerritoryValue, depth: TerritoryDepth = 'block') {
  const states = useTerritoryStates()
  const districts = useTerritoryDistricts(depth === 'state' ? undefined : toCode(value.state))
  const selectedDistrict = districts.data?.find((d) => String(d.lgd_code) === value.district)
  const blocks = useTerritoryBlocks(depth === 'block' && selectedDistrict?.has_blocks ? toCode(value.district) : undefined)
  return { states, districts, blocks, selectedDistrict }
}

/** The backend answers 503 `territories_not_seeded` until territory data is loaded. */
export function isNotSeededError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503 && error.structuredDetail?.code === 'territories_not_seeded'
}

/** A small status hint for a failed lookup — development builds only. */
export function lookupDebugHint(error: unknown): string | null {
  if (process.env.NODE_ENV === 'production') return null
  if (error instanceof ApiError) return error.status === 0 ? 'network error' : `HTTP ${error.status}`
  return null
}
