import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterPanel from '@/components/dashboard/RegisterPanel'
import RegisterReadOnly from '@/components/execution/RegisterReadOnly'
import SerialScanButton from '@/components/execution/SerialScanButton'
import CataloguePicker from '@/components/execution/CataloguePicker'
import { ApiError } from '@/lib/dashboard/api-error'
import { en, withI18n } from './helpers/i18n'
import type { Register, RegisterUnit } from '@/lib/associate/register-types'

const h = vi.hoisted(() => ({
  create: vi.fn(),
  bulk: vi.fn(),
  update: vi.fn(),
  voidUnit: vi.fn(),
  verify: vi.fn(),
  check: vi.fn(),
  modules: { items: undefined as unknown, isLoading: false, error: undefined as unknown, refetch: vi.fn() },
  inverters: { items: undefined as unknown, isLoading: false, error: undefined as unknown, refetch: vi.fn() },
}))
vi.mock('@/lib/dashboard/register-api-client', () => ({
  useCreateUnit: () => ({ mutateAsync: h.create }),
  useBulkCreateUnits: () => ({ mutateAsync: h.bulk }),
  useUpdateUnit: () => ({ mutateAsync: h.update }),
  useVoidUnit: () => ({ mutateAsync: h.voidUnit }),
  useVerifyRegister: () => ({ mutateAsync: h.verify, isPending: false }),
  checkSerial: h.check,
  useStaffCatalogue: (category: string) => (category === 'module' ? h.modules : h.inverters),
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }), useClerk: () => ({ signOut: vi.fn() }) }))

const MODULE = { id: 1, brand: 'SolarCo', model_name: 'SC-550', is_dcr_compliant: true }
const DUMMY_MODULE = { id: 2, brand: 'DummyCo', model_name: 'D-1', is_dcr_compliant: false, is_placeholder: true }
const INVERTER = { id: 9, brand: 'InvCo', model_name: 'I-5', is_dcr_compliant: false }

const unit = (over: Partial<RegisterUnit> = {}): RegisterUnit => ({
  unit_id: 1,
  category: 'module',
  serial_number: 'SN-0001',
  serial_normalized: 'SN-0001',
  equipment: { id: 1, brand: 'SolarCo', model_name: 'SC-550', is_dcr_compliant: true, is_placeholder: false },
  rating_wp: '550.00',
  rating_kw: null,
  is_dcr: true,
  warranty_start: null,
  warranty_end: null,
  status: 'entered',
  created_by: 'ops',
  created_at: '2026-03-01T00:00:00Z',
  verified_by: null,
  verified_at: null,
  void_reason: null,
  ...over,
})

const register = (over: Partial<Register> = {}): Register => ({
  verified_at: null,
  verified_by: null,
  units: [unit()],
  totals: { modules: 1, inverters: 0, other: 0, inverter_kw: '0.00' },
  capacity: { installed_module_kw: '0.55', requested_kw: '3.00', tolerance_percent: 10, mismatch: false },
  dcr: { pm_surya_ghar: false, mismatch: false, override: null },
  flags: [],
  ...over,
})

beforeEach(() => {
  for (const f of [h.create, h.bulk, h.update, h.voidUnit, h.verify, h.check]) f.mockReset()
  h.modules = { items: [MODULE, DUMMY_MODULE], isLoading: false, error: undefined, refetch: vi.fn() }
  h.inverters = { items: [INVERTER], isLoading: false, error: undefined, refetch: vi.fn() }
})
afterEach(() => vi.unstubAllGlobals())

const panel = (over: Partial<React.ComponentProps<typeof RegisterPanel>> = {}) =>
  render(withI18n(<RegisterPanel onboardingId={5} register={register()} canWrite isAdmin={false} {...over} />))

async function fillModuleRow(user: ReturnType<typeof userEvent.setup>, serial: string, rating = '550.00', index = 0) {
  const models = screen.getAllByLabelText('Model')
  await user.selectOptions(models[index], '1')
  await user.type(screen.getAllByLabelText('Serial number')[index], serial)
  await user.type(screen.getAllByLabelText(/Rating \(Wp\)/)[index], rating)
}

