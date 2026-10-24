import { describe, it, expect } from 'vitest'
import {
  ALLOWED_TOKENS,
  canEditSection,
  cleanSectionValue,
  describeSaveOutcome,
  documentError,
  fieldAnchorId,
  paymentTotal,
  sectionOfField,
  textProblem,
  tokensIn,
  validateSection,
} from '@/lib/proposals/document-logic'
import { ApiError } from '@/lib/dashboard/api-error'
import { addMake, hasEquivalent, withEquivalent } from '@/components/dashboard/proposal-document/BoqEditor'
import { buildAdjustPricingInput } from '@/components/dashboard/AdjustPricingDialog'
import { docError, documentView, editResponse } from './fixtures/proposal-document-contract'

describe('editable state comes from the server only', () => {
  it('editable_sections drives each section; locked wins', () => {
    expect(canEditSection(documentView(), 'boq')).toBe(true)
    expect(canEditSection(documentView({ editable_sections: ['system', 'boq'] }), 'addressee')).toBe(false)
    expect(canEditSection(documentView({ locked: true, editable_sections: ['boq'] }), 'boq')).toBe(false)
    expect(canEditSection(documentView({ editable_sections: [] }), 'notes')).toBe(false)
    expect(canEditSection(undefined, 'notes')).toBe(false)
  })
})

describe('text rules (markers and tokens)', () => {
  it('rejects the draft markers, case-sensitive like the server', () => {
    expect(textProblem('Roof [PLACEHOLDER: size]')).toMatch(/PLACEHOLDER/)
    expect(textProblem('[UNCONFIRMED] value')).toMatch(/UNCONFIRMED/)
    expect(textProblem('DUMMY make')).toMatch(/DUMMY/)
    expect(textProblem('a dummy load test')).toBeNull()
  })
  it('allows exactly the seven tokens and names any other', () => {
    expect(ALLOWED_TOKENS).toHaveLength(7)
    for (const t of ALLOWED_TOKENS) expect(textProblem(`x {${t}} y`)).toBeNull()
    expect(textProblem('Rs {price} only')).toMatch(/\{price\}/)
    expect(tokensIn('{capacity_kwp} kWp {dcr_label}')).toEqual(['capacity_kwp', 'dcr_label'])
  })
})

describe('payment terms total', () => {
  it('sums percent strings exactly', () => {
    expect(paymentTotal([{ percent: '20', label: 'a' }, { percent: '60', label: 'b' }, { percent: '20', label: 'c' }])).toEqual({ total: '100', isHundred: true })
    expect(paymentTotal([{ percent: '33.333', label: 'a' }, { percent: '33.333', label: 'b' }, { percent: '33.334', label: 'c' }])?.isHundred).toBe(true)
    expect(paymentTotal([{ percent: '25', label: 'a' }, { percent: '60', label: 'b' }])).toEqual({ total: '85', isHundred: false })
    expect(paymentTotal([{ percent: 'abc', label: 'a' }])).toBeNull()
  })
  it('blocks a save that is not exactly 100 %', () => {
    const e = validateSection('payment_terms', [{ percent: '25', label: 'On Order' }, { percent: '60', label: 'Bill' }])
    expect(e.payment_terms).toMatch(/85 %.*exactly 100 %/)
    expect(validateSection('payment_terms', [])).toHaveProperty('payment_terms')
    expect(validateSection('payment_terms', [{ percent: '100', label: 'On Order' }])).toEqual({})
  })
})

describe('light validation per section', () => {
  it('Aadhaar takes only the last 4 digits, optional', () => {
    expect(validateSection('addressee', { aadhaar_last4: '12345' })['addressee.aadhaar_last4']).toBeDefined()
    expect(validateSection('addressee', { aadhaar_last4: '1234' })['addressee.aadhaar_last4']).toBeUndefined()
    expect(validateSection('addressee', { aadhaar_last4: null })).toEqual({})
  })
  it('mobile is 10 digits; capacity a positive decimal with ≤ 3 dp', () => {
    expect(validateSection('addressee', { mobile: '98000' })['addressee.mobile']).toBeDefined()
    expect(validateSection('plant', { capacity_kwp: '0' })['plant.capacity_kwp']).toBeDefined()
    expect(validateSection('plant', { capacity_kwp: '3.1234' })['plant.capacity_kwp']).toBeDefined()
    expect(validateSection('plant', { capacity_kwp: '12.5' })).toEqual({})
  })
  it('BOQ needs a row and each row its description, quantity and make', () => {
    expect(validateSection('boq', []).boq).toBeDefined()
    const e = validateSection('boq', [{ description: 'Modules', quantity: '', make: '' }])
    expect(Object.keys(e)).toEqual(['boq[0].quantity', 'boq[0].make'])
  })
  it('empty optional text travels as null; blank lines are dropped', () => {
    expect(cleanSectionValue('connection', { discom: '  ', phase: 'single' })).toEqual({ discom: null, phase: 'single' })
    expect(cleanSectionValue('site', { address_lines: ['a', ' '], town: 'Habra' })).toEqual({ address_lines: ['a'], town: 'Habra' })
    expect(cleanSectionValue('boq', [{ description: 'd', quantity: 'q', make: 'm', standard: '' }])).toEqual([{ description: 'd', quantity: 'q', make: 'm', standard: null }])
  })
})

