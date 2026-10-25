import { describe, it, expect } from 'vitest'
import {
  discomCode,
  estimateSnapshot,
  figuresKw,
  fromSurveyEstimate,
  isSolarEstimate,
  parseSolarEstimate,
} from '@/lib/pricing/solar-estimate'
import { formatGrouped, formatInr } from '@/lib/money'
import { DISCOMS_BY_STATE } from '@/app/(internal)/proposal/new/types'
import { EXAMPLE_A, EXAMPLE_B, EXAMPLE_C_NO_HOUSES } from './fixtures/solar-estimate-contract'
import { without } from './helpers/object'

describe('parseSolarEstimate', () => {
  it('keeps every BE-14 field of a real response, as strings', () => {
    const e = parseSolarEstimate(EXAMPLE_B)!
    expect(isSolarEstimate(e)).toBe(true)
    expect(e.estimate_version).toBe(EXAMPLE_B.estimate_version)
    expect(e.size_options).toHaveLength(2)
    expect(e.size_options![1]).toMatchObject({ role: 'floor', coverage_percent: EXAMPLE_B.size_options[1].coverage_percent })
    expect(e.subsidy!.state[0]).toMatchObject({ state: 'Bihar', status: 'announced' })
    expect(e.savings!.free_units_per_month).toBe(EXAMPLE_B.savings.free_units_per_month)
    expect(e.warning_details!.above_sanctioned_load).toEqual(EXAMPLE_B.warning_details.above_sanctioned_load)
    expect(figuresKw(e)).toBe(EXAMPLE_B.figures_for_kw)
  })

  it('drops a malformed part instead of showing it wrong', () => {
    const e = parseSolarEstimate({ ...EXAMPLE_A, savings: { monthly: 3240 }, subsidy: { status: 7 }, confidence: 'certain', size_options: [{ role: 'floor' }] })!
    expect(e.savings).toBeNull()
    expect(e.subsidy).toBeNull()
    expect(e.confidence).toBeNull()
    expect(e.size_options).toEqual([])
  })

  it('an older response (no estimate_version) is not a BE-14 estimate', () => {
    expect(isSolarEstimate(parseSolarEstimate(without(EXAMPLE_A, 'estimate_version'))!)).toBe(false)
  })
})

describe('discomCode — the engine looks tariffs up by code', () => {
  it('maps the calculator\'s DISCOM names to the contract\'s codes', () => {
    expect(discomCode('WBSEDCL')).toBe('WBSEDCL')
    expect(discomCode('CESC Limited (Kolkata & parts of Howrah)')).toBe('CESC')
    expect(discomCode('NBPDCL (North Bihar)')).toBe('NBPDCL')
    expect(discomCode('SBPDCL (South Bihar)')).toBe('SBPDCL')
  })

  it('never turns another state\'s DISCOM into a West Bengal or Bihar code', () => {
    expect(discomCode('CESC Mysuru')).toBe('CESC Mysuru')
    const codes = new Set(['WBSEDCL', 'CESC', 'NBPDCL', 'SBPDCL'])
    for (const [state, list] of Object.entries(DISCOMS_BY_STATE)) {
      if (state === 'West Bengal' || state === 'Bihar') continue
      for (const name of list) expect(codes.has(discomCode(name)), `${state}: ${name}`).toBe(false)
    }
  })
})

describe('estimateSnapshot — what the lead keeps', () => {
  it('copies the version, size, net cost and subsidy split exactly as the backend sent them', () => {
    expect(estimateSnapshot(parseSolarEstimate(EXAMPLE_A)!)).toEqual({
      estimateVersion: EXAMPLE_A.estimate_version,
      sizeKw: EXAMPLE_A.figures_for_kw,
      priceStatus: 'list_price',
      netCostInr: EXAMPLE_A.packages.NOVA_ASSURED.net_after_subsidy,
      netCostIfAnnouncedInr: EXAMPLE_A.net_cost_if_announced_support_received,
      subsidyConfirmedInr: EXAMPLE_A.subsidy.confirmed_total,
      subsidyAnnouncedInr: EXAMPLE_A.subsidy.announced_total,
      subsidyStatus: 'eligible',
      monthlySavingInr: EXAMPLE_A.savings.monthly,
      paybackYears: EXAMPLE_A.payback_years,
      confidence: EXAMPLE_A.confidence,
    })
  })

  it('a society without its flat count has no net cost to keep', () => {
    const s = estimateSnapshot(parseSolarEstimate(EXAMPLE_C_NO_HOUSES)!)
    expect(s.subsidyStatus).toBe('needs_number_of_houses')
    expect(s.netCostInr).toBeUndefined()
  })
})

describe('fromSurveyEstimate', () => {
  it('reads a BE-14 survey estimate (size_kw is the size every figure is for)', () => {
    const survey = {
      indicative: true, size_kw: 3, price_status: 'list_price', custom_quote_reasons: [], priced_kw: 3, phase: 'SINGLE',
      packages: EXAMPLE_A.packages, subsidy_inr: '78000.00', subsidy_conditions: EXAMPLE_A.subsidy_conditions, price_list_version: 1,
      estimate_version: EXAMPLE_A.estimate_version, subsidy: EXAMPLE_A.subsidy, subsidy_status: 'eligible',
      announced_state_support: EXAMPLE_A.announced_state_support, net_cost: '123465.00',
      net_cost_if_announced_support_received: EXAMPLE_A.net_cost_if_announced_support_received, generation: EXAMPLE_A.generation,
      coverage_percent: EXAMPLE_A.coverage_percent, savings: EXAMPLE_A.savings, payback_years: EXAMPLE_A.payback_years,
      long_term: EXAMPLE_A.long_term, confidence: EXAMPLE_A.confidence,
    }
    const e = fromSurveyEstimate(survey)!
    expect(figuresKw(e)).toBe('3')
    expect(e.subsidy!.confirmed_total).toBe(EXAMPLE_A.subsidy.confirmed_total)
    expect(e.payback_years).toBe(EXAMPLE_A.payback_years)
  })

  it('is null for a pre-BE-14 survey estimate or one that could not be sized', () => {
    expect(fromSurveyEstimate({ price_status: 'list_price', packages: {} })).toBeNull()
    expect(fromSurveyEstimate({ estimate_version: '1.1+x', price_status: 'not_enough_to_size', packages: {}, custom_quote_reasons: [] })).toBeNull()
  })
})

describe('formatting never changes a figure', () => {
  it('groups units the Indian way and leaves decimals as sent', () => {
    expect(formatGrouped('132492')).toBe('1,32,492')
    expect(formatGrouped('444.44')).toBe('444.44')
    expect(formatGrouped(null)).toBe('—')
    expect(formatInr('163904.50')).toBe('₹1,63,904.50')
  })
})
