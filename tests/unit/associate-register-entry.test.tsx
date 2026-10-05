import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterEntry from '@/components/associate/RegisterEntry'
import AssociateCataloguePicker from '@/components/associate/AssociateCataloguePicker'
import RegisterReadOnly from '@/components/execution/RegisterReadOnly'
import { ApiError } from '@/lib/dashboard/api-error'
import { mapRowErrors, toInput, validateRow, emptyRow } from '@/lib/associate/register-entry'
import { en, withI18n } from './helpers/i18n'
import type { Register, RegisterUnit } from '@/lib/associate/register-types'

const h = vi.hoisted(() => ({
  create: vi.fn(),
  bulk: vi.fn(),
  check: vi.fn(),
  catalogue: vi.fn(),
}))
vi.mock('@/lib/associate/register-api-client', () => ({
  useAssociateCreateUnit: () => ({ mutateAsync: h.create }),
  useAssociateBulkCreateUnits: () => ({ mutateAsync: h.bulk }),
  useAssociateUpdateUnit: () => ({ mutateAsync: vi.fn() }),
  useAssociateVoidUnit: () => ({ mutateAsync: vi.fn() }),
  checkAssociateSerial: h.check,
  useAssociateCatalogue: (category: string, q: string) => h.catalogue(category, q),
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))

const copy = en.associates.portal.execution.register
const entry = copy.entry
const MODULE = { id: 1, brand: 'SolarCo', model_name: 'SC-550', is_dcr_compliant: true, is_placeholder: false }
const NON_DCR = { id: 2, brand: 'OtherCo', model_name: 'O-1', is_dcr_compliant: false, is_placeholder: false }

const source = (over: Record<string, unknown> = {}) => ({ items: [MODULE, NON_DCR], isLoading: false, error: undefined, rateLimited: false, refetch: vi.fn(), ...over })

beforeEach(() => {
  for (const f of [h.create, h.bulk, h.check]) f.mockReset()
  h.catalogue.mockReset()
  h.catalogue.mockImplementation(() => source())
  h.create.mockResolvedValue({ warnings: [], register: {} })
  h.bulk.mockResolvedValue({ warnings: [], register: {} })
})
afterEach(() => vi.unstubAllGlobals())

const entryForm = () => render(withI18n(<RegisterEntry onboardingId={5} portalBase="/associates/portal" copy={copy} />))

describe('AssociateCataloguePicker', () => {
  const picker = (onChange = vi.fn(), category: 'module' | 'inverter' = 'module') =>
    render(<AssociateCataloguePicker id="p" category={category} value={null} onChange={onChange} copy={entry} />)

  it('lists models and reports the chosen one', async () => {
    const onChange = vi.fn()
    picker(onChange)
    await userEvent.setup().click(screen.getByRole('button', { name: /SolarCo SC-550/ }))
    expect(onChange).toHaveBeenCalledWith(MODULE)
  })

  it('searches by brand or model (debounced) within the chosen category', async () => {
    picker(vi.fn(), 'inverter')
    expect(h.catalogue).toHaveBeenCalledWith('inverter', '')
    await userEvent.setup().type(screen.getByLabelText(entry.searchLabel), 'sova')
    await waitFor(() => expect(h.catalogue).toHaveBeenLastCalledWith('inverter', 'sova'))
    // The debounce means no request was made per keystroke.
    expect(h.catalogue.mock.calls.filter((c) => c[1] === 's')).toHaveLength(0)
  })

  it('shows a loading state', () => {
    h.catalogue.mockImplementation(() => source({ items: undefined, isLoading: true }))
    picker()
    expect(screen.getByRole('status', { name: entry.loading })).toHaveAttribute('aria-busy', 'true')
  })

  it('shows a plain error with Retry', async () => {
    const refetch = vi.fn()
    h.catalogue.mockImplementation(() => source({ items: undefined, error: new ApiError(500, 'x'), refetch }))
    picker()
    expect(screen.getByRole('alert')).toHaveTextContent(entry.loadError)
    await userEvent.setup().click(screen.getByRole('button', { name: entry.retry }))
    expect(refetch).toHaveBeenCalled()
  })

  it('says so, with Retry, on a 429 rate limit', () => {
    h.catalogue.mockImplementation(() => source({ items: undefined, error: new ApiError(429, 'x', undefined, { code: 'rate_limited' }), rateLimited: true }))
    picker()
    expect(screen.getByRole('alert')).toHaveTextContent(entry.rateLimited)
    expect(screen.getByRole('button', { name: entry.retry })).toBeInTheDocument()
  })

  it('shows an empty state — one for an empty catalogue, one for a search with no match', async () => {
    h.catalogue.mockImplementation(() => source({ items: [] }))
    picker()
    expect(screen.getByRole('status')).toHaveTextContent(entry.emptyCatalogue)
    await userEvent.setup().type(screen.getByLabelText(entry.searchLabel), 'zzz')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(entry.emptyList))
  })
})

