import { describe, it, expect } from 'vitest'
import { visibleNavItems } from '@/lib/dashboard/nav'
import type { Role } from '@/lib/dashboard/types'
import { permissionsFor } from './helpers/permissions-bridge'

const labels = (role: Role | undefined) => visibleNavItems(permissionsFor(role ? [role] : [])).map((i) => i.label)

describe('FE-4 nav items follow the backend’s permissions', () => {
  it.each([
    ['admin', true],
    ['management', true],
    ['accounts', true],
    ['sales', false],
    ['engineer', false],
    ['operations', false],
  ] as const)('Commissions for %s: %s', (role, shown) => {
    expect(labels(role).includes('Commissions')).toBe(shown)
  })

  it.each([
    ['admin', true],
    ['management', true],
    ['accounts', false],
    ['sales', false],
    ['engineer', false],
    ['operations', false],
  ] as const)('Network Command Centre for %s: %s', (role, shown) => {
    expect(labels(role).includes('Network Command Centre')).toBe(shown)
  })

  it('an unknown role sees none of them', () => {
    const l = labels(undefined)
    for (const label of ['Commissions', 'Network Command Centre', 'Service requests']) expect(l).not.toContain(label)
  })
})
