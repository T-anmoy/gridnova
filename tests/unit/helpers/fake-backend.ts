import { vi } from 'vitest'

// A tiny stand-in for the BE-17 routes: `fetch` is stubbed and each "METHOD /path" (path
// after /api/v1/dashboard, query string included) answers from the table. Unknown routes
// answer 404 so a request the screen should not make shows up as a failure.

export type Reply = { status?: number; body: unknown } | ((req: { body: unknown; url: string }) => { status?: number; body: unknown })

export interface Call {
  method: string
  path: string
  body: unknown
}

export function fakeBackend(routes: Record<string, Reply>) {
  const calls: Call[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.replace(/^https?:\/\/[^/]+\/api\/v1\/dashboard/, '')
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ method, path, body })
    const reply = routes[`${method} ${path}`]
    if (!reply) return new Response(JSON.stringify({ detail: `no fake route for ${method} ${path}` }), { status: 404 })
    const r = typeof reply === 'function' ? reply({ body, url }) : reply
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    calls,
    /** Replace or add a route mid-test. */
    on(key: string, reply: Reply) {
      routes[key] = reply
    },
    called: (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path),
  }
}

/** A structured BE-17 refusal: `{"detail": {"code", "message", …}}`. */
export const refusal = (status: number, code: string, extra: Record<string, unknown> = {}) => ({
  status,
  body: { detail: { code, message: `server words for ${code}`, ...extra } },
})
