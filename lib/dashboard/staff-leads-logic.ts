// Role gating, request building and error mapping for the BE-6 staff screens
// (staff_contracts.md §1–§2). Pure and framework-free so every rule is unit
// tested. Error mapping matches the contract's exact plain-string `detail` and
// returns a message KEY: the words come from the translated copy, never from
// the server's English (except the 409/503 messages the contract says come from
// the booking/availability layers, which are passed through as `serverText`).
import { ApiError } from '@/lib/dashboard/api-error'
import type { PermissionRule } from '@/lib/access/permissions'
import { SEES_LEADS } from '@/lib/dashboard/nav'
import type {
  CustomerMemoryResponse, EngineerLeadDetail, MemoryAskResponse, ReflectResponse, ScheduleMeetingRequest,
} from '@/lib/dashboard/staff-leads-types'
import type { LeadDetail } from '@/lib/dashboard/types'

// ── Permissions (GET /employees/me; `can` is usePermissions().can) ────────────

type Can = (rule: PermissionRule) => boolean

/** Operations and Accounts see no leads at all (§ visibility rule). */
export const canSeeLeads = (can: Can) => can(SEES_LEADS)
/** The CSV exports are company-wide figures (the backend gates them on analytics.view_full). */
export const canExportLeads = (can: Can) => can('analytics.view_full')
export const canScheduleMeeting = (can: Can) => can('meetings.schedule')
/** Customer memory, ask-memory and reflect share one permission. */
export const canUseMemory = (can: Can) => can('customers.memory_query')

// ── Lead detail shapes ───────────────────────────────────────────────────────

export type AnyLeadDetail = LeadDetail | EngineerLeadDetail

/** §2: the Engineer response has no `customer` key at all (a null customer is the full shape). */
export function isEngineerLeadDetail(d: AnyLeadDetail): d is EngineerLeadDetail {
  return !('customer' in d)
}

// ── Exact server strings ─────────────────────────────────────────────────────

export const SERVER = {
  scheduleRole: 'Your role cannot schedule meetings.',
  leadNotAssigned: 'This lead is not assigned to you.',
  leadNotFound: 'Lead not found',
  noCalendar: 'No connected Google Calendar available to book this meeting on.',
  memoryRole: 'Your role cannot query customer memory.',
  customerOfAnotherRep: "This customer's leads are assigned to another rep.",
  customerNotFound: 'Customer not found',
  unknownKindPrefix: 'Unknown memory kind:',
  reflectRole: 'Your role cannot trigger reflection.',
  exportRole: 'Only Admin or Management can export leads.',
  skippedNoNew: 'no new messages since last reflection',
  skippedNothing: 'reflection returned nothing',
  skippedLeadNotFound: 'lead not found',
  skippedErrorPrefix: 'error:',
} as const

const detailOf = (err: unknown): string => (err instanceof ApiError ? (err.detail ?? '').trim() : '')
const statusOf = (err: unknown): number | null => (err instanceof ApiError ? err.status : null)

export type MappedError<K extends string> = { key: K; serverText?: string }

/** A 403 whose text is exactly "This lead is not assigned to you." */
export const isLeadNotAssigned = (err: unknown) => statusOf(err) === 403 && detailOf(err) === SERVER.leadNotAssigned

// ── Schedule meeting ─────────────────────────────────────────────────────────

export type ScheduleErrorKey = 'role' | 'notAssigned' | 'notFound' | 'noCalendar' | 'conflict' | 'notConfigured' | 'network' | 'generic'

export function mapScheduleMeetingError(err: unknown): MappedError<ScheduleErrorKey> {
  const status = statusOf(err)
  const detail = detailOf(err)
  if (status === 0) return { key: 'network' }
  if (status === 403 && detail === SERVER.scheduleRole) return { key: 'role' }
  if (status === 403 && detail === SERVER.leadNotAssigned) return { key: 'notAssigned' }
  if (status === 404 && detail === SERVER.leadNotFound) return { key: 'notFound' }
  if (status === 409) {
    return detail === SERVER.noCalendar ? { key: 'noCalendar' } : { key: 'conflict', serverText: detail || undefined }
  }
  if (status === 503) return { key: 'notConfigured', serverText: detail || undefined }
  return { key: 'generic' }
}

const IST_OFFSET = '+05:30'
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/**
 * An <input type="datetime-local"> value is a wall-clock time with no zone; the
 * user means India time. Return an ISO string WITH the +05:30 offset (the server
 * reads a naive value as UTC, so a naive string is never sent), or null if the
 * value is not a real date and time. India has no daylight saving, so the fixed
 * offset is exact.
 */
export function istLocalToIso(value: string): string | null {
  const m = LOCAL_RE.exec(value.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s = '00'] = m
  const check = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${IST_OFFSET}`)
  if (Number.isNaN(check.getTime())) return null
  // Reject roll-overs such as 2026-02-31 or 25:00.
  const back = new Date(check.getTime() + 5.5 * 3_600_000).toISOString()
  if (back.slice(0, 19) !== `${y}-${mo}-${d}T${h}:${mi}:${s}`) return null
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${IST_OFFSET}`
}

export const DURATION_MIN = 5
export const DURATION_MAX = 480

export type ScheduleFormError = 'invalidTime' | 'invalidDuration'

