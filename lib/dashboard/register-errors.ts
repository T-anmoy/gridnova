import { ApiError } from '@/lib/dashboard/api-error'
import type { RowError } from '@/lib/associate/register-types'

// Plain-English sentences for the register's business errors (contract codes).
export const REGISTER_ERRORS: Record<string, string> = {
  invalid_serial: 'A serial number must be 4–40 characters once spaces are removed.',
  invalid_category: 'Choose module, inverter or other.',
  equipment_required: 'Choose the model from the catalogue.',
  unknown_equipment: 'That model isn’t in the catalogue.',
  equipment_category_mismatch: 'That model is a different kind of equipment.',
  rating_required: 'Enter the rating.',
  invalid_number: 'The rating must be a number.',
  dcr_required: 'The DCR flag is required for a module.',
  dcr_mismatch: 'The DCR flag doesn’t match the catalogue.',
  warranty_pair: 'Enter both warranty dates, or neither.',
  warranty_order: 'The warranty can’t end before it starts.',
  warranty_too_long: 'That warranty period is longer than 40 years.',
  invalid_date: 'That date isn’t valid.',
  no_rows: 'Add at least one unit.',
  too_many_rows: 'You can save at most 200 units at once.',
  duplicate_serial: 'This serial number is already registered.',
  duplicate_in_batch: 'This serial number appears twice in this list.',
  unit_voided: 'This unit has been voided and can’t be changed.',
  register_locked: 'The register is verified and locked. Only an Admin can change it, with a reason.',
  register_already_verified: 'The register is already verified.',
  register_incomplete: 'The register needs at least one module and one inverter before it can be verified.',
  reason_required: 'A reason is required.',
  register_rows_invalid: 'Some rows need fixing — nothing was saved.',
  override_exists: 'An override has already been recorded.',
}

export function registerErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const code = err.structuredDetail?.code
    if (typeof code === 'string') {
      if (code === 'register_incomplete') {
        const missing = err.structuredDetail?.missing
        if (Array.isArray(missing) && missing.length > 0) return `The register still needs: ${missing.join(' and ')}.`
      }
      if (code in REGISTER_ERRORS) return REGISTER_ERRORS[code]
    }
    if (err.status === 403 && err.detail) return err.detail
  }
  return 'Something went wrong. Please try again.'
}

/** Per-row errors from a 422 `register_rows_invalid` (or an all-duplicates 409). */
export function rowErrorsOf(err: unknown): RowError[] {
  if (!(err instanceof ApiError)) return []
  const list = err.structuredDetail?.errors
  if (!Array.isArray(list)) return []
  return list.filter((e): e is RowError => !!e && typeof e === 'object' && typeof (e as RowError).code === 'string' && typeof (e as RowError).row === 'number')
}