describe('RegisterEntry — listed model', () => {
  async function pickListedModule(user: ReturnType<typeof userEvent.setup>, serial: string, rating = '550.00') {
    await user.click(screen.getByRole('button', { name: /SolarCo SC-550/ }))
    await user.type(screen.getByLabelText(entry.serial), serial)
    await user.type(screen.getByLabelText(entry.ratingWp), rating)
  }

  it('pre-fills and locks the DCR answer from the model list and sends equipment_id with the ratings as typed', async () => {
    entryForm()
    const user = userEvent.setup()
    await pickListedModule(user, 'SN-1')
    expect(screen.getByTestId('dcr-locked')).toHaveTextContent('Yes')
    expect(screen.queryByTestId('dcr-declaration')).toBeNull()
    await user.click(screen.getByRole('button', { name: entry.save }))
    expect(h.create).toHaveBeenCalledWith({ category: 'module', serial_number: 'SN-1', equipment_id: 1, rating_wp: '550.00', is_dcr: true })
  })

  it('sends warranty dates only as a pair', async () => {
    entryForm()
    const user = userEvent.setup()
    await pickListedModule(user, 'SN-1')
    await user.type(screen.getByLabelText(entry.warrantyStart), '2026-01-01')
    await user.click(screen.getByRole('button', { name: entry.save }))
    expect(screen.getByText(entry.validation.warrantyPair)).toBeInTheDocument()
    expect(h.create).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText(entry.warrantyEnd), '2036-01-01')
    await user.click(screen.getByRole('button', { name: entry.save }))
    expect(h.create).toHaveBeenCalledWith(expect.objectContaining({ warranty_start: '2026-01-01', warranty_end: '2036-01-01' }))
  })

  it('shows rating_out_of_range as advice after a successful save', async () => {
    h.create.mockResolvedValue({ warnings: [{ code: 'rating_out_of_range' }], register: {} })
    entryForm()
    const user = userEvent.setup()
    await pickListedModule(user, 'SN-1', '5500')
    await user.click(screen.getByRole('button', { name: entry.save }))
    expect(await screen.findByTestId('register-warnings')).toHaveTextContent(entry.warnings.ratingOutOfRange)
    expect(screen.getByText(entry.savedOne)).toBeInTheDocument()
  })
})

describe('RegisterEntry — "My model is not listed"', () => {
  async function openUnlisted(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: entry.notListed }))
  }

  it('is offered even while the catalogue is in error, and explains in one calm sentence that Grid Nova will match it', async () => {
    h.catalogue.mockImplementation(() => source({ items: undefined, error: new ApiError(500, 'x') }))
    entryForm()
    const user = userEvent.setup()
    await openUnlisted(user)
    expect(screen.getByTestId('unlisted-fields')).toHaveTextContent(entry.notListedNote)
    expect(screen.getByLabelText(entry.brandPrinted)).toBeInTheDocument()
    expect(screen.getByLabelText(entry.modelPrinted)).toBeInTheDocument()
  })

  it('requires both printed fields and a module DCR declaration — and nothing else', async () => {
    entryForm()
    const user = userEvent.setup()
    await openUnlisted(user)
    await user.type(screen.getByLabelText(entry.serial), 'SN-9')
    await user.type(screen.getByLabelText(entry.ratingWp), '540')
    await user.click(screen.getByRole('button', { name: entry.save }))
    expect(screen.getByText(entry.validation.brandRequired)).toBeInTheDocument()
    expect(screen.getByText(entry.validation.modelPrintedRequired)).toBeInTheDocument()
    expect(screen.getByText(entry.validation.dcrRequired)).toBeInTheDocument()
    expect(h.create).not.toHaveBeenCalled()
  })

  it('saves without a catalogue item: printed brand/model and the declared DCR, no equipment_id', async () => {
    entryForm()
    const user = userEvent.setup()
    await openUnlisted(user)
    await user.type(screen.getByLabelText(entry.brandPrinted), '  Sova Solar ')
    await user.type(screen.getByLabelText(entry.modelPrinted), 'SS-540M')
    await user.type(screen.getByLabelText(entry.serial), 'SN-9')
    await user.type(screen.getByLabelText(entry.ratingWp), '540')
    await user.click(within(screen.getByTestId('dcr-declaration')).getByRole('button', { name: entry.dcrNo }))
    await user.click(screen.getByRole('button', { name: entry.save }))
    expect(h.create).toHaveBeenCalledWith({
      category: 'module',
      serial_number: 'SN-9',
      brand_as_printed: 'Sova Solar',
      model_as_printed: 'SS-540M',
      rating_wp: '540',
      is_dcr: false,
    })
    expect(await screen.findByText(entry.savedOne)).toBeInTheDocument()
  })

  it('needs no DCR answer for an inverter', async () => {
    const unlisted = { ...emptyRow(), category: 'inverter' as const, unlisted: true, brand: 'InvCo', model: 'I-5', serial: 'INV-1', rating: '5' }
    expect(validateRow(unlisted)).toEqual([])
    expect(toInput(unlisted)).toEqual({ category: 'inverter', serial_number: 'INV-1', brand_as_printed: 'InvCo', model_as_printed: 'I-5', rating_kw: '5' })
  })
})