describe('RegisterPanel — duplicate check comes from the backend', () => {
  it('checks on blur and shows the backend message and held_by exactly as returned', async () => {
    h.check.mockResolvedValue({ serial_normalized: 'SN-0002', available: false, message: 'This serial number is already registered on another project.', held_by: { onboarding_id: 8, project_reference_id: 'GN-2026-8' } })
    const user = userEvent.setup()
    panel()
    await user.type(screen.getByLabelText('Serial number'), 'sn-0002')
    await user.tab()
    const result = await screen.findByTestId('serial-check')
    expect(h.check).toHaveBeenCalledWith(5, 'sn-0002', 'tok')
    expect(result).toHaveTextContent('This serial number is already registered on another project.')
    expect(within(result).getByRole('link', { name: 'GN-2026-8' })).toHaveAttribute('href', '/dashboard/onboardings/8')
  })

  it('shows "available" when the backend says so, and an error (not a guess) if the check fails', async () => {
    h.check.mockResolvedValueOnce({ serial_normalized: 'X', available: true, held_by: null }).mockRejectedValueOnce(new ApiError(500, 'x', 'boom'))
    const user = userEvent.setup()
    panel()
    const input = screen.getByLabelText('Serial number')
    await user.type(input, 'ABCD')
    await user.tab()
    expect(await screen.findByTestId('serial-check')).toHaveTextContent('Available')
    await user.clear(input)
    await user.type(input, 'EFGH')
    await user.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('makes no duplicate decision of its own: the same serial twice in the form is not flagged client-side', async () => {
    h.check.mockResolvedValue({ serial_normalized: 'X', available: true, held_by: null })
    const user = userEvent.setup()
    panel()
    await user.click(screen.getByRole('button', { name: 'Add another unit' }))
    const serials = screen.getAllByLabelText('Serial number')
    await user.type(serials[0], 'SAME-1')
    await user.type(serials[1], 'SAME-1')
    await user.tab()
    expect(screen.queryByText(/twice|duplicate/i)).toBeNull()
  })
})

describe('RegisterPanel — entry', () => {
  it('saves one unit through the single endpoint with ratings as typed strings and the DCR flag from the catalogue', async () => {
    h.create.mockResolvedValue({ unit: unit(), warnings: [], register: register() })
    const user = userEvent.setup()
    panel()
    await fillModuleRow(user, 'SN-77', '549.5')
    expect(screen.getByTestId('dcr-locked')).toHaveTextContent('DCR: Yes (from the catalogue)')
    await user.click(screen.getByRole('button', { name: 'Save unit' }))
    expect(h.create).toHaveBeenCalledWith({ category: 'module', serial_number: 'SN-77', equipment_id: 1, rating_wp: '549.5', is_dcr: true })
    expect(typeof h.create.mock.calls[0][0].rating_wp).toBe('string')
    expect(await screen.findByRole('status')).toHaveTextContent('Saved 1 unit.')
    expect(h.bulk).not.toHaveBeenCalled()
  })

  it('a non-DCR model sends is_dcr false (locked to the catalogue, not editable)', async () => {
    h.create.mockResolvedValue({ unit: unit(), warnings: [], register: register() })
    const user = userEvent.setup()
    panel()
    await user.selectOptions(screen.getByLabelText('Model'), '2')
    await user.type(screen.getByLabelText('Serial number'), 'SN-1234')
    await user.type(screen.getByLabelText(/Rating \(Wp\)/), '500')
    expect(screen.getByTestId('dcr-locked')).toHaveTextContent('DCR: No')
    expect(screen.queryByRole('checkbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Save unit' }))
    expect(h.create).toHaveBeenCalledWith(expect.objectContaining({ equipment_id: 2, is_dcr: false }))
  })

  it('bulk save sends every row in one all-or-nothing request, and shows rating warnings as advice', async () => {
    h.bulk.mockResolvedValue({ units: [], warnings: [{ code: 'rating_out_of_range' }], register: register() })
    const user = userEvent.setup()
    panel()
    await user.click(screen.getByRole('button', { name: 'Add another unit' }))
    await fillModuleRow(user, 'SN-A1', '550', 0)
    await fillModuleRow(user, 'SN-A2', '9999', 1)
    await user.click(screen.getByRole('button', { name: 'Save all units' }))
    expect(h.bulk).toHaveBeenCalledTimes(1)
    expect(h.bulk.mock.calls[0][0].units.map((u: { serial_number: string }) => u.serial_number)).toEqual(['SN-A1', 'SN-A2'])
    expect(await screen.findByTestId('register-warnings')).toHaveTextContent('looks outside the usual range')
    expect(screen.getByRole('status')).toHaveTextContent('Saved 2 units.')
  })

  it('a failed bulk save keeps every row, shows per-row errors, and reports that nothing was saved', async () => {
    h.bulk.mockRejectedValue(
      new ApiError(422, 'x', 'rows', {
        code: 'register_rows_invalid',
        errors: [{ row: 1, code: 'duplicate_serial', message: 'dup', field: 'serial_number', held_by: { onboarding_id: 3, project_reference_id: 'GN-3' } }],
      })
    )
    const user = userEvent.setup()
    panel()
    await user.click(screen.getByRole('button', { name: 'Add another unit' }))
    await fillModuleRow(user, 'SN-A1', '550', 0)
    await fillModuleRow(user, 'SN-A2', '550', 1)
    await user.click(screen.getByRole('button', { name: 'Save all units' }))
    expect(await screen.findByText('Some rows need fixing — nothing was saved.')).toBeInTheDocument()
    const errors = await screen.findAllByTestId('row-error')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toHaveTextContent('Row 2: This serial number is already registered.')
    // The backend's row is 0-based: row 1 is the SECOND table row, and only that one is flagged.
    const rowEls = screen.getAllByTestId('unit-row')
    expect(within(rowEls[0]).queryByTestId('row-error')).toBeNull()
    expect(within(rowEls[1]).getByTestId('row-error')).toBeInTheDocument()
    expect(within(errors[0]).getByRole('link', { name: 'GN-3' })).toBeInTheDocument()
    expect(screen.getAllByLabelText('Serial number').map((i) => (i as HTMLInputElement).value)).toEqual(['SN-A1', 'SN-A2'])
    expect(screen.getByRole('button', { name: 'Save all units' })).toBeEnabled()
  })

  it('refuses to send rows that are incomplete', async () => {
    const user = userEvent.setup()
    panel()
    await user.type(screen.getByLabelText('Serial number'), 'ONLY-SERIAL')
    await user.click(screen.getByRole('button', { name: 'Save unit' }))
    expect(h.create).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Fill in the serial number, model and rating')
  })

  it('protects unsaved rows from a refresh or a closed tab', async () => {
    const user = userEvent.setup()
    panel()
    const event = () => {
      const e = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(event()).toBe(false)
    await user.type(screen.getByLabelText('Serial number'), 'X')
    expect(screen.getByTestId('unsaved-note')).toBeInTheDocument()
    expect(event()).toBe(true)
  })

  it('marks Dummy catalogue rows in the picker', () => {
    panel()
    expect(screen.getByRole('option', { name: /DummyCo D-1 — Dummy \/ pending Grid Nova/ })).toBeInTheDocument()
  })
})

describe('RegisterPanel — verify, lock and the staff-only flag', () => {
  it('verifies the register, and explains register_incomplete with what is missing', async () => {
    h.verify.mockRejectedValueOnce(new ApiError(422, 'x', 'incomplete', { code: 'register_incomplete', missing: ['inverter'] })).mockResolvedValue({})
    const user = userEvent.setup()
    panel()
    await user.click(screen.getByRole('button', { name: 'Verify register' }))
    expect(await screen.findByRole('status')).toHaveTextContent('still needs: inverter')
    await user.click(screen.getByRole('button', { name: 'Verify register' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('verified and locked'))
  })

  it('a verified register is locked: non-admin cannot add, edit or void', () => {
    panel({ register: register({ verified_at: '2026-03-02T00:00:00Z', verified_by: 'ops', units: [unit({ status: 'verified' })] }) })
    expect(screen.getByTestId('register-verified')).toHaveTextContent('locked')
    expect(screen.getByTestId('register-locked-note')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Void' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Verify register' })).toBeNull()
  })

  it('an Admin can still change a locked register, but only with a reason', async () => {
    h.update.mockResolvedValue({})
    const user = userEvent.setup()
    panel({ isAdmin: true, register: register({ verified_at: '2026-03-02T00:00:00Z', units: [unit({ status: 'verified' })] }) })
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog')
    const save = within(dialog).getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Reason/), 'Typo in serial')
    await user.click(save)
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ unitId: 1, patch: expect.objectContaining({ reason: 'Typo in serial' }) }))
  })

  it('shows the previously_voided flag to staff, on the register and on the unit', () => {
    panel({ register: register({ flags: ['previously_voided'], units: [unit({ previously_voided: true })] }) })
    expect(screen.getByTestId('previously-voided-flag')).toBeInTheDocument()
    expect(screen.getByTestId('unit-previously-voided')).toBeInTheDocument()
  })

  it('shows capacity and DCR mismatches as advice, with the override when one exists', () => {
    panel({ register: register({ capacity: { installed_module_kw: '4.40', requested_kw: '3.00', tolerance_percent: 10, mismatch: true }, dcr: { pm_surya_ghar: true, mismatch: true, override: { reason: 'Client approved', by: 'admin', at: '2026-03-03T00:00:00Z' } } }) })
    expect(screen.getByTestId('capacity-advice')).toHaveTextContent('Advice only')
    expect(screen.getByTestId('dcr-advice')).toHaveTextContent('override recorded by admin: Client approved')
  })

  it('shows Dummy chips on units whose model is a placeholder', () => {
    panel({ register: register({ units: [unit({ equipment: { id: 2, brand: 'DummyCo', model_name: 'D-1', is_dcr_compliant: false, is_placeholder: true } })] }) })
    expect(screen.getByTestId('dummy-chip')).toBeInTheDocument()
  })

  it('read-only roles (engineer, management, sales) get no entry, edit, void or verify', () => {
    panel({ canWrite: false })
    expect(screen.queryByTestId('unit-entry')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Verify register' })).toBeNull()
  })

  it('voiding needs a reason', async () => {
    h.voidUnit.mockResolvedValue({})
    const user = userEvent.setup()
    panel()
    await user.click(screen.getByRole('button', { name: 'Void' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Void unit' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Reason/), 'Entered on the wrong project')
    await user.click(confirm)
    expect(h.voidUnit).toHaveBeenCalledWith({ unitId: 1, reason: 'Entered on the wrong project' })
  })
})

describe('serial scanning is feature-detected', () => {
  it('shows no Scan button where BarcodeDetector does not exist, and typing still works', () => {
    expect('BarcodeDetector' in window).toBe(false)
    render(<SerialScanButton onScan={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Scan' })).toBeNull()
    panel()
    expect(screen.queryByRole('button', { name: 'Scan' })).toBeNull()
    expect(screen.getByLabelText('Serial number')).toBeEnabled()
  })

  it('shows the Scan button when the browser supports it', () => {
    vi.stubGlobal('BarcodeDetector', class {})
    render(<SerialScanButton onScan={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Scan' })).toBeInTheDocument()
  })

  it('reports an unavailable camera in words, leaving typing available', async () => {
    vi.stubGlobal('BarcodeDetector', class {})
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<SerialScanButton onScan={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('type the serial number instead')
  })
})

describe('CataloguePicker states', () => {
  const noop = () => undefined
  it('shows loading, an error with Retry, and an empty state — never a silently empty select', async () => {
    const refetch = vi.fn()
    const { rerender } = render(<CataloguePicker id="p" label="Model" value={null} onChange={noop} source={{ items: undefined, isLoading: true, refetch }} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    rerender(<CataloguePicker id="p" label="Model" value={null} onChange={noop} source={{ items: undefined, isLoading: false, error: new Error('x'), refetch }} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalled()
    rerender(<CataloguePicker id="p" label="Model" value={null} onChange={noop} source={{ items: [], isLoading: false, refetch }} />)
    expect(screen.getByRole('status')).toHaveTextContent('No models are in the catalogue yet.')
  })
})

describe('associate read-only register view', () => {
  const copy = en.associates.portal.execution.register

  it('shows units and totals as returned, with a verified badge, and no entry controls', () => {
    render(<RegisterReadOnly register={register({ verified_at: '2026-03-02T00:00:00Z' })} copy={copy} />)
    expect(screen.getByTestId('register-badge')).toHaveTextContent(copy.verifiedBadge)
    expect(screen.getByTestId('register-unit')).toHaveTextContent('SN-0001')
    expect(screen.getByTestId('register-unit')).toHaveTextContent('550.00 Wp')
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('never shows the staff-only previously_voided signal, even if the response carried it', () => {
    const { container } = render(<RegisterReadOnly register={register({ flags: ['previously_voided'], units: [unit({ previously_voided: true })] })} copy={copy} />)
    expect(container.textContent?.toLowerCase()).not.toMatch(/voided/)
  })

  it('shows mismatches as calm advice and hides voided units', () => {
    render(
      <RegisterReadOnly
        register={register({ units: [unit(), unit({ unit_id: 2, serial_number: 'GONE', status: 'voided' })], capacity: { installed_module_kw: '4.40', requested_kw: '3.00', tolerance_percent: 10, mismatch: true }, dcr: { pm_surya_ghar: true, mismatch: true, override: null } })}
        copy={copy}
      />
    )
    expect(screen.queryByText('GONE')).toBeNull()
    expect(screen.getByTestId('capacity-advice')).toHaveTextContent('advice only')
    expect(screen.getByTestId('dcr-advice')).toHaveTextContent(copy.dcrMismatch)
  })

  it('shows an empty state before any serial is entered', () => {
    render(<RegisterReadOnly register={register({ units: [] })} copy={copy} />)
    expect(screen.getByText(copy.empty)).toBeInTheDocument()
  })
})
