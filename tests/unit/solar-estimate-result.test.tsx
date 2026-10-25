import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react'
import SolarEstimateResult from '@/components/pricing/SolarEstimateResult'
import { parseSolarEstimate, type SolarEstimate } from '@/lib/pricing/solar-estimate'
import { formatGrouped, formatInr } from '@/lib/money'
import { withI18n, en } from './helpers/i18n'
import { CATALOGUE } from './fixtures/pricing'
import {
  ASSAM_300_UNITS,
  CESC_BILL_NO_PHASE,
  ESTIMATE_ASSUMPTIONS,
  EXAMPLE_A,
  EXAMPLE_B,
  EXAMPLE_C,
  EXAMPLE_C_NO_HOUSES,
} from './fixtures/solar-estimate-contract'
import { without } from './helpers/object'

// The shared BE-14 result, fed the engine's own responses for the contract's
// worked examples. Every expected figure below is read from the fixture and
// only formatted — the test never computes one either.

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const est = (data: unknown) => parseSolarEstimate(data) as SolarEstimate
const t = en.pricing.estimate

function show(data: unknown, props: Partial<Parameters<typeof SolarEstimateResult>[0]> = {}) {
  return render(withI18n(<SolarEstimateResult estimate={est(data)} catalogue={CATALOGUE} {...props} />))
}

