// Serial register shapes (Phase 4A contract + 0041). Ratings are decimal STRINGS
// and are displayed as returned. `previously_voided` is a staff-only signal:
// associate-facing code must never read or show it.

export type UnitCategory = 'module' | 'inverter' | 'other'
export type UnitStatus = 'entered' | 'verified' | 'voided'

export interface UnitEquipment {
  id: number
  brand: string
  model_name: string
  is_dcr_compliant: boolean
  is_placeholder: boolean
  // Staff only (PM-A), when the backend returns it.
  equivalent_reason?: string | null
}

export interface RegisterUnit {
  unit_id: number
  category: UnitCategory
  serial_number: string
  serial_normalized: string
  equipment: UnitEquipment | null
  rating_wp: string | null
  rating_kw: string | null
  is_dcr: boolean | null
  warranty_start: string | null
  warranty_end: string | null
  status: UnitStatus
  created_by: string | null
  created_at: string
  verified_by: string | null
  verified_at: string | null
  void_reason: string | null
  // As printed on the nameplate (HF-C). Set for unmatched units, optional otherwise.
  brand_as_printed?: string | null
  model_as_printed?: string | null
  // Staff only (0041).
  previously_voided?: boolean
  // Staff only (PM-A): per-unit flags, e.g. `make_not_in_package` (non-blocking), and the
  // reason an equivalent make was accepted, when the backend returns one.
  flags?: string[]
  equivalent_reason?: string | null
}

export interface Register {
  verified_at: string | null
  verified_by: string | null
  units: RegisterUnit[]
  totals: { modules: number; inverters: number; other: number; inverter_kw: string }
  capacity: { installed_module_kw: string; requested_kw: string | null; tolerance_percent: number | string; mismatch: boolean }
  dcr: { pm_surya_ghar: boolean; mismatch: boolean; override: { reason: string; by: string; at: string } | null }
  flags: string[]
}

// What the staff form sends for one unit.
export interface UnitInput {
  category: UnitCategory
  equipment_id?: number
  // A module or inverter that isn't in the catalogue: both are then required.
  brand_as_printed?: string
  model_as_printed?: string
  serial_number: string
  rating_wp?: string
  rating_kw?: string
  is_dcr?: boolean
  warranty_start?: string
  warranty_end?: string
}

export interface RegisterWarning {
  code: string
  message?: string
  [extra: string]: unknown
}

export interface SerialCheck {
  serial_normalized: string
  available: boolean
  on_this_project?: boolean
  message?: string
  // Staff: {onboarding_id, project_reference_id}; associates: {onboarding_id} only inside their own scope, else null.
  held_by: { onboarding_id?: number | null; project_reference_id?: string | null } | null
}

export interface RowError {
  row: number
  code: string
  message: string
  field?: string
  held_by?: SerialCheck['held_by']
}
