import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DataChecklistPage from '@/app/(internal)/dashboard/data-checklist/page'
import { buildGridNovaMessage } from '@/lib/dashboard/placeholders'
import { ApiError } from '@/lib/dashboard/api-error'
import { withI18n } from './helpers/i18n'
import type { PlaceholderItem, PlaceholdersResponse } from '@/lib/dashboard/placeholders-api-client'

const h = vi.hoisted(() => ({
  role: { role: 'admin' as string | undefined, isLoaded: true },
  state: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  resolve: vi.fn(),
  refetch: vi.fn(),
  calls: 0,
}))
vi.mock('@/lib/access/use-permissions', async () => {
  const { permissionsValue } = await import('./helpers/permissions-bridge')
  // The signed-in role (h.role) as the BE-17 permissions it holds.
  return { usePermissions: () => { const r = h.role as { role?: string; isLoaded?: boolean }; return permissionsValue(r.role ? [r.role as never] : [], { isLoaded: r.isLoaded ?? true }) } }
})
vi.mock('@/lib/dashboard/placeholders-api-client', () => ({
  usePlaceholders: () => ((h.calls += 1), { ...h.state, refetch: h.refetch }),
  useResolvePlaceholder: () => ({ mutateAsync: h.resolve }),
  useApproveWording: () => ({ mutateAsync: vi.fn() }),
  useRevokeWording: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 't' }), useClerk: () => ({ signOut: vi.fn() }) }))

const item = (over: Partial<PlaceholderItem>): PlaceholderItem => ({
  id: 'CMP-1',
  area: 'company',
  location: 'config/proposal_content.yaml → company.gstin',
  description: 'Company GSTIN',
  dummy_value: '[PLACEHOLDER]',
  needed_from_grid_nova: "What is Grid Nova's GSTIN?",
  blocking: 'blocks_launch',
  probe: 'placeholder_marker',
  resolved: false,
  probe_error: null,
  resolution: null,
  ...over,
})

const data = (): PlaceholdersResponse => ({
  summary: {
    total: 4,
    unresolved: 3,
    by_blocking: { blocks_launch: { total: 2, unresolved: 2 }, blocks_feature: { total: 1, unresolved: 1 }, tunable: { total: 1, unresolved: 0 } },
  },
  areas: [
    { area: 'company', items: [item({})] },
    {
      area: 'pricing',
      items: [
        item({ id: 'PRC-14', area: 'pricing', description: 'Margin thresholds', blocking: 'blocks_feature', needed_from_grid_nova: 'Below what margin should a proposal be flagged?' }),
        item({ id: 'PRC-11', area: 'pricing', description: 'Offset', blocking: 'tunable', resolved: true, needed_from_grid_nova: 'What share should a system cover?', resolution: { resolved_by: 'admin@x', resolved_at: '2026-03-01T00:00:00Z', note: 'Confirmed 90%' } }),
      ],
    },
    { area: 'policies', items: [item({ id: 'A1', area: 'policies', blocking: 'blocks_feature', probe: 'manual', needed_from_grid_nova: 'May Grid Nova email associates?' })] },
  ],
})

beforeEach(() => {
  h.role = { role: 'admin', isLoaded: true }
  h.state = { data: data() }
  h.calls = 0
  h.resolve.mockReset()
  h.refetch.mockReset()
})

