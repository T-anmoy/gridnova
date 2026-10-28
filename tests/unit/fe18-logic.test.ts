// FE-18: the Studio's plain helpers — wizard step for a field, the proof-check groups, error
// wording, validity, text-only ordering of amounts, CSV, WhatsApp link guard, the price
// section the wizard sends, the make choices and the PDF page count.
import { describe, it, expect } from 'vitest'
import { ApiError } from '@/lib/dashboard/api-error'
import {
  compareDecimalStrings,
  daysUntil,
  eventNote,
  fieldLabel,
  groupChecks,
  isWhatsappLink,
  kwpText,
  lastIssuedBefore,
  ownerText,
  stepOfField,
  studioError,
  studioFieldId,
  timeline,
  toCsv,
  validityText,
} from '@/lib/studio/logic'
import { priceValue } from '@/components/dashboard/studio/WizardSteps'
import { makeChoices } from '@/components/dashboard/studio/MaterialsEditor'
import { countPdfPages } from '@/components/dashboard/studio/StudioPreview'
import { capacityOf, rowsCsv, sortRows } from '@/components/dashboard/studio/ProposalsList'
import { makeView } from './fixtures/studio'

const NOW = new Date('2026-10-28T06:30:00Z') // 12:00 IST

describe('stepOfField — every check and error links to the step that edits it', () => {
  it.each([
    ['addressee.mobile', 'customer'],
    ['customer.gstin', 'customer'],
    ['plant.capacity_kwp', 'project'],
    ['connection.phase', 'project'],
    ['pm_surya_ghar', 'project'],
    ['project.houses', 'project'],
    ['site.state', 'site'],
    ['connection.discom', 'site'],
    ['project.roof_area_sqft', 'site'],
    ['boq[2].make', 'system'],
    ['items[0].make', 'system'],
    ['price', 'price'],
    ['price.reason', 'price'],
    ['savings', 'price'],
    ['payment_terms', 'terms'],
    ['validity_days', 'terms'],
    ['notes_free', 'terms'],
    [null, 'review'],
  ] as const)('%s → %s', (field, step) => {
    expect(stepOfField(field)).toBe(step)
  })

  it('field ids are DOM-safe and stable', () => {
    expect(studioFieldId('boq[2].make')).toBe('studio-field-boq-2-make')
  })
})

describe('groupChecks', () => {
  it('splits errors and warnings, marks acknowledged warnings, all clear only when both are done', () => {
    const view = makeView({
      checks: [
        { id: 'missing_required', level: 'error', field: 'site.town', message: 'Missing: the town.', fingerprint: 'e1' },
        { id: 'capacity_above_sanctioned', level: 'warning', field: 'plant.capacity_kwp', message: '3 kWp is above 2 kW.', fingerprint: 'w1' },
        { id: 'spelling', level: 'warning', field: 'notes_free', message: "'recieve' may be misspelt.", fingerprint: 'w2', word: 'recieve' },
      ],
      warnings_unacknowledged: ['w2'],
    })
    const g = groupChecks(view)
    expect(g.errors.map((e) => e.fingerprint)).toEqual(['e1'])
    expect(g.warnings.map((w) => [w.fingerprint, w.acknowledged])).toEqual([['w1', true], ['w2', false]])
    expect(g.allClear).toBe(false)
    expect(groupChecks({ checks: [g.warnings[0]], warnings_unacknowledged: [] }).allClear).toBe(true)
  })
})

describe('studioError — plain words for every refusal', () => {
  const err = (status: number, detail: Record<string, unknown>) => new ApiError(status, 'x', String(detail.message ?? ''), detail)
  it('keeps the server sentence and field for a value problem', () => {
    const info = studioError(err(422, { code: 'reason_required', message: 'The price is 8.11% below the price master: give the reason.', field: 'price.reason' }))
    expect(info.message).toContain('8.11% below')
    expect(info.field).toBe('price.reason')
  })
  it('explains stale_version, maker_checker, two-step and locked in the person’s words', () => {
    expect(studioError(err(409, { code: 'stale_version', message: 'x' })).message).toMatch(/Someone else changed this proposal/)
    expect(studioError(err(403, { code: 'maker_checker', message: 'x' })).message).toMatch(/someone else must approve/)
    expect(studioError(err(403, { code: 'two_factor_required', message: 'x' })).message).toMatch(/two-step/)
    expect(studioError(err(409, { code: 'proposal_locked', message: 'x' })).message).toMatch(/Revise/)
    expect(studioError(new ApiError(0, 'Network request failed')).message).toMatch(/No connection/)
  })
})

