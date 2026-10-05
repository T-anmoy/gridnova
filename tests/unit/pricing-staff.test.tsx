import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { CATALOGUE } from './fixtures/pricing'
import { fractionToPercent, orderedPackageIds, parsePriceListEstimate } from '@/lib/pricing/price-list'
import PriceListView from '@/components/dashboard/PriceListView'
import ProposalPricing from '@/components/dashboard/ProposalPricing'
import { NAV_ITEMS, canSeeNavItem } from '@/lib/dashboard/nav'
import { en } from './helpers/i18n'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import { LIST_ESTIMATE } from './fixtures/pricing'

const role = vi.hoisted(() => ({ value: 'admin' as string | undefined, loaded: true }))
vi.mock('@/lib/dashboard/use-staff-role', () => ({ useStaffRole: () => ({ role: role.value, isLoaded: role.loaded }) }))

beforeEach(() => {
  role.value = 'admin'
  role.loaded = true
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(CATALOGUE), { status: 200 })))
})
afterEach(() => vi.unstubAllGlobals())

describe('price-list helpers', () => {
  it.each([
    ['0.089', '8.9'],
    ['0.7', '70'],
    ['0.3', '30'],
    ['0.05', '5'],
    ['0.18', '18'],
    ['1', '100'],
    ['0.12', '12'],
  ])('fractionToPercent(%s) = %s — a decimal shift on the string, no float', (input, out) => expect(fractionToPercent(input)).toBe(out))
  it('returns null for text that is not a plain decimal', () => expect(fractionToPercent('8.9%')).toBeNull())

  it('puts the two packages in a fixed order whatever order the API used, and unknown packages last', () => {
    expect(orderedPackageIds(['NOVA_SIGNATURE', 'NOVA_ASSURED'])).toEqual(['NOVA_ASSURED', 'NOVA_SIGNATURE'])
    expect(orderedPackageIds(['NEW_ONE', 'NOVA_SIGNATURE', 'NOVA_ASSURED'])).toEqual(['NOVA_ASSURED', 'NOVA_SIGNATURE', 'NEW_ONE'])
  })

  it('accepts a custom quote with no packages, and rejects a list price with non-string amounts', () => {
    expect(parsePriceListEstimate({ price_status: 'custom_quote', custom_quote_reasons: ['outside_west_bengal'], packages: {} })?.packages).toEqual({})
    expect(parsePriceListEstimate({ ...LIST_ESTIMATE, packages: { NOVA_ASSURED: { basic: 1, gst: 2, final: 3 } } })).toBeNull()
    expect(parsePriceListEstimate({ ...LIST_ESTIMATE, packages: {} })).toBeNull()
    expect(parsePriceListEstimate({ price_status: 'weird' })).toBeNull()
  })

  it('keeps amount strings exactly as sent', () => {
    expect(parsePriceListEstimate(LIST_ESTIMATE)?.packages.NOVA_ASSURED.final).toBe('449044.43')
  })
})

describe('hi / bn pricing messages', () => {
  const keys = (o: unknown, prefix = ''): string[] =>
    o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => keys(v, `${prefix}${k}.`)) : [prefix]
  it.each([['hi', hi], ['bn', bn]] as const)('%s has exactly the keys English has', (_n, file) => {
    expect(keys((file as unknown as { pricing: unknown }).pricing).sort()).toEqual(keys(en.pricing).sort())
  })
})

