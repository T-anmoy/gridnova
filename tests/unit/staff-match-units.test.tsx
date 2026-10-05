import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'node:fs'
import path from 'node:path'
import RegisterPanel from '@/components/dashboard/RegisterPanel'
import { ApiError } from '@/lib/dashboard/api-error'
import { withI18n } from './helpers/i18n'
import type { StaffRegister, StaffRegisterUnit } from '@/lib/dashboard/register-staff-types'

const h = vi.hoisted(() => ({
  match: vi.fn(),
  verify: vi.fn(),
  catalogueCalls: [] as string[],
  items: [] as unknown[],
}))
vi.mock('@/lib/dashboard/register-api-client', () => ({
  useCreateUnit: () => ({ mutateAsync: vi.fn() }),
  useBulkCreateUnits: () => ({ mutateAsync: vi.fn() }),
  useUpdateUnit: () => ({ mutateAsync: vi.fn() }),
  useVoidUnit: () => ({ mutateAsync: vi.fn() }),
  useMatchUnit: () => ({ mutateAsync: h.match }),
  useVerifyRegister: () => ({ mutateAsync: h.verify, isPending: false }),
  checkSerial: vi.fn(),
  useStaffCatalogue: (category: string) => {
    h.catalogueCalls.push(category)
    return { items: h.items, isLoading: false, error: undefined, refetch: vi.fn() }
  },
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }), useClerk: () => ({ signOut: vi.fn() }) }))

const MODULE_ITEM = { id: 34, brand: 'SolarCo', model_name: 'SC-550', is_dcr_compliant: true }

const unit = (over: Partial<StaffRegisterUnit> = {}): StaffRegisterUnit => ({
  unit_id: 1, category: 'module', serial_number: 'SN-0001', serial_normalized: 'SN0001',
  equipment: { id: 1, brand: 'SolarCo', model_name: 'SC-550', is_dcr_compliant: true, is_placeholder: false },
  rating_wp: '550.00', rating_kw: null, is_dcr: true, warranty_start: null, warranty_end: null, status: 'entered',
  created_by: 'a', created_at: '2026-03-01T00:00:00Z', verified_by: null, verified_at: null, void_reason: null, ...over,
})
const unmatched = (over: Partial<StaffRegisterUnit> = {}) =>
  unit({ unit_id: 17, serial_number: 'SN-UNM', equipment: null, brand_as_printed: 'Sova Solar', model_as_printed: 'SS-540M', catalogue_unmatched: true, ...over })

const register = (units: StaffRegisterUnit[], over: Partial<StaffRegister> = {}): StaffRegister => ({
  verified_at: null, verified_by: null, units,
  totals: { modules: units.length, inverters: 0, other: 0, inverter_kw: '0.00' },
  capacity: { installed_module_kw: '0.55', requested_kw: '3.00', tolerance_percent: 10, mismatch: false },
  dcr: { pm_surya_ghar: false, mismatch: false, override: null }, flags: [], ...over,
})

const panel = (r: StaffRegister, isAdmin = false) => render(withI18n(<RegisterPanel onboardingId={5} register={r} canWrite isAdmin={isAdmin} />))

beforeEach(() => {
  h.match.mockReset()
  h.verify.mockReset()
  h.catalogueCalls.length = 0
  h.items = [MODULE_ITEM]
})

describe('RegisterPanel — unmatched units', () => {
  it('lists unmatched units first, with the printed text and a Match button', () => {
    panel(register([unit(), unmatched()]))
    const rows = screen.getAllByTestId('register-unit')
    expect(rows[0]).toHaveTextContent('SN-UNM')
    expect(within(rows[0]).getByTestId('unit-unmatched')).toHaveTextContent('Needs catalogue match')
    expect(rows[0]).toHaveTextContent('As printed: Sova Solar SS-540M')
    expect(within(rows[0]).getByRole('button', { name: 'Match' })).toBeInTheDocument()
    expect(within(rows[1]).queryByRole('button', { name: 'Match' })).toBeNull()
    expect(screen.getByTestId('unmatched-summary')).toHaveTextContent('1 unit not matched')
  })

  it('does not offer Match for "other" equipment', () => {
    panel(register([unit({ unit_id: 3, category: 'other', equipment: null, rating_wp: null, is_dcr: null })]))
    expect(screen.queryByRole('button', { name: 'Match' })).toBeNull()
  })
})