describe('validity', () => {
  it('counts whole days in India time', () => {
    expect(daysUntil('2026-11-04', NOW)).toBe(7)
    expect(daysUntil('2026-10-28', NOW)).toBe(0)
    expect(daysUntil('2026-10-26', NOW)).toBe(-2)
    expect(daysUntil(null, NOW)).toBeNull()
  })
  it('says it plainly', () => {
    expect(validityText('2026-11-04', NOW)).toBe('Valid for 7 more days')
    expect(validityText('2026-10-29', NOW)).toBe('Valid until tomorrow')
    expect(validityText('2026-10-28', NOW)).toBe('Valid until today')
    expect(validityText('2026-10-26', NOW)).toBe('Expired 2 days ago')
  })
})

describe('amounts are ordered as text, never turned into numbers', () => {
  it('compares decimal strings of any length and scale', () => {
    expect(compareDecimalStrings('201465.00', '98000')).toBe(1)
    expect(compareDecimalStrings('98000', '201465.00')).toBe(-1)
    expect(compareDecimalStrings('100.5', '100.50')).toBe(0)
    expect(compareDecimalStrings('100.05', '100.5')).toBe(-1)
    expect(compareDecimalStrings('12345678901234567890.01', '12345678901234567890.02')).toBe(-1)
    expect(compareDecimalStrings(null, '1')).toBe(-1)
  })
  it('sorts the list by total and by capacity', () => {
    const rows = [
      makeView({ proposal: { id: 1, total: '98000.00', title: '10 kWp X' } }).proposal,
      makeView({ proposal: { id: 2, total: '201465.00', title: '3 kWp Y' } }).proposal,
      makeView({ proposal: { id: 3, total: null, title: '52 kWp Z' } }).proposal,
    ]
    expect(sortRows(rows, 'total', 'asc').map((r) => r.id)).toEqual([3, 1, 2])
    expect(sortRows(rows, 'total', 'desc').map((r) => r.id)).toEqual([2, 1, 3])
    expect(sortRows(rows, 'capacity', 'asc').map((r) => r.id)).toEqual([2, 1, 3])
    expect(capacityOf(rows[0])).toBe('10')
  })
})

describe('CSV', () => {
  it('quotes commas and quotes, and defuses spreadsheet formulas', () => {
    expect(toCsv(['a', 'b'], [['x, y', 'say "hi"'], ['=HYPERLINK("x")', '-5']])).toBe('a,b\r\n"x, y","say ""hi"""\r\n"\'=HYPERLINK(""x"")",-5\r\n')
  })
  it('exports the visible rows with the API’s amounts as they are', () => {
    const p = makeView({ proposal: { document_reference: 'GN/27/10/2026/01', total: '201465.00', owner_id: 'me' } }).proposal
    const csv = rowsCsv([p], () => 'Residential rooftop', 'me')
    expect(csv.split('\r\n')[1]).toBe('GN/27/10/2026/01,SP-000007,Test Kumar Das,9830000001,3 kWp Residential rooftop — Test Kumar Das,Residential rooftop,3,201465.00,Draft,,,You')
  })
})

