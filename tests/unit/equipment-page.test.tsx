import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EquipmentPage from '@/app/(internal)/dashboard/equipment/page'
import type { Equipment } from '@/lib/dashboard/types'

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

const mockUseUser = vi.fn()
vi.mock('@clerk/nextjs', () => ({ useUser: () => mockUseUser() }))

const mockUseEquipment = vi.fn()
const mockCreateMutateAsync = vi.fn()
const mockSetActiveMutateAsync = vi.fn()

vi.mock('@/lib/dashboard/api-client', () => ({
  useEquipment: (params: unknown) => mockUseEquipment(params),
  useCreateEquipment: () => ({ mutateAsync: mockCreateMutateAsync, isPending: false }),
  useSetEquipmentActive: () => ({ mutateAsync: mockSetActiveMutateAsync, isPending: false }),
}))

const ITEM: Equipment = {
  id: 1,
  category: 'module',
  brand: 'Waaree',
  model_name: 'Vertex-540',
  specification: '540W monocrystalline, 21.5% efficiency',
  is_dcr_compliant: true,
  procurement_price_inr: 12500,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

const INACTIVE_ITEM: Equipment = {
  ...ITEM,
  id: 2,
  brand: 'Growatt',
  model_name: 'MIN-5000',
  category: 'inverter',
  is_dcr_compliant: false,
  is_active: false,
}

// jsdom doesn't implement pointer-capture or scrollIntoView, which Radix
// Select's trigger relies on — without these, opening the dropdown throws.
beforeEach(() => {
  vi.clearAllMocks()
  mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('EquipmentPage — DOM validity (real, unmocked component tree)', () => {
  it('does not produce invalid-nesting DOM warnings when the catalog is empty', () => {
    mockUseEquipment.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<EquipmentPage />)

    const nestingWarnings = spy.mock.calls.filter((args) => String(args[0]).includes('cannot be a descendant of'))
    spy.mockRestore()
    expect(nestingWarnings).toEqual([])
  })

  it('does not produce invalid-nesting DOM warnings with populated rows and the Add dialog open', async () => {
    mockUseEquipment.mockReturnValue({ data: [ITEM, INACTIVE_ITEM], isLoading: false, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const user = userEvent.setup()
    render(<EquipmentPage />)
    await user.click(screen.getByRole('button', { name: /add equipment/i }))
    await screen.findByRole('dialog')

    const nestingWarnings = spy.mock.calls.filter((args) => String(args[0]).includes('cannot be a descendant of'))
    spy.mockRestore()
    expect(nestingWarnings).toEqual([])
  })
})

describe('EquipmentPage — behaviour', () => {
  it('shows the rich empty state, with an Admin CTA, when the catalog is genuinely empty', () => {
    mockUseEquipment.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() })
    render(<EquipmentPage />)
    expect(screen.getByText('No equipment yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add the first item/i })).toBeInTheDocument()
  })

  it('hides the Admin CTA from the empty state for non-admin roles', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'sales' } } })
    mockUseEquipment.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() })
    render(<EquipmentPage />)
    expect(screen.getByText('No equipment yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add the first item/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^add equipment$/i })).not.toBeInTheDocument()
  })

  it('shows a lighter "no matches" row (not the rich empty state) once a filter is applied and matches nothing', async () => {
    mockUseEquipment.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() })
    const user = userEvent.setup()
    render(<EquipmentPage />)
    expect(screen.getByText('No equipment yet')).toBeInTheDocument()

    // No accessible name on these triggers (matches the existing pattern
    // elsewhere in this codebase, e.g. the Leads page filters) — the category
    // filter is the first of the two filter comboboxes in DOM order.
    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(await screen.findByRole('option', { name: 'Inverter' }))

    expect(screen.queryByText('No equipment yet')).not.toBeInTheDocument()
    expect(screen.getByText('No equipment matches these filters')).toBeInTheDocument()
  })

  it('hides admin-only actions and the Add button entirely for non-admin roles', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'engineer' } } })
    mockUseEquipment.mockReturnValue({ data: [ITEM], isLoading: false, error: null, refetch: vi.fn() })
    render(<EquipmentPage />)
    expect(screen.getByText('Waaree')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^add equipment$/i })).not.toBeInTheDocument()
  })

  it('shows the Procurement Price column, header and cells, for Admin', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
    mockUseEquipment.mockReturnValue({ data: [ITEM], isLoading: false, error: null, refetch: vi.fn() })
    render(<EquipmentPage />)

    expect(screen.getByText('Procurement Price')).toBeInTheDocument()
    expect(screen.getByText('₹12,500')).toBeInTheDocument()
  })

  it('omits the Procurement Price column entirely (not just blank) for non-admin roles', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'engineer' } } })
    mockUseEquipment.mockReturnValue({ data: [ITEM], isLoading: false, error: null, refetch: vi.fn() })
    render(<EquipmentPage />)

    expect(screen.getByText('Waaree')).toBeInTheDocument()
    expect(screen.queryByText('Procurement Price')).not.toBeInTheDocument()
    expect(screen.queryByText('₹12,500')).not.toBeInTheDocument()
    expect(screen.queryByText('(internal)')).not.toBeInTheDocument()
  })

  it('deactivates an active item with no confirmation dialog, and reactivates an inactive one', async () => {
    mockUseEquipment.mockReturnValue({ data: [ITEM, INACTIVE_ITEM], isLoading: false, error: null, refetch: vi.fn() })
    mockSetActiveMutateAsync.mockResolvedValue({ ...ITEM, is_active: false })
    const user = userEvent.setup()
    render(<EquipmentPage />)

    await user.click(screen.getByRole('button', { name: /^deactivate$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(mockSetActiveMutateAsync).toHaveBeenCalledWith({ id: 1, isActive: false }))
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('deactivated'))

    await user.click(screen.getByRole('button', { name: /^reactivate$/i }))
    await waitFor(() => expect(mockSetActiveMutateAsync).toHaveBeenCalledWith({ id: 2, isActive: true }))
  })

  it('adds a new equipment item through the Add dialog', async () => {
    mockUseEquipment.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() })
    mockCreateMutateAsync.mockResolvedValue({ ...ITEM, id: 3 })
    const user = userEvent.setup()
    render(<EquipmentPage />)

    await user.click(screen.getByRole('button', { name: /add the first item/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/brand/i), 'Waaree')
    await user.type(within(dialog).getByLabelText(/model name/i), 'Vertex-540')
    // Radix Select is a listbox, not a native <select> — open it and pick an
    // option. The dialog's own category combobox is the only one within it.
    await user.click(within(dialog).getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Module' }))

    await user.click(screen.getByRole('button', { name: /^add equipment$/i }))

    await waitFor(() =>
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'module', brand: 'Waaree', model_name: 'Vertex-540' })
      )
    )
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('Waaree Vertex-540'))
  })
})