describe('Launch readiness page', () => {
  it('is only for admin and management; other roles make no request', () => {
    h.role = { role: 'sales', isLoaded: true }
    render(withI18n(<DataChecklistPage />))
    expect(screen.getByTestId('no-access')).toBeInTheDocument()
    expect(h.calls).toBe(0)
  })

  it('groups by area and shows counts by blocking level', () => {
    render(withI18n(<DataChecklistPage />))
    expect(screen.getAllByTestId('checklist-area').map((a) => within(a).getByRole('heading').textContent)).toEqual(['Company (1)', 'Pricing (1)', 'Policies (1)'])
    const summary = screen.getByTestId('blocking-summary')
    expect(summary).toHaveTextContent('Blocks launch')
    expect(summary).toHaveTextContent('2 of 2 open')
    expect(summary).toHaveTextContent('1 of 1 open')
    expect(summary).toHaveTextContent('0 of 1 open')
  })

  it('shows each unresolved row with its dummy value, the needed-from sentence and the Dummy chip', () => {
    render(withI18n(<DataChecklistPage />))
    const row = screen.getAllByTestId('checklist-item')[0]
    expect(row).toHaveTextContent('[PLACEHOLDER]')
    expect(row).toHaveTextContent("Needed from Grid Nova: What is Grid Nova's GSTIN?")
    expect(within(row).getByTestId('dummy-chip')).toHaveTextContent('Dummy / pending Grid Nova')
  })

  it('filters to unresolved only by default, and shows resolved rows when the filter is off', async () => {
    render(withI18n(<DataChecklistPage />))
    expect(screen.queryByText('Margin thresholds') && screen.queryByText('Offset')).toBeNull()
    expect(screen.queryByText('Offset')).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Unresolved only' }))
    expect(screen.getByText('Offset')).toBeInTheDocument()
    expect(screen.getByText(/Confirmed 90%/)).toBeInTheDocument()
  })

  it('offers Mark resolved only for manual entries, and only to an Admin', async () => {
    const { unmount } = render(withI18n(<DataChecklistPage />))
    const buttons = screen.getAllByRole('button', { name: 'Mark resolved' })
    expect(buttons).toHaveLength(1)
    expect(within(buttons[0].closest('li')!).getByText('A1')).toBeInTheDocument()
    unmount()
    h.role = { role: 'management', isLoaded: true }
    render(withI18n(<DataChecklistPage />))
    expect(screen.queryByRole('button', { name: 'Mark resolved' })).toBeNull()
  })

  it('resolving needs a note and sends it; not_manual is explained in plain words', async () => {
    h.resolve.mockRejectedValueOnce(new ApiError(409, 'x', 'nm', { code: 'not_manual' }))
    const user = userEvent.setup()
    render(withI18n(<DataChecklistPage />))
    await user.click(screen.getByRole('button', { name: 'Mark resolved' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Mark resolved' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Note/), 'Grid Nova agreed in writing')
    await user.click(confirm)
    expect(h.resolve).toHaveBeenCalledWith({ id: 'A1', note: 'Grid Nova agreed in writing' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('resolves itself when its value is edited')
  })

  it('copies a clean plain-text message of the unresolved rows', async () => {
    const user = userEvent.setup() // user-event installs its own clipboard stub, so override it afterwards
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(withI18n(<DataChecklistPage />))
    await user.click(screen.getByRole('button', { name: /Copy as message to Grid Nova/ }))
    expect(writeText).toHaveBeenCalledTimes(1)
    const text = writeText.mock.calls[0][0] as string
    expect(text).toContain("[CMP-1 · needed before launch] What is Grid Nova's GSTIN?")
    expect(text).toContain('[PRC-14] Below what margin should a proposal be flagged?')
    expect(text).not.toContain('What share should a system cover?') // resolved
    expect(await screen.findByRole('status')).toHaveTextContent('Copied')
  })

  it('shows loading and error-with-Retry states', async () => {
    h.state = { isLoading: true }
    const { unmount, container } = render(withI18n(<DataChecklistPage />))
    expect(container.querySelector('[class*="animate-pulse"]')).not.toBeNull()
    unmount()
    h.state = { error: new ApiError(500, 'x', 'boom') }
    render(withI18n(<DataChecklistPage />))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(h.refetch).toHaveBeenCalled()
  })
})

describe('buildGridNovaMessage', () => {
  it('lists only unresolved items, grouped by area, with a count', () => {
    const text = buildGridNovaMessage(data())
    expect(text.split('\n')[0]).toBe('Grid Nova — information we still need from you (3 items)')
    expect(text).toContain('COMPANY\n1. [CMP-1 · needed before launch]')
    expect(text).toContain('PRICING\n1. [PRC-14]')
    expect(text).toContain('POLICIES\n1. [A1]')
  })
  it('says so when everything is resolved', () => {
    const d = data()
    d.areas.forEach((a) => a.items.forEach((i) => (i.resolved = true)))
    expect(buildGridNovaMessage(d)).toMatch(/Nothing is outstanding/)
  })
})
