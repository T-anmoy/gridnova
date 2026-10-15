import { ApiError } from '@/lib/dashboard/api-error'
import { STAFF_EXECUTION_COPY } from '@/lib/dashboard/staff-copy'
import { handoverErrorMessage } from '@/lib/handover/labels'

// Plain-English sentences for the staff execution endpoints' business errors.
const STAFF: Record<string, string> = {
  submission_not_pending: 'This submission has already been reviewed.',
  payment_gate: 'Earlier customer payments are not fully verified yet, so this step is on hold.',
  dcr_mismatch: 'This project has a DCR mismatch. An Admin has to record an override before the subsidy claim.',
  stage_out_of_order: 'An earlier stage has to be recorded first.',
  execution_mode_associate: 'This project is in Associate mode: the associate submits and Operations verifies. Only an Admin can record a stage directly, with an override reason.',
  execution_mode_grid_nova: 'This project is in Grid Nova mode, so there is nothing for the associate to submit.',
  reason_required: 'A reason is required.',
  note_required: 'A note is required to reject a submission.',
  register_incomplete: 'The serial register needs at least one module and one inverter first.',
  register_already_verified: 'The register is already verified.',
  override_exists: 'An override has already been recorded for this project.',
  register_locked: 'The register is locked. Only an Admin can change it, with a reason.',
  not_found: 'That could not be found.',
}

export function staffExecutionError(err: unknown): string {
  if (err instanceof ApiError) {
    const code = err.structuredDetail?.code
    if (typeof code === 'string') {
      // 422 from the handover gate (BE-5): name the missing pack items, not just that something is missing.
      if (code === 'handover_pack_incomplete') return handoverErrorMessage(err)
      if (code in STAFF) return STAFF[code]
      if (code in STAFF_EXECUTION_COPY.errors) return STAFF_EXECUTION_COPY.errors[code as keyof typeof STAFF_EXECUTION_COPY.errors]
    }
    if (err.status === 403 && err.detail) return err.detail
    if (err.detail && err.status >= 400 && err.status < 500) return err.detail
  }
  return 'Something went wrong. Please try again.'
}