describe('every document error code becomes a plain sentence on the right field', () => {
  it.each([
    [403, { code: 'field_not_editable', message: "Your role cannot change 'plant'.", field: 'plant' }, /cannot change this part/],
    [409, { code: 'proposal_locked', message: 'x' }, /can no longer be changed.*Request a revision/],
    [409, { code: 'stale_version', message: 'x', current_revision: 5 }, /Someone else changed this proposal — reload/],
    [409, { code: 'no_document', message: 'x' }, /created before the new template/],
    [422, { code: 'payment_terms_total', message: 'x', field: 'payment_terms' }, /exactly 100 %/],
    [422, { code: 'make_not_in_catalogue', message: 'x', field: 'boq[1].make' }, /not in the equipment catalogue/],
    [422, { code: 'invalid_value', message: 'addressee.mobile must be 10 digits', field: 'addressee' }, /addressee.mobile must be 10 digits/],
    [409, { code: 'missing_required', message: 'x', missing: [{ field: 'site.town', message: 'the town' }] }, /required details are still missing/],
    [409, { code: 'render_failed', message: 'x' }, /PDF could not be produced/],
    [429, { code: 'rate_limited', message: 'x' }, /try again in a few seconds/],
  ])('%i %o', (status, detail, re) => {
    const info = documentError(docError(status, detail))
    expect(info.message).toMatch(re)
    expect(info.code).toBe(detail.code)
  })
  it('keeps the field, the missing list, the current revision and Retry-After', () => {
    expect(documentError(docError(422, { code: 'make_not_in_catalogue', field: 'boq[1].make' })).field).toBe('boq[1].make')
    expect(documentError(docError(409, { code: 'missing_required', missing: [{ field: 'site.town', message: 'the town' }] })).missing).toEqual([{ field: 'site.town', message: 'the town' }])
    expect(documentError(docError(409, { code: 'stale_version', current_revision: 5 })).currentRevision).toBe(5)
    expect(documentError(docError(429, { code: 'rate_limited' }, 7)).retryAfterSeconds).toBe(7)
  })
  it('plain 403 / 404 and network failures', () => {
    expect(documentError(new ApiError(403, 'x', 'This proposal is not assigned to you.')).message).toBe('This proposal is not assigned to you.')
    expect(documentError(new ApiError(404, 'x', 'Proposal not found')).message).toMatch(/not found/)
    expect(documentError(new ApiError(0, 'Network request failed')).message).toMatch(/reach the server/)
  })
})

describe('field paths', () => {
  it('anchors and sections', () => {
    expect(fieldAnchorId('connection.discom')).toBe('doc-field-connection-discom')
    expect(fieldAnchorId('boq[2].make')).toBe('doc-field-boq-2-make')
    expect(sectionOfField('boq[2].make')).toBe('boq')
    expect(sectionOfField('price')).toBe('payment_terms')
    expect(sectionOfField('plant.mount_type')).toBe('plant')
    expect(sectionOfField('segment_text')).toBe('connection')
    expect(sectionOfField('header')).toBeNull()
  })
})

describe('save outcome in plain words', () => {
  const fmt = (v: number | null | undefined) => `₹${v}`
  it('names regenerated sections, the layout switch, the price move and the sign-off flip', () => {
    const lines = describeSaveOutcome(
      { totalValue: 201465, requiresSignoff: false, layout: 'compact' },
      editResponse({ regenerated_sections: ['boq', 'payment_terms'], layout: 'detailed', total_value: 980000, requires_manager_signoff: true }),
      fmt,
    )
    expect(lines.join(' ')).toMatch(/Regenerated: Bill of quantity, Price & payment terms/)
    expect(lines.join(' ')).toMatch(/layout is now Detailed/)
    expect(lines.join(' ')).toMatch(/price changed from ₹201465 to ₹980000/)
    expect(lines.join(' ')).toMatch(/now needs manager sign-off/)
  })
  it('says nothing when nothing moved', () => {
    expect(describeSaveOutcome({ totalValue: 201465, requiresSignoff: false, layout: 'compact' }, editResponse(), fmt)).toEqual([])
  })
})

describe('BOQ make helpers', () => {
  it('adds catalogue makes and toggles “Equivalent”', () => {
    expect(addMake('', 'Sova Solar')).toBe('Sova Solar')
    expect(addMake('Sova Solar / Equivalent', 'HR Solar')).toBe('Sova Solar / HR Solar / Equivalent')
    expect(addMake('Sova Solar', 'sova solar')).toBe('Sova Solar')
    expect(withEquivalent('Sova Solar', true)).toBe('Sova Solar / Equivalent')
    expect(withEquivalent('Sova Solar / Equivalent', false)).toBe('Sova Solar')
    expect(hasEquivalent('A / equivalent')).toBe(true)
  })
})

describe('adjust pricing takes exactly one input', () => {
  it('builds one field each, with the reason', () => {
    expect(buildAdjustPricingInput(1, 'new_value', '250000', 'r')).toEqual({ proposalId: 1, newValue: 250000, reason: 'r' })
    expect(buildAdjustPricingInput(1, 'basic_price', '185000.50', 'r')).toEqual({ proposalId: 1, basicPrice: '185000.50', reason: 'r' })
    expect(buildAdjustPricingInput(1, 'rate_per_kwp', '61000', 'r')).toEqual({ proposalId: 1, ratePerKwp: '61000', reason: 'r' })
  })
  it('refuses a missing reason or a bad amount', () => {
    expect(buildAdjustPricingInput(1, 'basic_price', '185000', ' ')).toBe('A reason is required')
    expect(buildAdjustPricingInput(1, 'basic_price', '1.234', 'r')).toMatch(/up to 2 decimals/)
    expect(buildAdjustPricingInput(1, 'rate_per_kwp', '0', 'r')).toMatch(/up to 2 decimals/)
    expect(buildAdjustPricingInput(1, 'new_value', '-5', 'r')).toBe('Enter a valid total value')
  })
})