describe('SolarEstimateResult — example A (West Bengal, 360 units, flat ₹9)', () => {
  const a = EXAMPLE_A

  it('summarises size, the reason, cost after CONFIRMED subsidy only, saving and payback', () => {
    show(a)
    const s = screen.getByTestId('estimate-summary')
    expect(within(s).getByTestId('recommended-kw')).toHaveTextContent(`${a.figures_for_kw} kW`)
    expect(within(s).getByTestId('sizing-basis')).toHaveTextContent(`Based on your ${a.monthly_units_used} units a month.`)
    expect(within(s).getByTestId('snapped-note')).toHaveTextContent(`Your recommended ${a.recommended_kw_exact} kW is quoted as a ${a.priced_kw} kW system`)
    const assured = a.packages.NOVA_ASSURED
    expect(within(s).getByTestId('summary-net')).toHaveTextContent(formatInr(assured.net_after_subsidy))
    // The announced West Bengal support is never taken off the headline cost.
    expect(within(s).getByTestId('summary-net')).not.toHaveTextContent(formatInr(assured.net_if_announced_support_received))
    expect(within(s).getByTestId('summary-saving')).toHaveTextContent(`${formatInr(a.savings.monthly)} a month`)
    expect(within(s).getByTestId('summary-payback')).toHaveTextContent(`about ${a.payback_years} years`)
  })

  it('says how sure it is and, when approximate, why — from the response', () => {
    show(a)
    const c = screen.getByTestId('confidence')
    expect(c).toHaveAttribute('data-confidence', a.confidence)
    expect(c).toHaveTextContent('Approximate')
    expect(c).toHaveTextContent(`Based on an average ₹${a.savings.rate_inr_per_kwh} per unit — enter your units and bill amount for a better estimate.`)
  })

  it('shows the priced and the floor size as two cards with their coverage', () => {
    show(a)
    const cards = screen.getAllByTestId('size-option')
    expect(cards.map((c) => c.getAttribute('data-role'))).toEqual(a.size_options.map((o) => o.role))
    a.size_options.forEach((o, i) => {
      expect(cards[i]).toHaveTextContent(`${o.kw} kW`)
      expect(within(cards[i]).getByTestId('option-coverage')).toHaveTextContent(`Covers about ${o.coverage_percent}% of your use`)
      expect(cards[i]).toHaveTextContent(`${formatGrouped(o.generation.monthly_units)} units a month`)
      expect(cards[i]).toHaveTextContent(`${formatInr(o.packages.NOVA_ASSURED.net_after_subsidy)} after confirmed subsidy`)
      expect(cards[i]).toHaveTextContent(`Saves ${formatInr(o.monthly_saving)} a month`)
      expect(cards[i]).toHaveTextContent(`Pays back in about ${o.payback_years} years`)
    })
    expect(cards[0]).toHaveTextContent('Recommended')
    expect(cards[1]).toHaveTextContent('Smaller option')
  })

  it('breaks the subsidy down: central slabs (confirmed), state support (announced), both net-cost lines', () => {
    show(a)
    const b = screen.getByTestId('subsidy-breakdown')
    const central = within(b).getByTestId('subsidy-central')
    expect(within(central).getByTestId('status-badge')).toHaveAttribute('data-status', 'confirmed')
    expect(central).toHaveTextContent('Central government subsidy (PM Surya Ghar)')
    const slabs = within(central).getAllByTestId('subsidy-slab')
    a.subsidy.central!.slabs.forEach((sl, i) => {
      expect(slabs[i]).toHaveTextContent(`${sl.from_kwp}–${sl.to_kwp} kW: ${sl.kwp} kW × ${formatInr(sl.rate_per_kwp)} per kW`)
      expect(slabs[i]).toHaveTextContent(formatInr(sl.amount))
    })
    const state = within(b).getByTestId('subsidy-state')
    expect(state).toHaveAttribute('data-status', 'announced')
    expect(state).toHaveTextContent(`${a.subsidy.state[0].state} government support`)
    expect(state).toHaveTextContent('Announced — subject to the official order')
    expect(state).toHaveTextContent(formatInr(a.subsidy.state[0].amount))
    expect(within(b).getByTestId('subsidy-confirmed-total')).toHaveTextContent(formatInr(a.subsidy.confirmed_total))

    const net = within(b).getByTestId('net-cost')
    for (const p of Object.values(a.packages)) expect(net).toHaveTextContent(`${p.display_name}${formatInr(p.net_after_subsidy)}`)
    const ifAnnounced = within(net).getByTestId('net-if-announced')
    expect(within(ifAnnounced).getByTestId('status-badge')).toHaveAttribute('data-status', 'announced')
    for (const p of Object.values(a.packages)) expect(ifAnnounced).toHaveTextContent(formatInr(p.net_if_announced_support_received))
    expect(b).toHaveTextContent(/not taken off your cost above/i)
    // Never "guaranteed", never "free electricity".
    expect(document.body.textContent).not.toMatch(/guarantee|free electricity/i)
  })

  it('lists every subsidy condition in plain words (DCR explained)', () => {
    show(a)
    const list = screen.getByTestId('subsidy-conditions')
    const words = en.pricing.subsidy.conditions as Record<string, string>
    for (const c of a.subsidy.conditions) expect(list).toHaveTextContent(words[c])
    expect(list).toHaveTextContent('Made-in-India panels (DCR) are required for the subsidy.')
  })

  it('shows generation, savings, payback and the 25-year figures with the assumptions behind them', () => {
    show(a)
    const g = screen.getByTestId('generation')
    expect(g).toHaveTextContent(`${formatGrouped(a.generation.monthly_units)} units a month`)
    expect(g).toHaveTextContent(`${formatGrouped(a.generation.annual_units)} units a year`)
    const s = screen.getByTestId('savings')
    expect(within(s).getByTestId('saving-monthly')).toHaveTextContent(formatInr(a.savings.monthly))
    expect(within(s).getByTestId('saving-yearly')).toHaveTextContent(formatInr(a.savings.annual))
    expect(within(s).getByTestId('payback')).toHaveTextContent(`about ${a.payback_years} years`)
    const lt = within(s).getByTestId('long-term')
    expect(lt).toHaveTextContent(`Over ${a.long_term.years} years`)
    expect(lt).toHaveTextContent(`${formatInr(a.long_term.total_savings)} saved`)
    expect(lt).toHaveTextContent(`${formatGrouped(a.long_term.total_generation)} units made`)
    expect(lt).toHaveTextContent(`drops ${a.long_term.assumptions.degradation_first_year_percent}% in year 2`)
    expect(lt).toHaveTextContent(`${a.long_term.assumptions.degradation_annual_percent}% a year after that`)
    expect(lt).toHaveTextContent(/kept at today’s level/) // escalation "0"
  })

  it('carries the estimate version and the footer note', () => {
    show(a)
    expect(screen.getByTestId('solar-estimate')).toHaveAttribute('data-version', a.estimate_version)
    expect(screen.getByTestId('estimate-footer')).toHaveTextContent(/estimate only/i)
    expect(screen.getByTestId('estimate-footer')).toHaveTextContent(/paid by the government into your bank account after your DISCOM inspects/i)
  })

  it('keeps both packages equal, with the list prices exactly as sent, and no second subsidy block', () => {
    show(a)
    const cards = screen.getAllByTestId('package-card')
    expect(cards.map((c) => c.getAttribute('data-package'))).toEqual(['NOVA_ASSURED', 'NOVA_SIGNATURE'])
    expect(cards[0]).toHaveTextContent(formatInr(a.packages.NOVA_ASSURED.final))
    expect(cards[1]).toHaveTextContent(formatInr(a.packages.NOVA_SIGNATURE.final))
    expect(screen.queryByTestId('subsidy-block')).not.toBeInTheDocument()
    expect(screen.queryByTestId('size-lines')).not.toBeInTheDocument()
  })

  it('hides every price, but not the subsidy or savings, when the catalogue hides prices', () => {
    show(a, { hidePrices: true })
    expect(screen.queryByTestId('summary-net')).not.toBeInTheDocument()
    expect(screen.queryByTestId('net-cost')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain(formatInr(a.packages.NOVA_ASSURED.final))
    expect(document.body.textContent).not.toContain(formatInr(a.size_options[1].packages.NOVA_ASSURED.net_after_subsidy))
    expect(screen.getByTestId('subsidy-breakdown')).toHaveTextContent(formatInr(a.subsidy.confirmed_total))
    expect(screen.getByTestId('savings')).toHaveTextContent(formatInr(a.savings.monthly))
  })
})

describe('SolarEstimateResult — example B (Bihar, own price per unit, free units, above sanctioned load)', () => {
  const b = EXAMPLE_B

  it('turns every warning into plain words with its numbers', () => {
    show(b)
    const w = screen.getByTestId('estimate-warnings')
    const d = b.warning_details.above_sanctioned_load
    expect(within(w).getByTestId('estimate-warning-above_sanctioned_load')).toHaveTextContent(
      `This system (${d.priced_kw} kW) is above your sanctioned load (${d.sanctioned_load_kw} kW). You may need to increase your sanctioned load with your DISCOM — Grid Nova handles this.`
    )
    expect(within(w).getByTestId('estimate-warning-tariff_table_not_available')).toHaveTextContent(
      `We do not have ${b.warning_details.tariff_table_not_available.discom}’s official tariff yet`
    )
    expect(within(w).getAllByRole('listitem')).toHaveLength(b.warnings.length)
  })

  it('explains the free units and marks them announced; medium confidence uses the customer\'s own rate', () => {
    show(b)
    const free = screen.getByTestId('free-units')
    expect(free).toHaveTextContent(`The first ${b.savings.free_units_per_month} units a month are free`)
    expect(within(free).getByTestId('status-badge')).toHaveAttribute('data-status', 'announced')
    const c = screen.getByTestId('confidence')
    expect(c).toHaveTextContent('Medium')
    expect(c).toHaveTextContent(`Based on your own bill: about ₹${b.savings.rate_inr_per_kwh} per unit.`)
    expect(screen.getByTestId('sizing-basis')).toHaveTextContent(`Based on your ${b.monthly_units_used} units a month and your bill.`)
  })

  it('shows the announced Bihar support with its end date, and the net cost without it', () => {
    show(b)
    const state = screen.getByTestId('subsidy-state')
    expect(state).toHaveTextContent('Bihar government support')
    expect(state).toHaveTextContent('Announced until 13 Aug 2027')
    expect(screen.getByTestId('summary-net')).toHaveTextContent(formatInr(b.packages.NOVA_ASSURED.net_after_subsidy))
    expect(screen.getByTestId('net-if-announced')).toHaveTextContent(formatInr(b.net_cost_if_announced_support_received))
  })
})

describe('SolarEstimateResult — housing societies (example C)', () => {
  it('shows the society subsidy and why it is limited; a custom quote has no price and no payback', () => {
    const c = EXAMPLE_C
    show(c)
    const soc = screen.getByTestId('subsidy-society')
    const s = c.subsidy.society!
    expect(soc).toHaveTextContent(`${s.eligible_kwp} kW × ${formatInr(s.rate_per_kwp)} per kW`)
    expect(soc).toHaveTextContent(formatInr(s.total))
    expect(within(soc).getByTestId('society-limited')).toHaveTextContent(`Up to ${s.kwp_per_house} kW per flat × ${s.number_of_houses} flats`)
    expect(screen.queryByTestId('subsidy-central')).not.toBeInTheDocument()
    expect(screen.getByTestId('custom-quote')).toHaveTextContent(/larger than our price list/i)
    expect(screen.queryByTestId('package-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('net-cost')).not.toBeInTheDocument()
    expect(screen.queryByTestId('summary-net')).not.toBeInTheDocument()
    // Roof area only: no savings, and it says why.
    expect(screen.getByTestId('no-savings')).toHaveTextContent(/enter your monthly units or bill amount/i)
    expect(screen.getByTestId('confidence')).toHaveTextContent('Based on your roof area only')
    expect(screen.getByTestId('sizing-basis')).toHaveTextContent('Limited by your roof area.')
  })

  it('asks for the number of flats when the engine needs it, and deducts nothing', () => {
    show(EXAMPLE_C_NO_HOUSES, { housesPrompt: <button type="button">enter flats</button> })
    const prompt = screen.getByTestId('needs-houses')
    expect(prompt).toHaveTextContent(/how many flats or houses share this roof/i)
    expect(within(prompt).getByRole('button', { name: 'enter flats' })).toBeInTheDocument()
    expect(screen.queryByTestId('subsidy-society')).not.toBeInTheDocument()
    expect(screen.queryByTestId('subsidy-confirmed-total')).not.toBeInTheDocument()
  })
})

describe('SolarEstimateResult — custom quotes', () => {
  it('special-category state: the higher central rate, and only the reason that applies (not the phase)', () => {
    const s = ASSAM_300_UNITS
    show(s, { phasePrompt: <div data-testid="phase-prompt" /> })
    expect(screen.getByTestId('subsidy-central')).toHaveTextContent('Your state gets the higher special-category rate.')
    for (const sl of s.subsidy.central!.slabs) expect(screen.getByTestId('subsidy-central')).toHaveTextContent(formatInr(sl.amount))
    const notice = screen.getByTestId('custom-quote')
    expect(notice).toHaveTextContent(/West Bengal only/i)
    expect(notice).not.toHaveTextContent(/connection phase/i)
    expect(screen.queryByTestId('phase-prompt')).not.toBeInTheDocument()
    expect(screen.getByTestId('estimate-warning-generation_unconfirmed_for_state')).toHaveTextContent('Our generation figure for Assam is not confirmed yet')
    expect(within(screen.getByTestId('generation')).getByTestId('status-badge')).toHaveAttribute('data-status', 'unconfirmed')
    expect(screen.getByTestId('summary-payback')).toHaveTextContent('Shown once we have a price')
  })

  it('only the phase missing: the calculator\'s phase question replaces the notice', () => {
    show(CESC_BILL_NO_PHASE, { phasePrompt: <div data-testid="phase-prompt">choose</div> })
    expect(screen.getByTestId('phase-prompt')).toBeInTheDocument()
    expect(screen.queryByTestId('custom-quote')).not.toBeInTheDocument()
  })

  it('read-only (no prompt given): the plain notice, never an input', () => {
    show(CESC_BILL_NO_PHASE)
    expect(screen.getByTestId('custom-quote')).toHaveTextContent(/connection phase/i)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('"How we calculate"', () => {
  function openPanel() {
    const details = screen.getByTestId('how-we-calculate') as HTMLDetailsElement
    details.open = true
    fireEvent(details, new Event('toggle'))
  }

  it('loads GET /pricing/estimate-assumptions on first open and shows each value with status and source', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(ESTIMATE_ASSUMPTIONS), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    show(EXAMPLE_A)
    expect(fetchMock).not.toHaveBeenCalled()
    openPanel()
    const panel = await screen.findByTestId('assumptions-panel')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/pricing\/estimate-assumptions$/), expect.anything())

    const wb = ESTIMATE_ASSUMPTIONS.generation.units_per_kwp_per_month[0]
    const item = within(panel).getAllByTestId('assumption').find((li) => li.textContent!.includes('— West Bengal'))!
    expect(item).toHaveTextContent(`${wb.value} units`)
    expect(within(item).getByTestId('status-badge')).toHaveAttribute('data-status', wb.status)
    expect(item).toHaveTextContent(`Source: ${wb.source}`)
    // Announced state support stays announced in the panel too.
    const bihar = within(panel).getAllByTestId('assumption').find((li) => li.textContent!.startsWith('Bihar government support'))!
    expect(within(bihar).getByTestId('status-badge')).toHaveAttribute('data-status', 'announced')
    expect(panel).toHaveTextContent(ESTIMATE_ASSUMPTIONS.subsidies.deduction_rule)
    expect(panel).toHaveTextContent(`Estimate version ${ESTIMATE_ASSUMPTIONS.estimate_version}`)
    expect(within(panel).getAllByTestId('status-badge').length).toBeGreaterThan(20)

    // Opening again does not refetch.
    openPanel()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the estimate\'s own assumptions when the route cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('down')))
    show(EXAMPLE_A)
    openPanel()
    const list = await screen.findByTestId('assumptions-fallback')
    expect(screen.getByText(t.how.error)).toBeInTheDocument()
    expect(within(list).getAllByTestId('assumption')).toHaveLength(EXAMPLE_A.assumptions.length)
  })
})

describe('An estimate without BE-14 fields', () => {
  it('draws only what is present — no empty subsidy, savings or generation sections invented', () => {
    show(without(EXAMPLE_A, 'subsidy', 'savings', 'generation', 'long_term', 'size_options', 'warnings', 'confidence'))
    expect(screen.queryByTestId('subsidy-breakdown')).not.toBeInTheDocument()
    expect(screen.queryByTestId('generation')).not.toBeInTheDocument()
    expect(screen.queryByTestId('size-option')).not.toBeInTheDocument()
    expect(screen.queryByTestId('confidence')).not.toBeInTheDocument()
    expect(screen.getByTestId('no-savings')).toBeInTheDocument()
    expect(screen.getAllByTestId('package-card')).toHaveLength(2)
  })
})

describe('Every warning code in the contract has words', () => {
  it.each([
    'above_sanctioned_load',
    'priced_size_exceeds_roof_area',
    'generation_unconfirmed_for_state',
    'implied_tariff_outside_range',
    'implied_rate_unavailable_within_free_units',
    'unknown_discom',
    'tariff_table_not_available',
    'tariff_category_needed',
    'bill_not_solvable_with_tariff_table',
    'bill_not_solvable',
  ])('%s', (code) => {
    expect((t.warnings as Record<string, string>)[code]).toBeTruthy()
  })

  it('an unknown future code gets a neutral line, not its machine name', async () => {
    show({ ...EXAMPLE_A, warnings: ['some_new_code'], warning_details: {} })
    await waitFor(() => expect(screen.getByTestId('estimate-warning-some_new_code')).toHaveTextContent(t.warnings.other))
  })
})
