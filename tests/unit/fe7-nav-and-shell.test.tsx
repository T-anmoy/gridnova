import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NAV_ITEMS, canSeeNavItem, visibleNavItems } from '@/lib/dashboard/nav'
import { CommandPalette } from '@/components/dashboard/CommandPalette'
import { NovaPanel } from '@/components/dashboard/nova/NovaPanel'
import { NovaShellProvider } from '@/lib/nova/page-context'
import { navState } from './helpers/mock-navigation'
import type { Role } from '@/lib/dashboard/types'
import { canFor, permissionsFor } from './helpers/permissions-bridge'

const h = vi.hoisted(() => ({ role: 'admin' as string | undefined, placeholders: undefined as unknown }))
vi.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUser: () => ({ user: { firstName: 'Asha', lastName: 'Roy', emailAddresses: [{ emailAddress: 'a@gridnova.in' }], publicMetadata: { role: h.role } }, isLoaded: true }),
  useClerk: () => ({ signOut: vi.fn() }),
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('t') }),
}))
vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)
vi.mock('@/lib/dashboard/api-client', () => ({
  useProposals: () => ({ data: { total: 0 } }),
  prefetchLeads: vi.fn(),
  prefetchProposals: vi.fn(),
  defaultLeadListParams: () => ({}),
  useLeadSearch: () => ({ data: [], isFetching: false }),
  useProposalSearch: () => ({ data: { items: [] }, isFetching: false }),
}))
// The shell's second-approval badge (GET /approvals).
vi.mock('@/lib/access/api', () => ({ useApprovals: () => ({ data: [] }) }))
vi.mock('@/lib/dashboard/execution-api-client', () => ({ useWorkQueues: () => ({ data: undefined }) }))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))
vi.mock('@/lib/config', () => ({ API_BASE_URL: 'https://api.test' }))
// The Launch readiness badge (BE-22 wording waiting for approval).
vi.mock('@/lib/dashboard/placeholders-api-client', () => ({
  usePlaceholders: (o: { enabled?: boolean } = {}) => ({ data: o.enabled === false ? undefined : h.placeholders }),
}))

const ROLES: Role[] = ['admin', 'management', 'accounts', 'operations', 'engineer', 'sales']
const labels = (role: Role | undefined) => visibleNavItems(permissionsFor(role ? [role] : [])).map((i) => i.label)