describe('staff price list page', () => {
  it('renders all 36 rows exactly as returned, plus rules, phase ranges, terms, makes and the version', () => {
    render(<PriceListView catalogue={CATALOGUE} />)
    expect(screen.getAllByTestId('price-row')).toHaveLength(36)
    const first = screen.getAllByTestId('price-row')[0]
    expect(first).toHaveTextContent('Nova Assured')
    expect(first).toHaveTextContent('SINGLE')
    expect(first).toHaveTextContent('₹1,00,000.00')
    expect(first).toHaveTextContent('₹18,900.00')
    expect(first).toHaveTextContent('₹1,08,900.00')
    expect(screen.getByTestId('price-list-version')).toHaveTextContent('TEST-2026-01')
    expect(screen.getByTestId('phase-ranges')).toHaveTextContent('SINGLE: 1–10 kW')
    expect(screen.getByTestId('phase-ranges')).toHaveTextContent('THREE: 3–10 kW')
    expect(screen.getAllByTestId('price-list-package')).toHaveLength(2)
    expect(screen.getByText(/Test Panel Co A/)).toBeInTheDocument()
    expect(screen.getByText(/West Bengal/)).toBeInTheDocument()
    // Payment labels come from the response, not from the page.
    expect(screen.getByTestId('schedule-terms')).toHaveTextContent('Label One From API — 20%')
    // Read-only.
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('shows no rows (and says why) when the backend hides the table', () => {
    render(<PriceListView catalogue={{ ...CATALOGUE, price_display: 'hidden', prices: undefined }} />)
    expect(screen.queryAllByTestId('price-row')).toHaveLength(0)
    expect(screen.getByTestId('prices-hidden')).toBeInTheDocument()
  })

  it('is in the nav for admin, management and sales only', () => {
    const item = NAV_ITEMS.find((i) => i.href === '/dashboard/price-list')!
    for (const r of ['admin', 'management', 'sales'] as const) expect(canSeeNavItem(item, r)).toBe(true)
    for (const r of ['accounts', 'engineer', 'operations'] as const) expect(canSeeNavItem(item, r)).toBe(false)
  })

  it.each(['admin', 'management', 'sales'])('the page loads the list for %s', async (r) => {
    role.value = r
    const { default: Page } = await import('@/app/(internal)/dashboard/price-list/page')
    render(<Page />)
    await waitFor(() => expect(screen.getAllByTestId('price-row')).toHaveLength(36))
  })

  it.each(['accounts', 'engineer', 'operations'])('%s gets the no-access state and no request', async (r) => {
    role.value = r
    const { default: Page } = await import('@/app/(internal)/dashboard/price-list/page')
    render(<Page />)
    expect(screen.getByTestId('no-access')).toBeInTheDocument()
    expect(screen.queryByTestId('price-list')).not.toBeInTheDocument()
  })
})

describe('staff proposal pricing', () => {
  const snapshot = {
    price_status: 'list_price' as const,
    package: 'NOVA_SIGNATURE',
    package_name: 'Nova Signature',
    phase: 'SINGLE',
    kw: 4,
    basic: '461826.15',
    gst: '41102.32',
    final: '502928.47',
    price_list_version: 'TEST-2026-01',
    source_sha256: 'abcdef0123456789abcdef',
    destination: 'West Bengal',
  }

  it('shows the list price from the snapshot with the version', () => {
    render(<ProposalPricing content={{ pricing: snapshot, price_list: { version: 'TEST-2026-01', source_sha256: 'abcdef0123456789abcdef' } }} totalValue={502928.47} />)
    expect(screen.getByTestId('list-basic')).toHaveTextContent('₹4,61,826.15')
    expect(screen.getByTestId('list-gst')).toHaveTextContent('₹41,102.32')
    expect(screen.getByTestId('list-final')).toHaveTextContent('₹5,02,928.47')
    expect(screen.getByTestId('proposal-price-version')).toHaveTextContent('TEST-2026-01')
    expect(screen.queryByTestId('proposal-adjusted')).not.toBeInTheDocument()
  })

  it('after an adjustment shows the list price, the adjusted price and the variance (negative included)', () => {
    render(
      <ProposalPricing
        content={{ pricing: { ...snapshot, adjusted: true, list_price_final: '502928.47', variance: '-2928.47' } }}
        totalValue={500000}
      />
    )
    expect(screen.getByTestId('list-final')).toHaveTextContent('₹5,02,928.47')
    expect(within(screen.getByTestId('proposal-adjusted')).getByTestId('adjusted-price')).toHaveTextContent('5,00,000')
    expect(screen.getByTestId('variance')).toHaveTextContent('-₹2,928.47')
  })

  it('a custom quote lists staff-worded reasons and no amounts', () => {
    render(<ProposalPricing content={{ pricing: { price_status: 'custom_quote', custom_quote_reasons: ['package_not_chosen', 'non_integer_size'] } }} totalValue={null} />)
    const box = screen.getByTestId('proposal-custom-quote')
    expect(box).toHaveTextContent('No package has been chosen.')
    expect(box).toHaveTextContent('not a whole kW')
    expect(document.body.textContent).not.toMatch(/₹/)
  })

  it('renders nothing for a proposal without a pricing snapshot', () => {
    const { container } = render(<ProposalPricing content={{}} totalValue={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('payment schedule labels', () => {
  it('are never hard-coded in the app — they are rendered from the API response', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (['node_modules', '.next', 'tests', 'messages', '.git'].includes(name)) continue
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(tsx?|jsx?)$/.test(name) && /On Order|Against Material Bill|Before Commissioning/.test(readFileSync(full, 'utf8'))) hits.push(full)
      }
    }
    for (const d of ['app', 'components', 'lib']) walk(join(process.cwd(), d))
    expect(hits).toEqual([])
  })
})