describe('the price section the wizard sends (§6 price modes)', () => {
  const f = { way: 'price_list' as const, amount: '', discountOn: false, discount: '', discountReason: '', reason: '' }
  it('price master, total, basic, rate per kWp', () => {
    expect(priceValue(f)).toEqual({ mode: 'price_list', discount: null, reason: null })
    expect(priceValue({ ...f, way: 'total', amount: '2,01,465' })).toEqual({ mode: 'staff_total', total: '201465', reason: null })
    expect(priceValue({ ...f, way: 'basic', amount: '170000' })).toEqual({ mode: 'staff_basic', basic: '170000', discount: null, reason: null })
    expect(priceValue({ ...f, way: 'rate', amount: '56000' })).toEqual({ mode: 'staff_basic', rate_per_kwp: '56000', discount: null, reason: null })
  })
  it('nothing is sent while the amount is blank or a discount has no reason', () => {
    expect(priceValue({ ...f, way: 'total', amount: ' ' })).toBeNull()
    expect(priceValue({ ...f, discountOn: true, discount: '5000', discountReason: 'x' })).toBeNull()
    expect(priceValue({ ...f, discountOn: true, discount: '5000', discountReason: 'Festival offer' })).toEqual({ mode: 'price_list', discount: { amount: '5000', reason: 'Festival offer' }, reason: null })
  })
  it('a total never carries a discount (the API refuses one)', () => {
    expect(priceValue({ ...f, way: 'total', amount: '200000', discountOn: true, discount: '5000', discountReason: 'Festival offer' })).toEqual({ mode: 'staff_total', total: '200000', reason: null })
  })
  it('the below-price-master reason goes with it', () => {
    expect(priceValue({ ...f, way: 'basic', amount: '170000', reason: 'Competitor quote' })).toMatchObject({ reason: 'Competitor quote' })
  })
})

describe('make picker choices — the catalogue only', () => {
  it('catalogue brands + makes already on the rows, then Equivalent and “–” (no make), de-duplicated', () => {
    expect(makeChoices(['Waaree', 'Sungrow'], ['Waaree / Equivalent', 'Havells', '–'])).toEqual(['Havells', 'Sungrow', 'Waaree', 'Equivalent', '–'])
  })
})

describe('PDF page count (for the page strip)', () => {
  it('counts /Type /Page objects, not /Pages', () => {
    const pdf = new TextEncoder().encode('%PDF-1.7 1 0 obj <</Type /Pages /Count 3>> 2 0 obj <</Type /Page>> 3 0 obj <</Type/Page /X 1>> 4 0 obj <</Type /Page>>')
    expect(countPdfPages(pdf)).toBe(3)
    expect(countPdfPages(new TextEncoder().encode('%PDF compressed'))).toBeNull()
  })
})

describe('small words', () => {
  it('kWp, owner, field labels, WhatsApp guard, last issued version, timeline', () => {
    expect(kwpText('7.500')).toBe('7.5 kWp')
    expect(kwpText('52')).toBe('52 kWp')
    expect(ownerText('u1', 'u1')).toBe('You')
    expect(ownerText('u2', 'u1')).toBe('A colleague')
    expect(fieldLabel('boq[1].make')).toBe('Material row 2 — make')
    expect(fieldLabel('plant.capacity_kwp')).toBe('Capacity (kWp)')
    expect(isWhatsappLink('https://wa.me/919830000001?text=Dear')).toBe(true)
    expect(isWhatsappLink('https://evil.example/wa.me/91983')).toBe(false)
    expect(lastIssuedBefore([{ version: 1, status: 'superseded', document_reference: 'GN/1' }, { version: 2, status: 'issued', document_reference: 'GN/1-R1' }, { version: 3, status: 'draft', document_reference: null }], 3)).toBe(2)
    expect(lastIssuedBefore([{ version: 1, status: 'draft', document_reference: null }], 1)).toBeNull()
    const ev = [
      { id: 1, version: 1, type: 'edited', actor_type: 'employee', actor: 'u', detail: null, at: '2026-10-27T05:00:00Z' },
      { id: 2, version: 1, type: 'viewed', actor_type: 'customer', actor: null, detail: null, at: '2026-10-27T07:00:00Z' },
      { id: 3, version: 1, type: 'lost', actor_type: 'employee', actor: 'u', detail: { reason: 'Went elsewhere' }, at: '2026-10-28T07:00:00Z' },
    ]
    expect(timeline(ev).map((e) => e.type)).toEqual(['viewed', 'lost'])
    expect(eventNote(ev[1])).toBe('By the customer')
    expect(eventNote(ev[2])).toBe('Went elsewhere')
  })
})
