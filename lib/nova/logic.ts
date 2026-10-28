// Pure helpers for the Nova Records screens: how an answer is split into text and
// citations, how table cells are shown and exported, role starter questions and the
// sentences for each failure. No React here.
import { ApiError, ApiShapeError } from '@/lib/dashboard/api-error'
import { formatInr } from '@/lib/money'
import { formatDate } from '@/lib/dashboard/utils'
import type { Role } from '@/lib/dashboard/types'
import type { PermissionRule } from '@/lib/access/permissions'
import type { Citation, NovaContext, NovaTable, TableColumnType } from '@/lib/nova/schemas'

export const NOVA_QUESTION_MAX = 1000
/** The contract's `Retry-After` for `rate_limited`; used when the header is not readable. */
export const DEFAULT_RETRY_SECONDS = 60

// ── Links ────────────────────────────────────────────────────────────────────

/**
 * Only the staff pages that exist are linkable. The backend sends `null` where no page opens a
 * record; anything that is not a plain /dashboard/... path is treated as no link at all.
 */
export function safeDashboardPath(path: string | null | undefined): string | null {
  if (!path) return null
  return /^\/dashboard\/[A-Za-z0-9\-_/]*$/.test(path) && !path.includes('//') && !path.includes('..') ? path : null
}

// ── Answer text ──────────────────────────────────────────────────────────────

export type AnswerSegment = { kind: 'text'; text: string } | { kind: 'ref'; text: string; citation: Citation }

/**
 * Splits a plain-text answer so bracketed refs that appear in `citations` can be shown as
 * chips. Everything else — including brackets that are not citations — stays text, so the
 * answer is never interpreted as markup.
 */
export function splitAnswer(answer: string, citations: Citation[]): AnswerSegment[] {
  const byRef = new Map(citations.map((c) => [c.ref, c]))
  const out: AnswerSegment[] = []
  let last = 0
  for (const m of answer.matchAll(/\[([^[\]\n]{1,80})\]/g)) {
    const citation = byRef.get(m[1])
    if (!citation) continue
    const at = m.index ?? 0
    if (at > last) out.push({ kind: 'text', text: answer.slice(last, at) })
    out.push({ kind: 'ref', text: m[0], citation })
    last = at + m[0].length
  }
  if (last < answer.length) out.push({ kind: 'text', text: answer.slice(last) })
  return out
}

// ── Tables ───────────────────────────────────────────────────────────────────

const DECIMAL = /^-?\d+(\.\d+)?$/

/** How a table cell is shown. Money comes as a decimal string and is never turned into a number. */
export function formatCell(value: unknown, type: TableColumnType): string {
  if (value === null || value === undefined || value === '') return '—'
  switch (type) {
    case 'money':
      return typeof value === 'string' ? formatInr(value) : String(value)
    case 'kw':
      return `${String(value)} kW`
    case 'date':
      return typeof value === 'string' ? formatDate(value) : String(value)
    case 'boolean':
      return value === true ? 'Yes' : value === false ? 'No' : String(value)
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }
}

/**
 * A spreadsheet reads a cell starting with = + - @ (or a tab / carriage return) as a formula.
 * Those get a leading apostrophe. A plain decimal such as a negative amount is a number, not a
 * formula, so it is left alone.
 */
