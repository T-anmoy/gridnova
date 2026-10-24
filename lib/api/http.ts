// The one transport layer for every backend call (staff dashboard, associate
// portal, public site). Auth/error handling lives here so a fix lands once.
import type { z } from 'zod'
import { API_BASE_URL } from '@/lib/config'
import { ApiError, ApiShapeError } from '@/lib/dashboard/api-error'
import { formatZodError } from '@/lib/dashboard/schemas'

export const REQUEST_TIMEOUT_MS = 30_000

/** An upload that makes no progress for this long is abandoned. */
export const UPLOAD_STALL_TIMEOUT_MS = 45_000

export const NOT_AUTHENTICATED_CODE = 'not_authenticated'

// ── Query strings ───────────────────────────────────────────────────────────

export function buildQS(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

// ── Auth ────────────────────────────────────────────────────────────────────

/** No Clerk token: a local "signed out" condition. Classified `auth`, never retried. */
export function notAuthenticatedError(): ApiError {
  return new ApiError(401, 'Not authenticated', 'Not authenticated', { code: NOT_AUTHENTICATED_CODE })
}

export function isNotAuthenticatedError(error: unknown): boolean {
  return error instanceof ApiError && error.structuredDetail?.code === NOT_AUTHENTICATED_CODE
}

export async function getTokenOrThrow(getToken: () => Promise<string | null>): Promise<string> {
  const token = await getToken()
  if (!token) throw notAuthenticatedError()
  return token
}

// ── Errors ──────────────────────────────────────────────────────────────────

interface FieldError {
  loc?: unknown
  msg?: unknown
}

/** FastAPI 422 `detail` array → `field: msg` lines (the `body`/`query` prefix is dropped). */
export function formatValidationDetail(items: unknown[]): string {
  return items
    .map((raw) => {
      if (typeof raw === 'string') return raw
      const item = (raw ?? {}) as FieldError
      const loc = Array.isArray(item.loc) ? item.loc.filter((p) => p !== 'body' && p !== 'query' && p !== 'path') : []
      const msg = typeof item.msg === 'string' ? item.msg : 'Invalid value'
      return loc.length ? `${loc.join('.')}: ${msg}` : msg
    })
    .join('; ')
}

/** Build an ApiError from a non-2xx response. Never renders an object as "[object Object]". */
export function parseApiError(status: number, statusText: string, body: string, headers?: Headers): ApiError {
  let detail = body
  let structuredDetail: Record<string, unknown> | undefined
  try {
    const parsed = JSON.parse(body) as { detail?: unknown; message?: unknown }
    const d = parsed.detail ?? parsed.message
    if (typeof d === 'string' && d) {
      detail = d
    } else if (Array.isArray(d)) {
      detail = formatValidationDetail(d) || statusText
      structuredDetail = { fieldErrors: d }
    } else if (d && typeof d === 'object') {
      structuredDetail = d as Record<string, unknown>
      const msg = structuredDetail.message
      detail = typeof msg === 'string' ? msg : statusText
    }
  } catch {
    /* not JSON — keep raw text */
  }
  const retryAfter = Number.parseInt(headers?.get('Retry-After') ?? '', 10)
  return new ApiError(status, `API error ${status}`, detail || statusText, structuredDetail, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined)
}

function withTimeout(signal: AbortSignal | null | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

async function readBody<T>(res: Response, path: string, schema?: z.ZodType<T>): Promise<T> {
  const text = await res.text().catch(() => '')
  // 204 / empty 2xx: nothing to parse.
  if (!text.trim()) return undefined as T
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ApiShapeError(path, 'the response was not valid JSON')
  }
  if (!schema) return data as T
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new ApiShapeError(path, formatZodError(parsed.error))
  return parsed.data
}

// ── Fetchers ────────────────────────────────────────────────────────────────

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, { ...init, signal: withTimeout(init.signal) })
  } catch (err) {
    // An abort the caller asked for (unmount, query cancel) is not a network
    // failure — let it propagate so TanStack treats it as a cancellation.
    if (init.signal?.aborted) throw err
    throw new ApiError(0, 'Network request failed')
  }
}

