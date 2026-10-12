import { describe, it, expect } from 'vitest'
import en from '@/messages/en.json'
import { ApiError } from '@/lib/dashboard/api-error'
import {
  EMPTY_SURVEY_FORM,
  conditionalApplies,
  currentIstMonth,
  recentMonths,
  requiredSurveyFields,
  splitDerivedPatch,
  stepOfSection,
  surveyFieldErrorOf,
  surveyFormFromSiteAssessment,
  surveyPatch,
  surveyPayload,
  surveyWarningText,
  validateBills,
} from '@/lib/associate/survey'
import { validateWizardStep, type WizardDraft } from '@/lib/associate/wizard-validation'
import { surveyResultsSchema, surveyStatusSchema } from '@/lib/associate/survey-schemas'
import { SURVEY_OPTIONS, SURVEY_RESULTS, SURVEY_STATUS_EMPTY, SURVEY_STATUS_SIGNED } from './fixtures/survey-contract'

const t = en.survey
const warningCopy = { warnings: t.warnings, limiting: t.results.limiting, fields: t.fields, roofMaterials: t.roofMaterials, nocStatuses: t.nocStatuses, areaReasons: t.areaReasons }

describe('server site_assessment ↔ survey form', () => {
  const sa = {
    survey_variant: 'housing_society',
    discom: 'WBSEDCL',
    roof_sections: [{ label: 'Main', length_m: '10.00', width_m: '8.00', obstacle_area_sqm: null }],
    shadow_free_area_sqft: 861.1,
    distance_panel_to_inverter_m: '12.35',
    consumption_history: [{ month: '2026-07', units_kwh: 400, bill_inr: 3200 }],
    roof_obstacles: [],
    roof_accessible: false,
  }

  it('reads decimal strings as plain numbers, keeps [] obstacles as "surveyed, none", and false as "no"', () => {
    const f = surveyFormFromSiteAssessment(sa, SURVEY_OPTIONS.discom_options)
    expect(f.roof_sections).toEqual([{ label: 'Main', length: '10', width: '8', obstacle: '' }])
    expect(f.distance_panel_to_inverter_m).toBe('12.35')
    expect(f.roof_obstacles).toEqual([])
    expect(f.roof_accessible).toBe('no')
    expect(f.discom_choice).toBe('WBSEDCL')
    expect(f.area_mode).toBe('sections')
    // Derived from sections — never put back in the form to be re-sent.
    expect(f.shadow_free_area_sqft).toBe('')
  })

  it('a DISCOM not in the options becomes "Other" + free text, and is sent back as the text', () => {
    const f = surveyFormFromSiteAssessment({ discom: 'Tata Power' }, SURVEY_OPTIONS.discom_options)
    expect(f.discom_choice).toBe('Other')
    expect(f.discom_other).toBe('Tata Power')
    expect(surveyPayload(f).discom).toBe('Tata Power')
  })

  it('sends numbers (never strings), sorted months, and drops month-only prompt rows', () => {
    const f = {
      ...EMPTY_SURVEY_FORM,
      bills: [
        { month: '2026-08', units: '350', bill: '' },
        { month: '2026-06', units: '', bill: '' }, // a prompt
        { month: '2026-07', units: '400', bill: '3200.5' },
      ],
      roof_sections: [{ label: 'Main', length: '10', width: '8', obstacle: '2' }],
      distance_panel_to_inverter_m: '12.35',
    }
    const p = surveyPayload(f)
    expect(p.consumption_history).toEqual([
      { month: '2026-07', units_kwh: 400, bill_inr: 3200.5 },
      { month: '2026-08', units_kwh: 350 },
    ])
    expect(p.roof_sections).toEqual([{ label: 'Main', length_m: 10, width_m: 8, obstacle_area_sqm: 2 }])
    expect(p.distance_panel_to_inverter_m).toBe(12.35)
  })

  it('never sends shadow_free_area_sqft while measuring sections (422 derived_field)', () => {
    const f = { ...EMPTY_SURVEY_FORM, area_mode: 'sections' as const, shadow_free_area_sqft: '500', roof_sections: [{ label: 'A', length: '5', width: '5', obstacle: '' }] }
    expect('shadow_free_area_sqft' in surveyPayload(f)).toBe(false)
  })
})

