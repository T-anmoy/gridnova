// FE-17: no screen decides access from a role name in the browser. This scan fails when
// any staff-dashboard source names a role id in a string — a comparison (`role ===
// 'admin'`), a role list (`['admin', 'sales']`) or a lookup — outside the one file that
// labels roles for display (lib/access/roles.ts). Decisions use permissions from
// GET /employees/me (usePermissions().can).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const ROLE_IDS = ['admin', 'management', 'network_manager', 'sales', 'engineer', 'operations', 'accounts', 'proposal_desk']
const SCANNED = ['app/(internal)', 'components/dashboard', 'components/auth', 'lib/dashboard', 'lib/access', 'lib/commissions', 'lib/nova', 'lib/proposals', 'lib/auth', 'lib/studio', 'proxy.ts']

/** Files allowed to name roles, and why. Keep this list short. */
const ALLOWED: Record<string, string> = {
  'lib/access/roles.ts': 'the single mapping file that labels roles for display',
  'lib/dashboard/types.ts': 'the Role type union itself (a type, not a decision)',
}

/** Same word, different thing — matched by the exact line content. */
const NOT_A_ROLE: { file: string; line: RegExp; why: string }[] = [
  { file: 'lib/commissions/rates.ts', line: /^\s*sales: 'sales',$/, why: 'an associate capability token in a commission rate key' },
]

function files(rel: string): string[] {
  const abs = path.join(root, rel)
  if (statSync(abs).isFile()) return [rel]
  // posix: the file names below are compared with '/', also on Windows
  return readdirSync(abs).flatMap((f) => files(path.posix.join(rel, f)))
}

const LITERAL = new RegExp(`(['"\`])(${ROLE_IDS.join('|')})\\1`)

export function roleLiterals(source: string, file: string): string[] {
  return source.split('\n').flatMap((line, i) => {
    if (!LITERAL.test(line)) return []
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return [] // comments may talk about roles
    if (NOT_A_ROLE.some((n) => n.file === file && n.line.test(line))) return []
    return [`${file}:${i + 1}: ${line.trim()}`]
  })
}

describe('no role-name decisions in the dashboard', () => {
  const sources = SCANNED.flatMap(files).filter((f) => /\.(ts|tsx)$/.test(f) && !ALLOWED[f])

  it('scans the dashboard code (sanity)', () => {
    expect(sources.length).toBeGreaterThan(150)
    expect(sources).toContain('app/(internal)/dashboard/layout.tsx')
    expect(sources).toContain('lib/dashboard/nav.ts')
  })

  it('names no role id outside lib/access/roles.ts', () => {
    const hits = sources.flatMap((f) => roleLiterals(readFileSync(path.join(root, f), 'utf8'), f))
    expect(hits).toEqual([])
  })

  it('reads Clerk public_metadata only as the first-paint hint (lib/access)', () => {
    const hits = sources.filter((f) => /publicMetadata/.test(readFileSync(path.join(root, f), 'utf8')))
    expect(hits).toEqual(['lib/access/use-permissions.ts'])
  })

  it('the scan really catches a comparison, a role list and a lookup (guards the guard)', () => {
    expect(roleLiterals(`const isAdmin = role === 'admin'`, 'x.ts')).toHaveLength(1)
    expect(roleLiterals(`const R = ["sales", "engineer"]`, 'x.ts')).toHaveLength(1)
    expect(roleLiterals('if (r === `network_manager`) go()', 'x.ts')).toHaveLength(1)
    expect(roleLiterals(`// role === 'admin' in a comment is fine`, 'x.ts')).toHaveLength(0)
    expect(roleLiterals(`const can = can('staff.manage')`, 'x.ts')).toHaveLength(0)
  })
})