describe('RegisterEntry — serial check, scanning and unsaved rows', () => {
  it("shows the backend's associate-safe message exactly as returned, with a customer link only when given", async () => {
    h.check.mockResolvedValue({ serial_normalized: 'SN1', available: false, on_this_project: false, message: 'This serial number is already registered on one of your customers.', held_by: { onboarding_id: 12 } })
    entryForm()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(entry.serial), 'SN-1')
    await user.tab()
    const out = await screen.findByTestId('serial-check')
    expect(out).toHaveTextContent('This serial number is already registered on one of your customers.')
    expect(within(out).getByRole('link', { name: entry.viewCustomer })).toHaveAttribute('href', '/associates/portal/customers/12')
    expect(h.check).toHaveBeenCalledWith(5, 'SN-1', 'tok')
  })

  it('shows no link when held_by is null (a serial on a customer the associate cannot see)', async () => {
    h.check.mockResolvedValue({ serial_normalized: 'SN1', available: false, message: 'Already registered.', held_by: null })
    entryForm()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(entry.serial), 'SN-1')
    await user.tab()
    expect(await screen.findByTestId('serial-check')).toHaveTextContent('Already registered.')
    expect(screen.queryByRole('link', { name: entry.viewCustomer })).toBeNull()
  })

  it('says a check failed without blocking the save', async () => {
    h.check.mockRejectedValue(new ApiError(500, 'x'))
    entryForm()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(entry.serial), 'SN-1')
    await user.tab()
    expect(await screen.findByText(entry.checkFailed)).toBeInTheDocument()
  })

  it('has no scan button where BarcodeDetector does not exist — typing always works', () => {
    entryForm()
    expect(screen.queryByRole('button', { name: entry.scan })).toBeNull()
    expect(screen.getByLabelText(entry.serial)).toBeEnabled()
  })

  it('shows a scan button where BarcodeDetector exists', () => {
    vi.stubGlobal('BarcodeDetector', class {})
    entryForm()
    expect(screen.getByRole('button', { name: entry.scan })).toBeInTheDocument()
  })

  it('protects unsaved rows from being lost', async () => {
    entryForm()
    expect(screen.queryByTestId('unsaved-note')).toBeNull()
    await userEvent.setup().type(screen.getByLabelText(entry.serial), 'SN-1')
    expect(screen.getByTestId('unsaved-note')).toHaveTextContent(entry.unsaved)
    const ev = new Event('beforeunload', { cancelable: true })
    act(() => {
      window.dispatchEvent(ev)
    })
    expect(ev.defaultPrevented).toBe(true)
  })
})

