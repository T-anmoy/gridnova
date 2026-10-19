// Loaded into the Next *server* process (NODE_OPTIONS=--require, see
// playwright.config.ts). The customer accept page fetches its proposal on the
// server, where Playwright's page.route cannot see the request, so this stands in
// for the backend for exactly that one endpoint. Everything else falls through to
// the real fetch (and fails, as it always did, since the e2e API host does not exist).
//
// Tokens select the scenario:
//   tok-ready     an acceptable proposal
//   tok-expired   state "expired" in the body (GET never error-codes expiry)
//   tok-accepted  already accepted
//   tok-missing   404
const original = globalThis.fetch
const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.e2e.test'

const view = (over) => ({
  proposal_id: 7,
  version: 2,
  scope: [{ id: 'commercial_rooftop_scope', body: 'Structural assessment and system design.' }],
  price: 450000,
  valid_until: '2026-12-01T00:00:00',
  state: 'acceptable',
  accepted_at: null,
  pdf_available: true,
  ...over,
})

const SCENARIOS = {
  'tok-ready': () => [200, view({})],
  'tok-expired': () => [200, view({ state: 'expired' })],
  'tok-accepted': () => [200, view({ state: 'accepted', accepted_at: '2026-10-12T05:00:00+00:00' })],
  'tok-missing': () => [404, { detail: { code: 'not_found', message: 'Unknown link' } }],
}

globalThis.fetch = async function mockedFetch(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const m = url.startsWith(API) && url.match(/\/api\/v1\/proposals\/accept\/([^/?#]+)$/)
  if (m && (!init || !init.method || init.method === 'GET') && SCENARIOS[m[1]]) {
    const [status, body] = SCENARIOS[m[1]]()
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }
  return original(input, init)
}
