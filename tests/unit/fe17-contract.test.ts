// FE-17 contract drift: the BE-17 routes and bodies the dashboard uses, checked against the
// openapi snapshot and docs/api/access_control.md; the proxy and robots rules for the two
// invitation sign-up pages; and the associate portals left as they were.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { loadOpenApi, requestSchema, validate, type OpenApi } from './helpers/openapi'
import { ACCESS_ERROR_MESSAGES } from '@/lib/access/errors'
import { ROLE_ORDER } from '@/lib/access/roles'
import { ACCESS_MATRIX } from './fixtures/access-matrix'
import { APPROVAL_REQUEST, HANDOVER, INVITATION, deactivated } from './fixtures/access-contract'

const root = path.resolve(__dirname, '../..')
const spec: OpenApi = loadOpenApi()
const doc = readFileSync(path.join(root, 'docs/api/access_control.md'), 'utf8')
const api = readFileSync(path.join(root, 'lib/access/api.ts'), 'utf8')
const D = '/api/v1/dashboard'

describe('BE-17 routes the dashboard calls exist in openapi.json', () => {
  it.each([
    ['get', '/employees/me'], ['get', '/access/matrix'], ['get', '/access/alerts'], ['get', '/employees'],
    ['get', '/staff/invitations'], ['post', '/staff/invitations'], ['post', '/staff/invitations/{invitation_id}/resend'], ['delete', '/staff/invitations/{invitation_id}'],
    ['put', '/employees/{employee_id}/roles'], ['get', '/employees/{employee_id}/handover'], ['patch', '/employees/{employee_id}/deactivate'],
    ['patch', '/employees/{employee_id}/reactivate'], ['post', '/employees/{employee_id}/reassign'],
    ['get', '/approvals'], ['post', '/approvals/{request_id}/approve'], ['post', '/approvals/{request_id}/reject'], ['post', '/approvals/{request_id}/cancel'],
  ])('%s %s', (method, route) => {
    expect(spec.paths[`${D}${route}`]?.[method], `${method} ${route}`).toBeDefined()
    // …and lib/access/api.ts really calls it (path segments, ignoring the parameter names).
    const literal = route.replace(/\{[^}]+\}/g, '').replace(/\/+$/, '').split('/').filter(Boolean).pop()!
    expect(api).toContain(literal)
  })
})

describe('request bodies satisfy openapi.json', () => {
  const ok = (route: string, method: string, body: unknown) => expect(validate(spec, requestSchema(spec, `${D}${route}`, method)!, body)).toEqual([])
  it('POST /staff/invitations {name, email, roles}', () => {
    ok('/staff/invitations', 'post', { name: 'Nila Roy', email: 'nila@gridnova.in', roles: ['sales'] })
    ok('/staff/invitations', 'post', { name: 'Nila Roy', email: 'nila@gridnova.in', roles: ['admin', 'accounts'] })
  })
  it('PUT /employees/{id}/roles {roles}', () => ok('/employees/{employee_id}/roles', 'put', { roles: ['network_manager'] }))
  it('POST /employees/{id}/reassign {to_employee_id}', () => ok('/employees/{employee_id}/reassign', 'post', { to_employee_id: 'user_mita' }))
  it('POST /approvals/{id}/approve {note?}', () => {
    ok('/approvals/{request_id}/approve', 'post', {})
    ok('/approvals/{request_id}/approve', 'post', { note: 'Agreed' })
  })
  it('guards the guard: an unknown role and a missing field are refused', () => {
    // (The snapshot validator checks types, enums and required fields — not minItems.)
    const schema = requestSchema(spec, `${D}/staff/invitations`, 'post')!
    expect(validate(spec, schema, { name: 'A', email: 'a@b.c', roles: ['owner'] })).not.toEqual([])
    expect(validate(spec, schema, { name: 'A', roles: ['sales'] })).not.toEqual([])
  })
  it('the dashboard knows every role the backend has, and no other', () => {
    const roleEnum = (spec.components!.schemas!.EmployeeRole as { enum: string[] }).enum
    expect([...ROLE_ORDER].sort()).toEqual([...roleEnum].sort())
    expect(ACCESS_MATRIX.roles.map((r) => r.id).sort()).toEqual([...roleEnum].sort())
  })
})