export function csvSafe(text: string): string {
  if (DECIMAL.test(text)) return text
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

function csvField(text: string): string {
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csvValue(value: unknown, type: TableColumnType): string {
  if (value === null || value === undefined) return ''
  if (type === 'boolean') return value === true ? 'Yes' : value === false ? 'No' : String(value)
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

/** The table as CSV text: raw values (ISO dates, decimal strings), every cell formula-safe. */
export function tableToCsv(table: NovaTable): string {
  const head = table.columns.map((c) => csvField(csvSafe(c.label)))
  const rows = table.rows.map((row) => table.columns.map((c) => csvField(csvSafe(csvValue(row[c.key], c.type)))))
  return [head, ...rows].map((r) => r.join(',')).join('\r\n') + '\r\n'
}

export function csvFilename(title: string, now: Date = new Date()): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'table'
  return `nova-${slug}-${now.toISOString().slice(0, 10)}.csv`
}

/** Browser-only: saves CSV text as a file. The BOM keeps Excel reading UTF-8 names correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ── Context ──────────────────────────────────────────────────────────────────

export function isEmptyContext(ctx: NovaContext | null | undefined): boolean {
  return !ctx || (ctx.lead_id == null && !ctx.project_ref && ctx.customer_id == null)
}

/** A short line telling the user what "this project" means, from the context actually sent. */
export function describeContext(ctx: NovaContext | null | undefined): string | null {
  if (isEmptyContext(ctx)) return null
  const parts: string[] = []
  if (ctx?.project_ref) parts.push(`project ${ctx.project_ref}`)
  if (ctx?.lead_id != null) parts.push(`lead #${ctx.lead_id}`)
  return parts.length ? parts.join(' · ') : 'this customer'
}

// ── Roles and starter questions ──────────────────────────────────────────────

/**
 * Every staff member may ask (the backend scopes each answer); before GET /employees/me
 * has answered — or for someone who is not staff — there is no entry point.
 */
export function canUseNova(can: (rule: PermissionRule) => boolean): boolean {
  // A person who holds only the Proposal Desk's Studio permissions has no Nova Records data.
  return can('beyond_studio')
}

// Questions only — never facts. Keyed by the primary role: wording, not access (the
// backend answers within the person's permissions). Each is one the role can actually be answered
// (no money for Operations / Engineer / Sales, no leads for Operations / Accounts).
const STARTERS: Record<Role, string[]> = {
  admin: [
    'How many projects did we commission in each district?',
    'Which warranties end in the next 90 days?',
    'Show open service requests',
    'Which projects have an outstanding balance?',
  ],
  management: [
    'How many projects did we commission each year?',
    'Which warranties end in the next 90 days?',
    'Show open service requests',
    'Which projects have an outstanding balance?',
  ],
  accounts: [
    'Which projects have an outstanding balance?',
    'Show payments received this month',
    'What is the total contract value of projects commissioned in 2025, by district?',
    'Which warranties end in the next 90 days?',
  ],
  operations: [
    'Which projects are in execution right now?',
    'Show open service requests',
    'Which warranties end in the next 90 days?',
    'Which inverter makes have we installed most?',
  ],
  engineer: [
    'Show 5 kW and larger projects commissioned in 2025 and the inverters used',
    'Which module makes have we installed most?',
    'Show open service requests',
    'Which warranties end in the next 90 days?',
  ],
  network_manager: [
    'How many projects did we commission in each district?',
    'Show residential projects commissioned in 2025, by district',
    'Which warranties end in the next 90 days?',
  ],
  sales: [
    'Show my open leads',
    'Which of my leads are qualified?',
    'Show residential projects commissioned in 2025, by district',
    'Which inverter makes have we installed most?',
  ],
  proposal_desk: [],
}

export function starterQuestions(role: Role | undefined): string[] {
  return role && role in STARTERS ? STARTERS[role] : []
}

// ── Failures ─────────────────────────────────────────────────────────────────

export interface AskFailure {
  kind: 'rate_limited' | 'daily_limit' | 'disabled' | 'unavailable' | 'conversation_gone' | 'invalid' | 'network' | 'other'
  message: string
  /** Seconds to wait before asking again, only for a per-minute rate limit. */
  retryAfterSeconds?: number
  retryable: boolean
}

export function describeAskError(err: unknown): AskFailure {
  if (err instanceof ApiShapeError) {
    return { kind: 'other', message: 'Nova sent an answer this screen could not read. Try again; if it keeps happening, tell an admin.', retryable: true }
  }
  if (!(err instanceof ApiError)) return { kind: 'other', message: 'Something went wrong. Try again.', retryable: true }
  const code = typeof err.structuredDetail?.code === 'string' ? err.structuredDetail.code : undefined
  if (err.status === 0) return { kind: 'network', message: 'Can’t reach the server. Check your connection and try again.', retryable: true }
  if (err.status === 429 && code === 'daily_limit_reached') {
    return { kind: 'daily_limit', message: 'You have reached today’s question limit. It resets tomorrow (IST).', retryable: false }
  }
  if (err.status === 429) {
    const seconds = err.retryAfterSeconds ?? DEFAULT_RETRY_SECONDS
    return { kind: 'rate_limited', message: `You’re asking too quickly. Try again in ${seconds} seconds.`, retryAfterSeconds: seconds, retryable: true }
  }
  if (err.status === 503 && code === 'assistant_disabled') {
    return { kind: 'disabled', message: 'Nova Records is switched off right now. Ask an admin.', retryable: false }
  }
  if (err.status === 503) {
    return { kind: 'unavailable', message: 'Nova Records could not answer just now. Try again in a moment.', retryable: true }
  }
  if (err.status === 404 && code === 'conversation_not_found') {
    return { kind: 'conversation_gone', message: 'That conversation is no longer available. Your next question starts a new one.', retryable: false }
  }
  if (err.status === 422) {
    return { kind: 'invalid', message: code === 'empty_question' ? 'Type a question first.' : 'Nova could not accept that question. Check its length (1–1000 characters).', retryable: false }
  }
  if (err.status >= 500) return { kind: 'unavailable', message: 'Nova Records could not answer just now. Try again in a moment.', retryable: true }
  return { kind: 'other', message: err.detail || 'Something went wrong. Try again.', retryable: true }
}
