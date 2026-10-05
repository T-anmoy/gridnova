// Shapes of the execution (installation) endpoints, from the Phase 4A contract.
// Stage keys, evidence keys and slot keys come from the backend and can grow:
// nothing here is a closed union, and the UI falls back to a readable label.
import type { Register } from './register-types'
import type { CaptureMethod, ExecutionMode, PhotoFlag, ProgressAging, ProgressStageKey } from './onboarding-types'

export interface ExecutionFile {
  file_ref: string
  filename: string
  received_at: string
  uploaded_by: string | null
  // Photos only.
  capture_method?: CaptureMethod | null
  location_verified?: boolean
  flags?: PhotoFlag[]
  latitude?: number | null
  longitude?: number | null
  client_captured_at?: string | null
  exif_taken_at?: string | null
}

export interface EvidenceRequired {
  text: string[]
  documents: string[]
  optional_documents: string[]
  photos: string[]
  register_verified: boolean
}

export interface StageBlocker {
  // 'payment_gate' | 'dcr_mismatch' today; unknown codes show the API message.
  code: string
  message: string
}

export type SubmissionStatus = 'pending' | 'verified' | 'rejected'

export interface StageSubmission {
  submission_id: number
  onboarding_id: number
  stage: ProgressStageKey
  stage_label: string
  status: SubmissionStatus
  submitted_by: string | null
  submitted_at: string
  evidence: {
    text: Record<string, string>
    note: string | null
    documents: Record<string, ExecutionFile> | string[]
    photos: Record<string, ExecutionFile> | string[]
    register_verified_at: string | null
  }
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
}

export type StageVia = 'associate_submission' | 'direct' | 'admin_override' | null

export interface ExecutionStageStatus {
  stage: ProgressStageKey
  label: string
  recorded: boolean
  recorded_at: string | null
  recorded_by: string | null
  via: StageVia
  // Latest submission while the stage isn't recorded (pending or rejected).
  submission: StageSubmission | null
  evidence_required: EvidenceRequired
  blockers: StageBlocker[]
}

export interface ExecutionStatus {
  onboarding_id: number
  project_id: number
  execution_mode: ExecutionMode
  started_at: string | null
  register_verified_at: string | null
  current_stage: ProgressStageKey | null
  next_stage: ProgressStageKey | null
  next_stage_is_execution: boolean
  aging: ProgressAging | null
  pending_submission: StageSubmission | null
  stages: ExecutionStageStatus[]
  // Entries may be plain keys or {key, label} objects — see slotKey().
  photo_slots: (string | { key: string; label?: string })[]
  document_types: (string | { key: string; label?: string })[]
  files: { photos: Record<string, ExecutionFile>; documents: Record<string, ExecutionFile> }
  flags: string[]
  // Associate view only.
  can_submit?: boolean
  // Serial register (read-only for associates).
  register?: Register
}

export interface SubmitStageInput {
  stage: ProgressStageKey
  text: Record<string, string>
  note?: string
}

export interface SubmissionsResponse {
  items: StageSubmission[]
}