describe('docs/api/access_control.md', () => {
  it('every error code the screens translate is one the contract names', () => {
    for (const code of Object.keys(ACCESS_ERROR_MESSAGES)) expect(doc, code).toContain(`\`${code}\``)
  })

  it('every error code the contract names has a sentence', () => {
    // Codes appear in the contract as `403 `code`` / `409 `code`` / `422 `code`` … and in "{"code": "…"}".
    const named = new Set<string>()
    for (const m of doc.matchAll(/\b(?:403|409|422|502|503)\s+`([a-z_]+)`/g)) named.add(m[1])
    for (const m of doc.matchAll(/`([a-z_]+)`\s*\/\s*`([a-z_]+)`/g)) {
      const ctx = doc.slice(Math.max(0, (m.index ?? 0) - 12), m.index)
      if (/\b(?:403|409|422|502|503)\s*$/.test(ctx)) { named.add(m[1]); named.add(m[2]) }
    }
    for (const m of doc.matchAll(/"code": "([a-z_]+)"/g)) named.add(m[1])
    expect(named.size).toBeGreaterThan(20)
    const missing = [...named].filter((c) => !ACCESS_ERROR_MESSAGES[c])
    expect(missing).toEqual([])
  })

  it('the fixtures carry exactly the fields of the contract’s examples', () => {
    const keysOf = (json: string) => Object.keys(JSON.parse(json))
    const example = (start: string) => {
      const i = doc.indexOf(start)
      const j = doc.indexOf('\n```', i)
      return doc.slice(i, j)
    }
    expect(Object.keys(INVITATION).sort()).toEqual(keysOf(example('{"invitation_id"')).sort())
    expect(Object.keys(APPROVAL_REQUEST).sort()).toEqual(keysOf(example('{"approval_request_id"')).sort())
    expect(Object.keys(HANDOVER).filter((k) => k !== 'employee_id').sort()).toEqual(['open_leads', 'open_proposals', 'pending_invitations'])
    const deact = Object.keys(deactivated()).filter((k) => k !== 'approval_requests_withdrawn')
    expect(deact.sort()).toEqual(keysOf(example('{"employee_id": "user_9"')).sort())
  })

  it('the matrix fixture has the /access/matrix shape and the contract’s sensitive permissions', () => {
    expect(Object.keys(ACCESS_MATRIX).sort()).toEqual(['exclusive_roles', 'permissions', 'roles'])
    const sensitiveLine = doc.slice(doc.indexOf('Sensitive: '), doc.indexOf('\n\n', doc.indexOf('Sensitive: ')))
    const listed = sensitiveLine.replace('Sensitive: ', '').replace(/\.$/, '').split(/,\s*/).map((s) => s.trim())
    expect(ACCESS_MATRIX.permissions.filter((p) => p.sensitive).map((p) => p.id).sort()).toEqual(listed.sort())
    expect(ACCESS_MATRIX.exclusive_roles).toEqual(['sales', 'engineer', 'operations'])
    const admin = ACCESS_MATRIX.roles.find((r) => r.id === 'admin')!
    expect(admin.permissions).not.toContain('payouts.bank_file.export')
    expect(admin.permissions).toHaveLength(ACCESS_MATRIX.permissions.length - 1)
    expect(ACCESS_MATRIX.roles.find((r) => r.id === 'network_manager')!.can_assign_roles).toEqual(['sales', 'engineer', 'operations'])
  })
})

// ── proxy.ts and robots.ts for the invitation sign-up pages ──────────────────

type Predicate = (req: { nextUrl: { pathname: string } }) => boolean
let predicates: Predicate[] = []
let handler: ((auth: unknown, req: unknown) => unknown) | undefined
vi.mock('@clerk/nextjs/server', () => ({
  createRouteMatcher: (p: Predicate) => { predicates.push(p); return (req: { nextUrl: { pathname: string } }) => p(req) },
  clerkMiddleware: (h: typeof handler) => { handler = h; return h },
}))
const req = (pathname: string) => ({ nextUrl: { pathname, clone: () => new URL(`https://www.gridnova.in${pathname}`) }, url: `https://www.gridnova.in${pathname}`, cookies: { get: () => undefined }, headers: new Headers() })

describe('proxy.ts', () => {
  beforeEach(async () => {
    vi.resetModules()
    predicates = []
    handler = undefined
    await import('@/proxy')
  })
  const [staff, associate] = [0, 1]

  it('/dashboard/sign-up is reachable signed out (an invited person has no session yet)', () => {
    expect(predicates[staff](req('/dashboard/sign-up'))).toBe(false)
    expect(predicates[staff](req('/dashboard/sign-up/verify-email-address'))).toBe(false)
    expect(predicates[staff](req('/dashboard/sign-in'))).toBe(false)
    // …but nothing that merely starts with the same letters.
    expect(predicates[staff](req('/dashboard/sign-upgrade'))).toBe(true)
    expect(predicates[staff](req('/dashboard/employees'))).toBe(true)
  })

  it('/associates/sign-up is reachable signed out in every locale; the portals stay protected', () => {
    for (const p of ['/associates/sign-up', '/hi/associates/sign-up', '/bn/associates/sign-up']) expect(predicates[associate](req(p)), p).toBe(false)
    for (const p of ['/associates/portal', '/hi/associates/portal/earnings']) expect(predicates[associate](req(p)), p).toBe(true)
  })

  it('associate portals still send a signed-out visitor to the associate sign-in, never the staff one', async () => {
    const protect = vi.fn()
    await handler!(Object.assign(vi.fn(), { protect }), req('/associates/portal'))
    expect(protect).toHaveBeenCalledWith({ unauthenticatedUrl: 'https://www.gridnova.in/associates/sign-in' })
  })
})

describe('site chrome', () => {
  it('the associate invitation sign-up is a bare screen like its sign-in (the marketing header covered its home link — visual matrix, 2nd pass)', async () => {
    const { isBareRoute } = await import('@/components/SiteChrome')
    expect(isBareRoute('/associates/sign-up', true)).toBe(true)
    expect(isBareRoute('/associates/sign-up/verify-email-address', true)).toBe(true)
    expect(isBareRoute('/associates/sign-in', true)).toBe(true)
    expect(isBareRoute('/associates/apply', true)).toBe(false)
  })
})

describe('robots.ts', () => {
  it('keeps both invitation sign-up pages out of search results', async () => {
    const { default: robots } = await import('@/app/robots')
    const rules = robots().rules as { disallow: string[] }
    expect(rules.disallow).toContain('/dashboard')
    for (const p of ['/associates/sign-up', '/hi/associates/sign-up', '/bn/associates/sign-up']) expect(rules.disallow).toContain(p)
    expect(rules.disallow).not.toContain('/associates/sign-in')
  })

  it('and both pages carry noindex themselves', async () => {
    const { metadata } = await import('@/app/(site)/[lang]/associates/sign-up/layout')
    expect(metadata.robots).toEqual({ index: false, follow: false })
    // The (internal) root layout loads next/font, so it is read rather than imported.
    expect(readFileSync(path.join(root, 'app/(internal)/layout.tsx'), 'utf8')).toContain('robots: { index: false, follow: false }')
  })
})
