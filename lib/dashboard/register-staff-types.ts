// Staff-only register signals. `catalogue_unmatched` (HF-C) must never be read by an
// associate or public screen, so it lives here and not in lib/associate (a test enforces this).
import type { Register, RegisterUnit } from '@/lib/associate/register-types'

export interface StaffRegisterUnit extends RegisterUnit {
  catalogue_unmatched?: boolean
}

export type StaffRegister = Omit<Register, 'units'> & { units: StaffRegisterUnit[] }

/** A module or inverter that still has no catalogue item. `other` equipment is never matched. */
export const isUnmatched = (u: StaffRegisterUnit): boolean => u.catalogue_unmatched ?? (u.category !== 'other' && u.equipment == null)