describe('PATCH diff', () => {
  const server = surveyFormFromSiteAssessment({ roof_sections: [{ label: 'Main', length_m: '10.00', width_m: '8.00' }], discom: 'CESC' }, SURVEY_OPTIONS.discom_options)

  it('an untouched step sends nothing', () => {
    expect(surveyPatch(server, server, ['discom', 'roof_sections', 'roof_material'])).toEqual({})
  })

  it('only the changed fields of the step are sent', () => {
    const mine = { ...server, roof_material: 'tin_shed', consumer_number: '123' }
    expect(surveyPatch(mine, server, ['roof_material', 'roof_sections', 'discom'])).toEqual({ roof_material: 'tin_shed' })
  })

  it('switching from stored sections to a typed area is split into two requests, sections cleared first', () => {
    const mine = { ...server, area_mode: 'direct' as const, shadow_free_area_sqft: '700' }
    const patch = surveyPatch(mine, server, ['roof_sections', 'shadow_free_area_sqft'])
    expect(patch).toEqual({ roof_sections: [], shadow_free_area_sqft: 700 })
    expect(splitDerivedPatch(patch, server)).toEqual([{ roof_sections: [] }, { shadow_free_area_sqft: 700 }])
  })

  it('a typed area without stored sections goes in one request', () => {
    const none = { ...EMPTY_SURVEY_FORM }
    const patch = surveyPatch({ ...none, area_mode: 'direct', shadow_free_area_sqft: '700' }, none, ['roof_sections', 'shadow_free_area_sqft'])
    expect(splitDerivedPatch(patch, none)).toEqual([{ shadow_free_area_sqft: 700 }])
  })
})

describe('bills', () => {
  const now = new Date('2026-10-12T06:00:00Z')

  it('the current month follows IST, not UTC', () => {
    // 30 Sep 19:00 UTC is already 1 Oct 00:30 in India.
    expect(currentIstMonth(new Date('2026-09-30T19:00:00Z'))).toBe('2026-10')
  })

  it('prompts the months before the current one, newest first', () => {
    expect(recentMonths(3, now)).toEqual(['2026-09', '2026-08', '2026-07'])
  })

  it('flags invalid, future and duplicate months, and a bill without units', () => {
    const problems = validateBills(
      [
        { month: '2026-09', units: '300', bill: '' },
        { month: '2026-11', units: '300', bill: '' },
        { month: '2026-09', units: '310', bill: '' },
        { month: '1999-01', units: '1', bill: '' },
        { month: '2026-08', units: '', bill: '900' },
        { month: '2026-07', units: '-4', bill: '' },
      ],
      now
    )
    expect(problems[0]).toBeUndefined()
    expect(problems[1]).toEqual(['future_month'])
    expect(problems[2]).toEqual(['duplicate_month'])
    expect(problems[3]).toEqual(['invalid_month'])
    expect(problems[4]).toEqual(['units_required'])
    expect(problems[5]).toEqual(['invalid_number'])
  })

  it('the bills step reports too many months against max_consumption_months', () => {
    const bills = Array.from({ length: 13 }, (_, i) => ({ month: `2025-${String((i % 12) + 1).padStart(2, '0')}`, units: '1', bill: '' }))
    const d = { survey: { ...EMPTY_SURVEY_FORM, bills } } as unknown as WizardDraft
    const errs = validateWizardStep('bills', d, {
      isNew: true,
      survey: SURVEY_OPTIONS,
      v: en.associates.portal.wizard.validation,
      s: { bills: t.bills.errors, roof: t.roof.errors, layout: t.layout.errors },
      now,
    })
    expect(errs.bills).toBe('You can enter at most 12 months.')
  })
})

describe('conditional fields and steps', () => {
  it('tenant NOC is asked only when the roof is not owned (options.conditional)', () => {
    expect(conditionalApplies(SURVEY_OPTIONS, { ...EMPTY_SURVEY_FORM, roof_ownership_confirmed: '' }, 'tenant_noc_available')).toBe(false)
    expect(conditionalApplies(SURVEY_OPTIONS, { ...EMPTY_SURVEY_FORM, roof_ownership_confirmed: 'yes' }, 'tenant_noc_available')).toBe(false)
    expect(conditionalApplies(SURVEY_OPTIONS, { ...EMPTY_SURVEY_FORM, roof_ownership_confirmed: 'no' }, 'tenant_noc_available')).toBe(true)
  })

  it('variant extras and conditionals join the required set', () => {
    const req = requiredSurveyFields(SURVEY_OPTIONS, { ...EMPTY_SURVEY_FORM, survey_variant: 'commercial_roof', roof_material: 'other' })
    expect(req.has('contract_demand_kva')).toBe(true)
    expect(req.has('roof_material_other')).toBe(true)
    expect(req.has('society_flat_count')).toBe(false)
  })

  it('maps every section to the step it is filled on', () => {
    expect(stepOfSection('connection')).toBe('connection')
    expect(stepOfSection('bills')).toBe('bills')
    expect(stepOfSection('roof')).toBe('house')
    expect(stepOfSection('roof_area')).toBe('house')
    expect(stepOfSection('layout')).toBe('layout')
    expect(stepOfSection('future_section', ['water_available'])).toBe('layout')
    expect(stepOfSection('future_section', [])).toBeNull()
  })
})