/** Build the POST body, or say what is wrong with the form. Duration is optional: blank leaves the default to the server. */
export function buildScheduleMeetingBody(
  whenLocal: string,
  durationText: string,
): { ok: true; body: ScheduleMeetingRequest } | { ok: false; error: ScheduleFormError } {
  const scheduled_at = istLocalToIso(whenLocal)
  if (!scheduled_at) return { ok: false, error: 'invalidTime' }
  const trimmed = durationText.trim()
  if (!trimmed) return { ok: true, body: { scheduled_at } }
  const n = Number(trimmed)
  if (!Number.isInteger(n) || n < DURATION_MIN || n > DURATION_MAX) return { ok: false, error: 'invalidDuration' }
  return { ok: true, body: { scheduled_at, duration_minutes: n } }
}

/** "20 Oct 2026, 10:30 am" for an instant, in IST regardless of the browser's zone. */
export function formatMeetingTimeIst(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  }).format(d)
}

/** Only an https link is rendered as an anchor; anything else is shown as nothing. */
export function safeMeetLink(link: string | null): string | null {
  if (!link) return null
  try {
    return new URL(link).protocol === 'https:' ? link : null
  } catch {
    return null
  }
}

// ── Customer memory ──────────────────────────────────────────────────────────

/** The memory kinds (confirmed list). A kind outside it in a response is still shown as received. */
export const MEMORY_KINDS = ['episode', 'preference', 'objection', 'commitment', 'outcome', 'insight', 'self_critique'] as const
export const MEMORY_LIMIT_MIN = 1
export const MEMORY_LIMIT_MAX = 500
export const MEMORY_LIMIT_DEFAULT = 100

/** Clamp a typed limit into 1–500; null when it is not a number. */
export function clampMemoryLimit(text: string): number | null {
  const n = Number(text)
  if (!text.trim() || !Number.isFinite(n)) return null
  return Math.min(MEMORY_LIMIT_MAX, Math.max(MEMORY_LIMIT_MIN, Math.trunc(n)))
}

export type MemoryErrorKey = 'role' | 'anotherRep' | 'notFound' | 'unknownKind' | 'agent' | 'network' | 'generic'

export function mapMemoryError(err: unknown): MappedError<MemoryErrorKey> {
  const status = statusOf(err)
  const detail = detailOf(err)
  if (status === 0) return { key: 'network' }
  if (status === 403 && detail === SERVER.memoryRole) return { key: 'role' }
  if (status === 403 && detail === SERVER.customerOfAnotherRep) return { key: 'anotherRep' }
  if (status === 404 && detail === SERVER.customerNotFound) return { key: 'notFound' }
  if (status === 422 && detail.startsWith(SERVER.unknownKindPrefix)) return { key: 'unknownKind' }
  if (status === 503) return { key: 'agent', serverText: detail || undefined }
  return { key: 'generic' }
}

export const memoryCountLabelArgs = (r: CustomerMemoryResponse) => ({ shown: r.memories.length, total: r.memory_count })

// ── Ask memory ───────────────────────────────────────────────────────────────

export const ASK_MAX = 500

export type AskOutcome = 'answered' | 'ambiguous' | 'unresolved'

export function askOutcome(r: MemoryAskResponse): AskOutcome {
  if (r.resolved) return 'answered'
  return r.candidates.length > 0 ? 'ambiguous' : 'unresolved'
}

/** 1–500 characters after trimming. */
export function validQuestion(text: string): boolean {
  const t = text.trim()
  return t.length >= 1 && t.length <= ASK_MAX
}

// ── Reflect ──────────────────────────────────────────────────────────────────

export type ReflectOutcome =
  | { kind: 'written'; count: number }
  | { kind: 'skipped'; reason: 'noNewMessages' | 'nothingReturned' | 'leadNotFound' | 'error' | 'other'; text: string }

/** `skipped` non-null means nothing was written, whatever `memories_written` says. */
export function reflectOutcome(r: ReflectResponse): ReflectOutcome {
  if (r.skipped === null || r.skipped === undefined) return { kind: 'written', count: r.memories_written }
  const text = r.skipped.trim()
  const lower = text.toLowerCase()
  if (lower === SERVER.skippedNoNew) return { kind: 'skipped', reason: 'noNewMessages', text }
  if (lower === SERVER.skippedNothing) return { kind: 'skipped', reason: 'nothingReturned', text }
  if (lower === SERVER.skippedLeadNotFound) return { kind: 'skipped', reason: 'leadNotFound', text }
  if (lower.startsWith(SERVER.skippedErrorPrefix)) return { kind: 'skipped', reason: 'error', text }
  return { kind: 'skipped', reason: 'other', text }
}

export type ReflectErrorKey = 'role' | 'notFound' | 'anotherRep' | 'network' | 'generic'

export function mapReflectError(err: unknown): MappedError<ReflectErrorKey> {
  const status = statusOf(err)
  const detail = detailOf(err)
  if (status === 0) return { key: 'network' }
  if (status === 403 && detail === SERVER.reflectRole) return { key: 'role' }
  if (status === 403 && detail === SERVER.customerOfAnotherRep) return { key: 'anotherRep' }
  if (status === 404 && detail === SERVER.leadNotFound) return { key: 'notFound' }
  return { key: 'generic' }
}

// ── Export ───────────────────────────────────────────────────────────────────

export type ExportErrorKey = 'forbidden' | 'filterRejected' | 'network' | 'failed'

export function mapExportError(err: unknown): MappedError<ExportErrorKey> {
  const status = statusOf(err)
  if (status === 0) return { key: 'network' }
  if (status === 403) return { key: 'forbidden' }
  if (status === 422) return { key: 'filterRejected' }
  return { key: 'failed' }
}