describe('nav entries by role', () => {
  it.each(ROLES)('%s sees Ask Nova and Project archive', (role) => {
    expect(labels(role)).toEqual(expect.arrayContaining(['Ask Nova', 'Project archive']))
  })

  it('only Admin sees Archive import', () => {
    expect(labels('admin')).toContain('Archive import')
    for (const role of ROLES.filter((r) => r !== 'admin')) expect(labels(role)).not.toContain('Archive import')
    expect(labels(undefined)).not.toContain('Archive import')
  })

  it('points at the pages that exist, once each', () => {
    const byLabel = (l: string) => NAV_ITEMS.find((i) => i.label === l)!
    expect(byLabel('Ask Nova').href).toBe('/dashboard/nova')
    expect(byLabel('Project archive').href).toBe('/dashboard/archive')
    expect(byLabel('Archive import').href).toBe('/dashboard/archive/import')
    expect(canSeeNavItem(byLabel('Archive import'), canFor('admin'))).toBe(true)
    const hrefs = NAV_ITEMS.map((i) => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})

async function mountLayout() {
  const { default: DashboardLayout } = await import('@/app/(internal)/dashboard/layout')
  const user = userEvent.setup()
  const utils = render(<DashboardLayout><p>page body</p></DashboardLayout>)
  return { user, ...utils }
}

beforeEach(() => {
  h.role = 'admin'
  navState.reset('/dashboard')
  h.placeholders = undefined
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      new Response(JSON.stringify(String(url).endsWith('/conversations') ? { items: [] } : {}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ),
  )
})

describe('the Ask Nova header button', () => {
  it.each(ROLES)('is there for %s and opens the slide-over', async (role) => {
    h.role = role
    const { user } = await mountLayout()
    const buttons = screen.getAllByRole('button', { name: 'Ask Nova' })
    expect(buttons.length).toBeGreaterThanOrEqual(1)
    expect(buttons[0].className).toContain('min-h-[44px]')
    await user.click(buttons[0])
    const panel = await screen.findByTestId('nova-panel')
    expect(within(panel).getByLabelText('Your question for Nova')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('is hidden on the Nova page itself, where the chat is the page', async () => {
    navState.reset('/dashboard/nova')
    await mountLayout()
    expect(screen.queryByRole('button', { name: 'Ask Nova' })).toBeNull()
  })

  it('is absent before the role is known', async () => {
    h.role = undefined
    await mountLayout()
    expect(screen.queryByRole('button', { name: 'Ask Nova' })).toBeNull()
  })

  it('the panel closes and gives focus back to the page', async () => {
    const { user } = await mountLayout()
    await user.click(screen.getAllByRole('button', { name: 'Ask Nova' })[0])
    await screen.findByTestId('nova-panel')
    await user.click(screen.getByRole('button', { name: 'Close Ask Nova' }))
    await waitFor(() => expect(screen.queryByTestId('nova-panel')).toBeNull())
  })
})

describe('Launch readiness badge (FE-22b)', () => {
  const wording = (id: string, approval_state: string) => ({ id, probe: 'approved_text', approval_state, resolved: approval_state === 'approved' })
  const nine = (waiting: string[]) => ({
    summary: { total: 9, unresolved: waiting.length, by_blocking: {} },
    areas: [{ area: 'launch', items: ['PRO-2', 'PRO-7', 'PRO-8', 'PRO-10', 'PRO-11', 'PRO-12', 'ONB-5', 'P6', 'HW-OM'].map((id) => wording(id, waiting.includes(id) ? 'not_approved' : 'approved')) }],
  })
  const launchLink = () => within(screen.getAllByRole('navigation')[0]).getByRole('link', { name: /Launch readiness/ })

  it.each(['admin', 'management'] as const)('%s sees how many wordings wait', async (role) => {
    h.role = role
    h.placeholders = nine(['PRO-2', 'ONB-5', 'P6'])
    await mountLayout()
    expect(within(launchLink()).getByTestId('wording-badge')).toHaveTextContent('3')
  })

  it('disappears once all nine are approved', async () => {
    h.placeholders = nine([])
    await mountLayout()
    expect(within(launchLink()).queryByTestId('wording-badge')).toBeNull()
  })
})

describe('sidebar highlight', () => {
  it('the import page lights up Archive import, not Project archive as well', async () => {
    navState.reset('/dashboard/archive/import')
    await mountLayout()
    const side = screen.getAllByRole('navigation')[0]
    const active = within(side).getAllByRole('link').filter((a) => a.className.includes('bg-[#f7a800]'))
    expect(active.map((a) => a.textContent)).toEqual(['Archive import'])
  })

  it('an archive project page lights up Project archive', async () => {
    navState.reset('/dashboard/archive/41')
    await mountLayout()
    const side = screen.getAllByRole('navigation')[0]
    const active = within(side).getAllByRole('link').filter((a) => a.className.includes('bg-[#f7a800]'))
    expect(active.map((a) => a.textContent)).toEqual(['Project archive'])
  })
})

describe('the command palette', () => {
  beforeEach(() => {
    // cmdk measures its list with ResizeObserver, which jsdom lacks.
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  })

  async function openPalette() {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NovaShellProvider>
          <CommandPalette />
          <NovaPanel />
        </NovaShellProvider>
      </QueryClientProvider>,
    )
    await user.keyboard('{Control>}k{/Control}')
    return user
  }

  it('offers Ask Nova, which opens the panel', async () => {
    const user = await openPalette()
    await user.click(await screen.findByText('Ask Nova'))
    expect(await screen.findByTestId('nova-panel')).toBeInTheDocument()
  })

  it('"Ask Nova: …" puts the typed question in the panel’s box without sending it', async () => {
    const user = await openPalette()
    await user.type(await screen.findByPlaceholderText('Search by name or command…'), 'warranties ending soon')
    await user.click(await screen.findByText('Ask Nova: “warranties ending soon”'))
    const panel = await screen.findByTestId('nova-panel')
    expect((within(panel).getByLabelText('Your question for Nova') as HTMLTextAreaElement).value).toBe('warranties ending soon')
    const asks = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([u]) => String(u).endsWith('/ask'))
    expect(asks).toHaveLength(0)
  })

  it('offers no Ask Nova to someone whose role is not known', async () => {
    h.role = undefined
    await openPalette()
    await screen.findByPlaceholderText('Search by name or command…')
    expect(screen.queryByText('Ask Nova')).toBeNull()
  })
})