describe('RegisterEntry — several rows, all or nothing', () => {
  it('maps the 0-based row index through the rows actually sent, and shows Row i+1 per row', async () => {
    h.bulk.mockRejectedValue(
      new ApiError(422, 'x', undefined, {
        code: 'register_rows_invalid',
        errors: [{ row: 1, code: 'duplicate_serial', field: 'serial_number', message: 'dup', held_by: { onboarding_id: 3 } }],
      })
    )
    entryForm()
    const user = userEvent.setup()
    const addAnother = () => user.click(screen.getByRole('button', { name: entry.addAnother }))
    const fillRow = async (i: number, serial: string) => {
      const rows = screen.getAllByTestId('unit-row')
      await user.click(within(rows[i]).getByRole('button', { name: /SolarCo SC-550/ }))
      await user.type(within(rows[i]).getByLabelText(entry.serial), serial)
      await user.type(within(rows[i]).getByLabelText(entry.ratingWp), '550')
    }
    await fillRow(0, 'A-1')
    await addAnother() // table row 2 stays empty and is not sent
    await addAnother()
    await fillRow(2, 'A-3')
    await user.click(screen.getByRole('button', { name: entry.saveAll }))
    expect(h.bulk).toHaveBeenCalledWith({ units: [expect.objectContaining({ serial_number: 'A-1' }), expect.objectContaining({ serial_number: 'A-3' })] })
    // Sent index 1 is the third table row → "Row 3".
    const rows = screen.getAllByTestId('unit-row')
    expect(within(rows[2]).getByTestId('row-error')).toHaveTextContent(`Row 3: ${entry.errors.duplicate_serial}`)
    expect(within(rows[0]).queryByTestId('row-error')).toBeNull()
    expect(screen.getByTestId('form-error')).toHaveTextContent(entry.errors.register_rows_invalid)
    // Nothing was cleared: the associate's typing is still there.
    expect(within(rows[0]).getByLabelText(entry.serial)).toHaveValue('A-1')
  })

  it('mapRowErrors keeps an out-of-range index apart instead of mis-assigning it', () => {
    const { byTableIndex, unmapped } = mapRowErrors([0, 3], [
      { row: 0, code: 'a', message: '' },
      { row: 1, code: 'b', message: '' },
      { row: 7, code: 'c', message: '' },
    ])
    expect([...byTableIndex.keys()]).toEqual([0, 3])
    expect(unmapped.map((e) => e.code)).toEqual(['c'])
  })

  it('maps equipment_required to the right printed field in plain words', async () => {
    h.create.mockRejectedValue(new ApiError(422, 'x', undefined, { code: 'equipment_required', field: 'brand_as_printed' }))
    entryForm()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /SolarCo SC-550/ }))
    await user.type(screen.getByLabelText(entry.serial), 'S1')
    await user.type(screen.getByLabelText(entry.ratingWp), '5')
    await user.click(screen.getByRole('button', { name: entry.save }))
    expect(await screen.findByTestId('form-error')).toHaveTextContent(entry.errors.brandMissing)
  })
})

describe('RegisterReadOnly — unmatched units', () => {
  const unit = (over: Partial<RegisterUnit>): RegisterUnit => ({
    unit_id: 1, category: 'module', serial_number: 'SN-1', serial_normalized: 'SN1', equipment: null, rating_wp: '540', rating_kw: null, is_dcr: true,
    warranty_start: null, warranty_end: null, status: 'entered', created_by: 'a', created_at: '2026-03-01T00:00:00Z', verified_by: null, verified_at: null, void_reason: null, ...over,
  })
  const register = (units: RegisterUnit[]): Register => ({
    verified_at: null, verified_by: null, units,
    totals: { modules: units.length, inverters: 0, other: 0, inverter_kw: '0.00' },
    capacity: { installed_module_kw: '0.54', requested_kw: null, tolerance_percent: 10, mismatch: false },
    dcr: { pm_surya_ghar: false, mismatch: false, override: null }, flags: [],
  })

  it('shows the neutral waiting chip and the printed text for a unit with no catalogue match', () => {
    render(<RegisterReadOnly register={register([unit({ brand_as_printed: 'Sova', model_as_printed: 'S-1' })])} copy={copy} />)
    expect(screen.getByTestId('waiting-match-chip')).toHaveTextContent('Waiting for Grid Nova to match this model')
    expect(screen.getByTestId('register-unit')).toHaveTextContent('As printed: Sova S-1')
  })

  it('shows no chip for a matched unit or for "other" equipment', () => {
    const matched = unit({ equipment: { id: 1, brand: 'A', model_name: 'B', is_dcr_compliant: true, is_placeholder: false } })
    render(<RegisterReadOnly register={register([matched, unit({ unit_id: 2, category: 'other', rating_wp: null })])} copy={copy} />)
    expect(screen.queryByTestId('waiting-match-chip')).toBeNull()
  })
})
