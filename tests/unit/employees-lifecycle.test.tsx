import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmployeesPage from '@/app/(internal)/dashboard/employees/page'
import { ApiError } from '@/lib/dashboard/api-error'
import type { Employee } from '@/lib/dashboard/types'

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: { publicMetadata: { role: 'admin' } } }),
}))

const mockUseEmployees = vi.fn()
const mockUpdateRoleMutateAsync = vi.fn()
const mockDeactivateMutateAsync = vi.fn()
const mockReactivateMutateAsync = vi.fn()

vi.mock('@/lib/dashboard/api-client', () => ({
  useEmployees: () => mockUseEmployees(),
  useUpdateEmployeeRole: () => ({ mutateAsync: mockUpdateRoleMutateAsync, isPending: false }),
  useDeactivateEmployee: () => ({ mutateAsync: mockDeactivateMutateAsync, isPending: false }),
  useReactivateEmployee: () => ({ mutateAsync: mockReactivateMutateAsync, isPending: false }),
}))

const ACTIVE_EMPLOYEE: Employee = {
  id: 'emp-sales-1',
  name: 'Ravi Sharma',
  email: 'ravi@example.com',
  role: 'sales',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

const INACTIVE_EMPLOYEE: Employee = {
  id: 'emp-sales-2',
  name: 'Meera Iyer',
  email: 'meera@example.com',
  role: 'sales',
  is_active: false,
  created_at: '2026-01-02T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseEmployees.mockReturnValue({
    data: [ACTIVE_EMPLOYEE, INACTIVE_EMPLOYEE],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  // jsdom doesn't implement pointer-capture or scrollIntoView, which Radix
  // Select's trigger relies on when opened.
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('EmployeesPage — deactivate/reactivate', () => {
  it('shows an Active/Inactive status badge per employee', () => {
    render(<EmployeesPage />)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('greys out an inactive employee row while keeping it visible', () => {
    render(<EmployeesPage />)
    const row = screen.getByText('Meera Iyer').closest('tr')
    expect(row).toHaveClass('opacity-50')
  })

  it('does not call the deactivate mutation until the confirmation dialog is confirmed', async () => {
    const user = userEvent.setup()
    render(<EmployeesPage />)

    await user.click(screen.getByRole('button', { name: /deactivate/i }))
    expect(mockDeactivateMutateAsync).not.toHaveBeenCalled()

    expect(
      screen.getByText(/no longer be able to sign in.*history and past actions remain fully intact/i)
    ).toBeInTheDocument()
    // The prompt is explicit this must never be called a "delete".
    expect(screen.queryByText(/delete/i)).not.toBeInTheDocument()

    mockDeactivateMutateAsync.mockResolvedValue({ employee_id: 'emp-sales-1', is_active: false })
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }))

    await waitFor(() => expect(mockDeactivateMutateAsync).toHaveBeenCalledWith('emp-sales-1'))
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('Ravi Sharma'))
  })

  it('reactivates an inactive employee with no confirmation dialog', async () => {
    const user = userEvent.setup()
    mockReactivateMutateAsync.mockResolvedValue({ employee_id: 'emp-sales-2', is_active: true })
    render(<EmployeesPage />)

    await user.click(screen.getByRole('button', { name: /reactivate/i }))

    // No dialog should ever appear for reactivation.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(mockReactivateMutateAsync).toHaveBeenCalledWith('emp-sales-2'))
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('Meera Iyer'))
  })

  it('surfaces the backend\'s last-admin guard message, not a generic failure', async () => {
    const user = userEvent.setup()
    mockDeactivateMutateAsync.mockRejectedValue(
      new ApiError(409, 'API error 409', 'Cannot deactivate the last remaining active Admin.')
    )
    render(<EmployeesPage />)

    await user.click(screen.getByRole('button', { name: /deactivate/i }))
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Cannot deactivate the last remaining active Admin.')
    )
  })

  it('offers Subcontractor as a role option, using the exact backend enum string', async () => {
    const user = userEvent.setup()
    render(<EmployeesPage />)

    const roleTriggers = screen.getAllByRole('combobox')
    await user.click(roleTriggers[0])
    const option = await screen.findByRole('option', { name: 'subcontractor' })
    expect(option).toBeInTheDocument()

    mockUpdateRoleMutateAsync.mockResolvedValue({
      employee_id: 'emp-sales-1', role: 'subcontractor', clerk_synced: true, local_mirror: true,
    })
    await user.click(option)
    await user.click(screen.getByRole('button', { name: /^confirm$/i }))

    await waitFor(() =>
      expect(mockUpdateRoleMutateAsync).toHaveBeenCalledWith({ employeeId: 'emp-sales-1', role: 'subcontractor' })
    )
  })
})

describe('EmployeesPage — Calendar connected column', () => {
  it('shows Connected/Not connected per the real google_calendar_connected field', () => {
    mockUseEmployees.mockReturnValue({
      data: [
        { ...ACTIVE_EMPLOYEE, google_calendar_connected: true },
        { ...INACTIVE_EMPLOYEE, google_calendar_connected: false },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<EmployeesPage />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('Not connected')).toBeInTheDocument()
  })
})

describe('EmployeesPage — DOM validity (real, unmocked component tree)', () => {
  it('does not produce invalid-nesting DOM warnings with active/inactive rows, or with either dialog open', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<EmployeesPage />)
    await user.click(screen.getAllByRole('combobox')[0])
    const option = await screen.findByRole('option', { name: 'management' })
    await user.click(option)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    await user.click(screen.getByRole('button', { name: /deactivate/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    const nestingWarnings = spy.mock.calls.filter((args) => String(args[0]).includes('cannot be a descendant of'))
    spy.mockRestore()
    expect(nestingWarnings).toEqual([])
  })
})
