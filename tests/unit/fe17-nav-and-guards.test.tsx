// FE-17: every menu item and page guard reads permissions. Menus per role and per role
// combination (from the real BE-17 matrix), the calm no-access state, and the bank-file
// control that only Admin + Accounts gets.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NAV_ITEMS, visibleNavItems } from '@/lib/dashboard/nav'
import { PERMISSIONS, satisfies } from '@/lib/access/permissions'
import { RequirePermission } from '@/components/dashboard/RequirePermission'
import NoAccess from '@/components/dashboard/NoAccess'
import type { Role } from '@/lib/dashboard/types'
import { asRoles, permissionsFor, permissionsValue } from './helpers/permissions-bridge'
import { ACCESS_MATRIX } from './fixtures/access-matrix'

const menu = (...roles: Role[]) => visibleNavItems(permissionsFor(roles)).map((i) => i.label)
const EVERYONE = ['Overview', 'Ask Nova', 'Project archive', 'Equipment', 'Who can do what']

describe('the menu for each role (BE-17 matrix)', () => {
  it.each<[Role, string[]]>([
    ['admin', ['Overview', 'Leads', 'Onboardings', 'Operations', 'Accounts', 'Commissions', 'Network Command Centre', 'Survey reviews', 'Survey corrections', 'Service requests', 'Attribution Flags', 'Meetings', 'Site Assessments', 'Proposals', 'Analytics', 'Employees', 'Approvals', 'Associate Network', 'Data Checklist', 'Audit Log', 'Ask Nova', 'Project archive', 'Archive import', 'Equipment', 'Price list', 'Agent Control', 'Who can do what']],
    ['management', ['Overview', 'Leads', 'Onboardings', 'Operations', 'Accounts', 'Commissions', 'Network Command Centre', 'Survey reviews', 'Survey corrections', 'Service requests', 'Meetings', 'Proposals', 'Analytics', 'Data Checklist', 'Audit Log', 'Ask Nova', 'Project archive', 'Equipment', 'Price list', 'Who can do what']],
    ['network_manager', ['Overview', 'Leads', 'Onboardings', 'Network Command Centre', 'Survey reviews', 'Survey corrections', 'Attribution Flags', 'Proposals', 'Employees', 'Approvals', 'Associate Network', 'Audit Log', 'Ask Nova', 'Project archive', 'Equipment', 'Price list', 'Who can do what']],
    ['sales', ['Overview', 'Leads', 'Onboardings', 'Survey reviews', 'Survey corrections', 'Service requests', 'Meetings', 'Site Assessments', 'Proposals', 'Analytics', 'Ask Nova', 'Project archive', 'Equipment', 'Price list', 'Who can do what']],
    ['engineer', ['Overview', 'Leads', 'Operations', 'Survey reviews', 'Survey corrections', 'Service requests', 'Proposals', 'Ask Nova', 'Project archive', 'Equipment', 'Who can do what']],
    ['operations', ['Overview', 'Operations', 'Service requests', 'Ask Nova', 'Project archive', 'Equipment', 'Who can do what']],
    ['accounts', ['Overview', 'Accounts', 'Commissions', 'Approvals', 'Ask Nova', 'Project archive', 'Equipment', 'Who can do what']],
  ])('%s', (role, expected) => {
    expect(menu(role)).toEqual(expected)
  })

  it('the Network Manager gets the associate-network pages and Employees, but no money, settings or approvals of proposals', () => {
    const nm = menu('network_manager')
    for (const l of ['Associate Network', 'Employees', 'Attribution Flags', 'Network Command Centre', 'Onboardings']) expect(nm).toContain(l)
    for (const l of ['Accounts', 'Commissions', 'Agent Control', 'Data Checklist', 'Archive import']) expect(nm).not.toContain(l)
  })

  it('roles combine: the menu is the union of each role’s menu', () => {
    const both = menu('admin', 'accounts')
    expect(both).toEqual(menu('admin'))
    expect(menu('sales', 'accounts')).toEqual(NAV_ITEMS.map((i) => i.label).filter((l) => menu('sales').includes(l) || menu('accounts').includes(l)))
    expect(menu('engineer', 'network_manager')).toContain('Employees')
    expect(menu('engineer', 'network_manager')).toContain('Operations')
  })

  it('before the server has answered only the everyone-items show', () => {
    expect(menu()).toEqual(EVERYONE)
  })

  it('no menu item names a role: each declares permission ids the matrix knows', () => {
    const known = new Set(ACCESS_MATRIX.permissions.map((p) => p.id))
    for (const item of NAV_ITEMS) {
      const ids = item.needs === 'any_staff' ? [] : typeof item.needs === 'string' ? [item.needs] : [...item.needs]
      for (const id of ids) expect(known.has(id), `${item.label}: ${id}`).toBe(true)
      expect(Object.keys(item)).not.toContain('roles')
    }
  })
})

describe('the typed permission list matches the matrix', () => {
  it('every BE-17 permission is known to the dashboard, and nothing else', () => {
    expect([...PERMISSIONS].sort()).toEqual(ACCESS_MATRIX.permissions.map((p) => p.id).sort())
  })
  it('satisfies() — one id, any of several, any staff', () => {
    const g = new Set(['leads.create'])
    expect(satisfies(g, 'leads.create')).toBe(true)
    expect(satisfies(g, ['staff.manage', 'leads.create'])).toBe(true)
    expect(satisfies(g, ['staff.manage'])).toBe(false)
    expect(satisfies(new Set(), 'any_staff')).toBe(true)
  })
})

describe('page guards', () => {
  it('shows the page to someone with the permission', () => {
    render(asRoles(['network_manager'], <RequirePermission rule="staff.manage" what="Employees"><p>the page</p></RequirePermission>))
    expect(screen.getByText('the page')).toBeInTheDocument()
  })

  it('shows the calm no-access state (with the way to ask) instead of a broken page', () => {
    render(asRoles(['sales'], <RequirePermission rule="staff.manage" what="Employees"><p>the page</p></RequirePermission>))
    expect(screen.queryByText('the page')).not.toBeInTheDocument()
    const box = screen.getByTestId('no-access')
    expect(box).toHaveTextContent('You don’t have access to this — ask an Admin')
    expect(box).toHaveTextContent('Employees isn’t part of what your roles allow')
    expect(screen.getByRole('link', { name: 'See who can do what' })).toHaveAttribute('href', '/dashboard/access')
  })

  it('shows a skeleton, never the page, while the permissions load', async () => {
    const mod = await import('@/lib/access/use-permissions')
    const spy = vi.spyOn(mod, 'usePermissions').mockReturnValue(permissionsValue(['admin'], { isLoaded: false }))
    render(<RequirePermission rule="staff.manage" what="Employees"><p>the page</p></RequirePermission>)
    expect(screen.getByTestId('permissions-loading')).toBeInTheDocument()
    expect(screen.queryByText('the page')).not.toBeInTheDocument()
    spy.mockRestore()
  })

  it('NoAccess names what was refused', () => {
    render(<NoAccess what="The price list" />)
    expect(screen.getByTestId('no-access')).toHaveTextContent('The price list isn’t part of what your roles allow')
  })
})