describe('warnings are translated from code + params, never shown raw', () => {
  it.each([
    [{ code: 'requested_above_suggested', params: { requested_kw: 5, suggested_kw: 3, limiting_factor: 'area' } }, 'The customer asked for 5 kW, but the survey suggests 3 kW (limited by roof area).'],
    [{ code: 'implied_tariff_outside_range', params: { implied_tariff_inr_per_kwh: '25.00', min: 3, max: 20 } }, 'The bills work out to ₹25.00 per unit, outside the usual ₹3–₹20.'],
    [{ code: 'units_bill_mismatch', params: { field: 'avg_monthly_units_kwh', entered: '500.00', from_bills: '380.00' } }, 'Average monthly units (500.00)'],
    [{ code: 'fragile_roof', params: { roof_material: 'asbestos' } }, 'This roof (Asbestos)'],
    [{ code: 'society_noc_missing', params: { society_noc_status: 'in_progress' } }, 'In progress'],
    [{ code: 'area_implausible', params: { reason: 'roof_area_large' } }, 'the roof area looks unusually large'],
    [{ code: 'overhead_line' }, 'overhead power line'],
    [{ code: 'duplicate_consumer_number' }, 'Another associate'],
  ])('%o', (w, expected) => {
    expect(surveyWarningText(w, warningCopy)).toContain(expected)
  })

  it('an unknown future code gets the generic sentence, not the code', () => {
    const text = surveyWarningText({ code: 'brand_new_code', params: {} }, warningCopy)
    expect(text).toBe(t.warnings.unknown)
    expect(text).not.toContain('brand_new_code')
  })

  it('every documented code has a message in each language file', async () => {
    const codes = ['requested_above_suggested', 'load_enhancement_needed', 'implied_tariff_outside_range', 'units_bill_mismatch', 'three_phase_below_min', 'fragile_roof', 'overhead_line', 'roof_not_owned_no_noc', 'society_noc_missing', 'area_implausible', 'duplicate_consumer_number']
    for (const lang of ['en', 'hi', 'bn']) {
      const m = (await import(`@/messages/${lang}.json`)).default
      for (const c of codes) expect(m.survey.warnings[c], `${lang}:${c}`).toBeTruthy()
    }
  })
})

describe('structured 422s', () => {
  it('reads {code, field, index} and ignores FastAPI list details and other statuses', () => {
    expect(surveyFieldErrorOf(new ApiError(422, 'x', 'm', { code: 'future_month', field: 'consumption_history', index: 2 }))).toEqual({ code: 'future_month', field: 'consumption_history', index: 2 })
    expect(surveyFieldErrorOf(new ApiError(422, 'x', 'm', [{ loc: ['body', 'floors'] }] as unknown as Record<string, unknown>))).toBeNull()
    expect(surveyFieldErrorOf(new ApiError(409, 'x', 'm', { code: 'not_editable' }))).toBeNull()
  })
})

describe('response schemas accept the contract and refuse drift', () => {
  it('accepts the §3 and §4 examples', () => {
    expect(surveyStatusSchema.safeParse(SURVEY_STATUS_EMPTY).success).toBe(true)
    expect(surveyStatusSchema.safeParse(SURVEY_STATUS_SIGNED).success).toBe(true)
    expect(surveyResultsSchema.safeParse(SURVEY_RESULTS).success).toBe(true)
    // Engineers get no estimate key (§4) — still valid.
    const { estimate: _drop, ...noEstimate } = SURVEY_RESULTS
    void _drop
    expect(surveyResultsSchema.safeParse(noEstimate).success).toBe(true)
  })

  it('refuses kW as a string or money as a number', () => {
    expect(surveyResultsSchema.safeParse({ ...SURVEY_RESULTS, suggested_kw: '3' }).success).toBe(false)
    expect(surveyResultsSchema.safeParse({ ...SURVEY_RESULTS, bills: { ...SURVEY_RESULTS.bills, average_monthly_bill_inr: 3200 } }).success).toBe(false)
  })
})
