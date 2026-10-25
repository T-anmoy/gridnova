import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SolarCalculator from '@/app/(site)/[lang]/solar-calculator/SolarCalculator'
import { configuratorMirrorPayload } from '@/lib/lead-mirror'
import { configuratorLeadSchema } from '@/lib/lead-schemas'
import { withI18n } from './helpers/i18n'
import { fillLocation, fillProperty, fillUsage } from './helpers/calculator'
import { loadOpenApi, requestSchema, validate } from './helpers/openapi'
import { CATALOGUE } from './fixtures/pricing'
import { EXAMPLE_A } from './fixtures/solar-estimate-contract'
import en from '@/messages/en.json'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'

const ROOT = path.resolve(__dirname, '../..')
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── No figures in the browser ─────────────────────────────────────────────

/** Every file FE-14 added or changed that draws or requests an estimate. */
const ESTIMATE_FILES = [
  'components/pricing/SolarEstimateResult.tsx',
  'components/pricing/HowWeCalculate.tsx',
  'components/pricing/StatusBadge.tsx',
  'lib/pricing/solar-estimate.ts',
  'app/(site)/[lang]/solar-calculator/SolarCalculator.tsx',
  'app/(site)/[lang]/solar-calculator/CalculatorReveal.tsx',
  'app/(site)/[lang]/solar-calculator/BillCard.tsx',
  'app/(site)/[lang]/solar-calculator/lib.ts',
  'components/associate/EstimateSection.tsx',
  'components/associate/survey/SurveyStep.tsx',
  'components/dashboard/SurveyPanel.tsx',
  'app/(site)/[lang]/book-a-call/BookingContextSummary.tsx',
]

/** Source without comments, so an explanation may mention a figure but code may not. */
function code(file: string): string {
  return read(file)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:"'`])\/\/.*$/gm, '$1')
}

describe('no hard-coded money, rates or subsidy figures in the estimate screens', () => {
  it.each(ESTIMATE_FILES)('%s', (file) => {
    const src = code(file)
    const hits = [
      ...src.matchAll(/₹\s*[\d,]+/g), // a rupee amount
      ...src.matchAll(/\b\d+(?:\.\d+)?\s?%/g), // a percentage
      ...src.matchAll(/\b\d+(?:\.\d+)?\s?(?:kWp?|kWh|units?|sq\.?\s?ft)\b/gi), // a size, energy or area rate
      ...src.matchAll(/\b(?:30,?000|18,?000|78,?000|33,?000|19,?800|85,?800|15,?000|20,?000|10,?000)\b/g), // CFA / state figures
      ...src.matchAll(/\bPLACEHOLDER_ROOF_AREA_SQFT_PER_KW\b|\broofAreaToSizeKw\b/g),
    ].map((m) => m[0])
    expect(hits, `hard-coded figure(s) in ${file}`).toEqual([])
  })

  it('the result never calculates: no number parsing or arithmetic helpers in the drawing code', () => {
    for (const file of ['components/pricing/SolarEstimateResult.tsx', 'components/pricing/HowWeCalculate.tsx', 'components/pricing/StatusBadge.tsx', 'lib/pricing/solar-estimate.ts']) {
      expect(code(file), file).not.toMatch(/parseFloat|parseInt|Number\(|Math\.|toFixed|\.reduce\(/)
    }
  })

  it('the frontend\'s own roof-area sizing is gone from the whole app', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(path.join(ROOT, dir))) {
        const rel = path.join(dir, name)
        if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel)
        else if (/\.(ts|tsx)$/.test(name)) files.push(rel)
      }
    }
    ;['app', 'components', 'lib'].forEach(walk)
    for (const f of files) expect(read(f), f).not.toMatch(/PLACEHOLDER_ROOF_AREA_SQFT_PER_KW|roofAreaToSizeKw/)
  })
})

// ── Contract drift (tests/contract/openapi.json) ──────────────────────────