describe('MatchUnitDialog', () => {
  async function open(r = register([unmatched()]), isAdmin = false) {
    const user = userEvent.setup()
    panel(r, isAdmin)
    await user.click(screen.getByRole('button', { name: 'Match' }))
    return user
  }
  const pick = (user: ReturnType<typeof userEvent.setup>) => user.selectOptions(screen.getByLabelText('Catalogue item'), '34')

  it('uses the staff catalogue for the unit’s category and shows what was declared', async () => {
    await open()
    expect(h.catalogueCalls).toContain('module')
    expect(screen.getByRole('dialog')).toHaveTextContent('Sova Solar SS-540M')
    expect(screen.getByRole('dialog')).toHaveTextContent('declared it DCR')
  })

  it('matches before verification with no reason field', async () => {
    h.match.mockResolvedValue({})
    const user = await open()
    expect(within(screen.getByRole('dialog')).queryByLabelText(/Reason/)).toBeNull()
    await pick(user)
    await user.click(screen.getByRole('button', { name: 'Match unit' }))
    expect(h.match).toHaveBeenCalledWith({ unitId: 17, equipmentId: 34 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('after verification only an admin sees Match, and the reason is required and sent', async () => {
    const verified = register([unmatched()], { verified_at: '2026-03-05T00:00:00Z', verified_by: 'ops' })
    const { unmount } = panel(verified, false)
    expect(screen.queryByRole('button', { name: 'Match' })).toBeNull()
    unmount()

    h.match.mockResolvedValue({})
    const user = await open(verified, true)
    await pick(user)
    expect(screen.getByRole('button', { name: 'Match unit' })).toBeDisabled()
    await user.type(within(screen.getByRole('dialog')).getByLabelText(/Reason/), 'Nameplate checked on site visit')
    await user.click(screen.getByRole('button', { name: 'Match unit' }))
    expect(h.match).toHaveBeenCalledWith({ unitId: 17, equipmentId: 34, reason: 'Nameplate checked on site visit' })
  })

  const cases: [string, number, string, RegExp][] = [
    ['unknown_equipment', 422, 'x', /isn’t in the catalogue/],
    ['equipment_inactive', 422, 'x', /switched off/],
    ['equipment_category_mismatch', 422, 'x', /module unit needs a module, an inverter unit needs an inverter/],
    ['dcr_mismatch', 422, 'x', /DCR status agrees with what the associate declared/],
    ['not_matchable', 422, 'x', /isn’t matched to the catalogue/],
    ['already_matched', 409, 'x', /already been matched/],
    ['unit_voided', 409, 'x', /voided/],
    ['register_locked', 409, 'x', /verified and locked/],
    ['reason_required', 422, 'x', /reason is required/i],
  ]
  it.each(cases)('maps %s to plain words and keeps the dialog open', async (code, status, _m, text) => {
    h.match.mockRejectedValue(new ApiError(status, 'x', undefined, { code, message: 'English from server' }))
    const user = await open()
    await pick(user)
    await user.click(screen.getByRole('button', { name: 'Match unit' }))
    expect(await screen.findByTestId('match-error')).toHaveTextContent(text)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('RegisterPanel — verify refused with units_unmatched', () => {
  it('highlights the listed units and explains in plain words', async () => {
    h.verify.mockRejectedValue(new ApiError(409, 'x', undefined, { code: 'units_unmatched', message: 'Match every unit…', unit_ids: [17] }))
    const user = userEvent.setup()
    panel(register([unit(), unmatched(), unmatched({ unit_id: 18, serial_number: 'SN-UNM2' })]))
    await user.click(screen.getByRole('button', { name: 'Verify register' }))
    const status = await screen.findByText(/Match every unit to a catalogue item before verifying/)
    expect(status).toHaveTextContent('SN-UNM')
    expect(status).not.toHaveTextContent('SN-UNM2')
    const rows = screen.getAllByTestId('register-unit')
    const highlighted = rows.filter((r) => r.getAttribute('data-highlighted') === 'true')
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0]).toHaveTextContent('SN-UNM')
  })
})

// Associate and public code must never learn about the staff-only unmatched flag.
describe('catalogue_unmatched stays out of associate and public code', () => {
  const root = path.resolve(__dirname, '../..')
  const dirs = ['components/associate', 'components/execution', 'components/payments', 'components/careers', 'components/legal', 'lib/associate', 'app/(site)']
  const files = (d: string): string[] =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : /\.(tsx?|json)$/.test(e.name) ? [path.join(d, e.name)] : []))

  it('no associate or public source file mentions it or imports the staff types', () => {
    const offenders = dirs
      .filter((d) => fs.existsSync(path.join(root, d)))
      .flatMap((d) => files(path.join(root, d)))
      .filter((f) => /catalogue_unmatched|register-staff-types/.test(fs.readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('the message files never carry the flag name either', () => {
    for (const l of ['en', 'hi', 'bn']) expect(fs.readFileSync(path.join(root, `messages/${l}.json`), 'utf8')).not.toMatch(/catalogue_unmatched/)
  })

  it('actually scans something (guards against an empty directory list)', () => {
    expect(files(path.join(root, 'components/associate')).length).toBeGreaterThan(5)
  })
})