/** Authenticated JSON request. Pass TanStack's `signal` via `options.signal`. */
export async function apiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
  // When provided, a 2xx response that doesn't match throws ApiShapeError
  // naming the offending field instead of returning data the type wrongly
  // promises is safe.
  schema?: z.ZodType<T>
): Promise<T> {
  const res = await send(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) throw parseApiError(res.status, res.statusText, await res.text().catch(() => ''), res.headers)
  return readBody(res, path, schema)
}

/** Unauthenticated request for the public surface. */
export async function publicFetch<T>(path: string, options?: RequestInit, schema?: z.ZodType<T>): Promise<T> {
  const res = await send(path, options ?? {})
  if (!res.ok) throw parseApiError(res.status, res.statusText, await res.text().catch(() => ''))
  return readBody(res, path, schema)
}

/**
 * Authenticated multipart upload. When `onProgress` is given the upload goes
 * through XMLHttpRequest (fetch cannot observe upload progress), with a stall
 * timeout rather than a total-duration cap so a slow but moving upload on 2G is
 * never cut off.
 */
export async function apiFetchForm<T>(
  path: string,
  token: string,
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<T> {
  let status: number
  let statusText: string
  let body: string
  try {
    if (onProgress && typeof XMLHttpRequest !== 'undefined') {
      const xhr = await new Promise<XMLHttpRequest>((resolve, reject) => {
        const req = new XMLHttpRequest()
        let stall: ReturnType<typeof setTimeout> | undefined
        const armStall = () => {
          clearTimeout(stall)
          stall = setTimeout(() => req.abort(), UPLOAD_STALL_TIMEOUT_MS)
        }
        const settle = (fn: () => void) => {
          clearTimeout(stall)
          fn()
        }
        req.open('POST', `${API_BASE_URL}${path}`)
        req.setRequestHeader('Authorization', `Bearer ${token}`)
        req.upload.onprogress = (e) => {
          armStall()
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
        }
        req.onprogress = armStall
        req.onload = () => settle(() => resolve(req))
        req.onerror = () => settle(() => reject(new Error('network')))
        req.ontimeout = () => settle(() => reject(new Error('network')))
        req.onabort = () => settle(() => reject(new Error('network')))
        armStall()
        req.send(formData)
      })
      status = xhr.status
      statusText = xhr.statusText
      body = xhr.responseText
    } else {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      status = res.status
      statusText = res.statusText
      body = await res.text().catch(() => '')
    }
  } catch {
    throw new ApiError(0, 'Network request failed')
  }
  if (status < 200 || status >= 300) throw parseApiError(status, statusText, body)
  if (!body.trim()) return undefined as T
  try {
    return JSON.parse(body) as T
  } catch {
    // A 2xx whose body is not JSON (a proxy page, a truncated response) is a
    // server-side problem, not a success the caller can use.
    throw new ApiError(status, 'Invalid response', 'The server sent a response that could not be read.')
  }
}

/** Authenticated binary GET (a PDF to preview); errors keep the structured detail and Retry-After. */
export async function apiFetchBlob(path: string, token: string, options?: RequestInit): Promise<Blob> {
  const res = await send(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options?.headers ?? {}) } })
  if (!res.ok) throw parseApiError(res.status, res.statusText, await res.text().catch(() => ''), res.headers)
  return res.blob()
}

/** Authenticated CSV/blob download that reuses the shared error parsing. */
export async function apiDownload(path: string, token: string, fallbackName: string): Promise<void> {
  const res = await send(path, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw parseApiError(res.status, res.statusText, await res.text().catch(() => ''))
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const filename = disposition.match(/filename="?([^";\n]+)"?/i)?.[1]?.trim() ?? fallbackName
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