describe('requests match the BE-14 contract', () => {
  it('the calculator\'s instant-estimate body validates against InstantEstimateRequest', async () => {
    window.scrollTo = vi.fn()
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes('instant-estimate')) return new Response(JSON.stringify(EXAMPLE_A), { status: 200 })
      return new Response(JSON.stringify(CATALOGUE), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await fillLocation(user, { discom: 'WBSEDCL' })
    await fillProperty(user, { houses: '40' })
    await fillUsage(user, { units: '360', bill: '2600', phase: 'Three Phase', sanctioned: '5', improveRoof: '2000', shading: 'No shading', roofType: 'RCC / Concrete Flat Roof' })
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('instant-estimate'))).toBe(true))
    const body = JSON.parse((fetchMock.mock.calls.find(([u]) => String(u).includes('instant-estimate'))![1] as RequestInit).body as string)

    const spec = loadOpenApi()
    const schema = requestSchema(spec, '/api/v1/pricing/instant-estimate', 'post')!
    expect(validate(spec, schema, body)).toEqual([])
    // Every field sent is one the contract names (no invented inputs).
    const props = Object.keys((spec.components.schemas.InstantEstimateRequest as { properties: object }).properties)
    expect(Object.keys(body).filter((k) => !props.includes(k))).toEqual([])
    for (const k of ['discom', 'sanctioned_load_kw', 'number_of_houses', 'monthly_units_kwh', 'monthly_bill_inr']) expect(body).toHaveProperty(k)
  })

  it('GET /api/v1/pricing/estimate-assumptions exists in the contract', () => {
    expect(loadOpenApi().paths['/api/v1/pricing/estimate-assumptions']?.get).toBeTruthy()
  })

  it('the lead mirror sends only estimate-request fields, within their bounds', () => {
    const lead = configuratorLeadSchema.parse({
      customerType: 'society', name: 'Asha Roy', phone: '9876543210', email: 'asha@example.com', state: 'West Bengal', city: 'Kolkata', pinCode: '700001',
      discom: 'WBSEDCL', numberOfHouses: '40', sizingMethod: 'units', monthlyUnits: '360', averageMonthlyBill: '2600', sanctionedLoadKw: '5',
      connectionPhase: 'Three Phase', indicativeTotalInr: 123465, estimate: { estimateVersion: EXAMPLE_A.estimate_version, sizeKw: '3' },
    })
    const payload = JSON.parse(JSON.stringify(configuratorMirrorPayload(lead)))
    const spec = loadOpenApi()
    const schema = requestSchema(spec, '/api/v1/public/estimate-request', 'post')!
    expect(validate(spec, schema, payload)).toEqual([])
  })
})

// ── First-load JavaScript ─────────────────────────────────────────────────

describe('the result is not part of the calculator\'s first load', () => {
  it('SolarCalculator loads CalculatorReveal lazily and imports no result component itself', () => {
    const src = code('app/(site)/[lang]/solar-calculator/SolarCalculator.tsx')
    expect(src).toMatch(/lazy\(\(\) => import\("\.\/CalculatorReveal"\)\)/)
    expect(src).not.toMatch(/from ["']\.\/CalculatorReveal["']/)
    expect(src).not.toMatch(/SolarEstimateResult|PackageCards|HowWeCalculate/)
  })

  // Measured the FE-11 way (sum of gzip -9 of every script the prerendered page
  // references). Baseline before FE-14: 225,226 B; budget +5 KB. Runs only when
  // a production build is present (`npm run build`), otherwise skipped.
  const html = path.join(ROOT, '.next/server/app/en/solar-calculator.html')
  it.skipIf(!existsSync(html))('first-load JS of /en/solar-calculator stays within baseline + 5 KB gzip', () => {
    const page = readFileSync(html, 'utf8')
    const srcs = [...new Set([...page.matchAll(/\/_next\/static\/[^"]+?\.js/g)].map((m) => m[0]))]
    const bytes = srcs.reduce((sum, src) => sum + gzipSync(readFileSync(path.join(ROOT, '.next/static', src.replace('/_next/static/', ''))), { level: 9 }).length, 0)
    expect(bytes).toBeLessThanOrEqual(225_226 + 5 * 1024)
  })
})

// ── Copy ──────────────────────────────────────────────────────────────────

describe('copy', () => {
  const locales = { en, hi, bn } as const

  it.each(Object.keys(locales) as (keyof typeof locales)[])('%s has every calculator and estimate key, none empty', (loc) => {
    const m = locales[loc]
    const walk = (a: unknown, b: unknown, at: string) => {
      if (typeof a === 'string') return expect(typeof b === 'string' && b.trim().length > 0, `${loc}: ${at}`).toBe(true)
      if (Array.isArray(a)) return expect(Array.isArray(b) && b.length === a.length, `${loc}: ${at}`).toBe(true)
      for (const k of Object.keys(a as object)) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)?.[k], `${at}.${k}`)
    }
    walk(en.calculator.property, m.calculator.property, 'calculator.property')
    walk(en.calculator.usage, m.calculator.usage, 'calculator.usage')
    walk(en.calculator.result, m.calculator.result, 'calculator.result')
    walk(en.pricing.estimate, m.pricing.estimate, 'pricing.estimate')
    walk(en.pricing.subsidy.conditions, m.pricing.subsidy.conditions, 'pricing.subsidy.conditions')
  })

  it('hi and bn are translated (not English copies) and stay flagged for native review', () => {
    expect(hi._review_status).toBe('machine-draft')
    expect(bn._review_status).toBe('machine-draft')
    for (const m of [hi, bn]) {
      expect(m.pricing.estimate.badge.announced).not.toBe(en.pricing.estimate.badge.announced)
      expect(m.calculator.usage.accuracy).not.toBe(en.calculator.usage.accuracy)
    }
  })

  it('never promises free electricity or a guaranteed state subsidy, and explains CFA and DCR', () => {
    const text = JSON.stringify([en.calculator, en.pricing.estimate, en.pricing.subsidy])
    expect(text).not.toMatch(/free electricity|guaranteed|guarantee/i)
    expect(text).not.toMatch(/\bCFA\b/)
    expect(en.pricing.estimate.subsidy.central).toMatch(/central government subsidy/i)
    expect(en.pricing.subsidy.conditions.dcr_modules_required).toMatch(/made-in-india panels \(DCR\)/i)
  })
})
