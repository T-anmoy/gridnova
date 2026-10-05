import { describe, it, expect } from 'vitest'
import { NAV_ITEMS, canSeeNavItem, queueBadgeCount, visibleNavItems } from '@/lib/dashboard/nav'
import { canRecordPayments, canSeePayments } from '@/lib/dashboard/payments-api-client'
import type { Role } from '@/lib/dashboard/types'

const labels = (role: Role | undefined) => visibleNavItems(role).map((i) => i.label)

describe('role gating of the new nav items', () => {
  it.each([
    ['admin', ['Operations', 'Accounts', 'Data Checklist']],
    ['management', ['Operations', 'Accounts', 'Data Checklist']],
    ['operations', ['Operations']],
    ['engineer', ['Operations']],
    ['accounts', ['Accounts']],
    ['sales', []],
  ] as const)('%s sees %j of the new items', (role, expected) => {
    const newOnes = ['Operations', 'Accounts', 'Data Checklist']
    expect(labels(role).filter((l) => newOnes.includes(l))).toEqual(expected)
  })

  it('shows no new item when the role is unknown', () => {
    expect(labels(undefined).filter((l) => ['Operations', 'Accounts', 'Data Checklist'].includes(l))).toEqual([])
  })

  it('Operations and engineers never get an Accounts nav item', () => {
    for (const role of ['operations', 'engineer'] as Role[]) expect(labels(role)).not.toContain('Accounts')
  })

  it('every new nav href is unique and under /dashboard', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    expect(hrefs.every((h) => h.startsWith('/dashboard'))).toBe(true)
  })

  it('canSeeNavItem honours an "all" item for any role', () => {
    expect(canSeeNavItem(NAV_ITEMS.find((i) => i.label === 'Overview')!, undefined)).toBe(true)
  })
})

describe('payment role helpers', () => {
  it('Operations and engineers see and record nothing; sales record but are not Accounts; management reads', () => {
    expect(canSeePayments('operations')).toBe(false)
    expect(canSeePayments('engineer')).toBe(false)
    expect(canSeePayments(undefined)).toBe(false)
    expect(canRecordPayments('sales')).toBe(true)
    expect(canRecordPayments('management')).toBe(false)
    expect(canSeePayments('management')).toBe(true)
    expect(canRecordPayments('accounts')).toBe(true)
  })
})

describe('queueBadgeCount', () => {
  it('sums every queue the role’s response contains, and is 0 for an absent area', () => {
    const q = {
      execution: { pending_stage_verifications: 2, stuck_projects: 1, dcr_mismatch: 3 },
      payments: { awaiting_verification: 4, dishonoured: 1, receipts_held: 2, receipts_without_email: 0, overdue_milestones: 5 },
    }
    expect(queueBadgeCount('execution', q)).toBe(6)
    expect(queueBadgeCount('payments', q)).toBe(12)
    expect(queueBadgeCount('payments', { execution: q.execution })).toBe(0)
    expect(queueBadgeCount('execution', undefined)).toBe(0)
  })
})
