// Typed API errors + classification so the dashboard can show a distinct,
// honest state for each failure mode instead of one generic "dead server" card.

export class ApiError extends Error {
  /** HTTP status, or 0 for a true network / fetch failure. */
  status: number
  /** Server-provided detail (parsed from the response body when available). */
  detail?: string

  constructor(status: number, message: string, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export type ErrorKind = 'auth' | 'forbidden' | 'rateLimited' | 'server' | 'network' | 'client'

export interface ClassifiedError {
  kind: ErrorKind
  status: number
  /** Friendly heading for the UI. */
  heading: string
  /** Real underlying detail (status code + message) surfaced for debugging. */
  detail: string
}

// Map any thrown error into a classified, display-ready shape.
export function classifyApiError(error: unknown): ClassifiedError {
  const status = error instanceof ApiError ? error.status : 0
  const rawDetail =
    error instanceof ApiError
      ? error.detail || error.message
      : error instanceof Error
        ? error.message
        : String(error)

  if (status === 401) {
    return { kind: 'auth', status, heading: 'Your session expired', detail: withCode(status, rawDetail) }
  }
  if (status === 403) {
    return { kind: 'forbidden', status, heading: 'You don’t have permission to view this', detail: withCode(status, rawDetail) }
  }
  if (status === 429) {
    return { kind: 'rateLimited', status, heading: 'Too many requests', detail: withCode(status, rawDetail) }
  }
  if (status >= 500) {
    return { kind: 'server', status, heading: 'The server ran into a problem', detail: withCode(status, rawDetail) }
  }
  if (status === 0) {
    return { kind: 'network', status, heading: 'Can’t reach the server', detail: rawDetail }
  }
  return { kind: 'client', status, heading: 'Something went wrong', detail: withCode(status, rawDetail) }
}

function withCode(status: number, detail: string): string {
  return detail.startsWith(String(status)) || detail.includes(`${status}`) ? detail : `${status}: ${detail}`
}

// Retry only transient failures (rate limits, 5xx, true network) — never
// auth/permission/other 4xx, which won't fix themselves on retry.
export function isRetryableError(error: unknown): boolean {
  const { kind } = classifyApiError(error)
  return kind === 'rateLimited' || kind === 'server' || kind === 'network'
}

// Exponential backoff with a ceiling, used for the automatic 429/5xx retries.
export function backoffDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 8000)
}
