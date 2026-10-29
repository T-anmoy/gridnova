// FE-18: the guided edit. Every field autosaves its section with PATCH …/document (base
// revision, section, value); stale_version reloads and says so; defaults that followed the
// plant are announced; makes are picked from the catalogue; the price modes, the discount
// reason and the toggles; the proof-check (links, "I have checked this", ignore a word); and
// the one next action the API allows. Nothing here calculates money.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StudioWizard } from '@/components/dashboard/studio/StudioWizard'
import { useStudioProposal } from '@/lib/studio/api'
import type { StudioOptions, StudioView } from '@/lib/studio/types'
import { navState, push } from './helpers/mock-navigation'
import { OPTIONS, makeView, refused, studioBackend } from './fixtures/studio'

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: () => Promise.resolve('token') }), useUser: () => ({ user: null }) }))
vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)

const P = '/dashboard/studio/proposals/7'

function Harness({ options }: { options: StudioOptions }) {
  const q = useStudioProposal(7)
  return q.data ? <StudioWizard view={q.data} options={options} /> : <p>loading</p>
}

function setInline(matches: boolean) {
  window.matchMedia = ((query: string) => ({ matches, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia
}

async function open(view: StudioView, step = 'customer', options: StudioOptions = OPTIONS, extra: Parameters<typeof studioBackend>[0] = {}) {
  navState.reset(P, `step=${step}`)
  const backend = studioBackend({
    [`GET ${P}`]: { body: view },
    'GET /equipment/?is_active=true': { body: { items: [{ brand: 'Sungrow', is_active: true }, { brand: 'Havells', is_active: true }, { brand: 'Dummy Co', is_active: true, is_placeholder: true }] } },
    'GET /dashboard/studio/library': { body: { items: [] } },
    [`GET ${P}/preview.pdf`]: { raw: '%PDF-1.7 <</Type /Page>> <</Type /Page>>', type: 'application/pdf' },
    ...extra,
  })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={qc}>
      <Harness options={options} />
    </QueryClientProvider>,
  )
  await screen.findByTestId('wizard-steps')
  return { backend, user }
}

const saved = (view: StudioView, extra: Record<string, unknown> = {}) => ({ body: { ...view, changes: [], regenerated_sections: [], approval_cleared: false, ...extra } })

beforeEach(() => {
  setInline(false)
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  // jsdom has no scrollIntoView; focusStudioField calls it after a step change.
  Element.prototype.scrollIntoView = vi.fn()
})

describe('autosave', () => {
  it('saves the whole section a moment after typing, with the revision it was read at', async () => {
    const view = makeView()
    const { backend, user } = await open(view, 'customer', OPTIONS, { [`PATCH ${P}/document`]: ({ body }) => saved(makeView({ revision: 6, document: { ...view.document, revision: 6, addressee: (body as { value: StudioView['document']['addressee'] }).value } })) })
    const name = screen.getByLabelText(/Full name/)
    await user.clear(name)
    await user.type(name, 'Ramesh Das')
    await waitFor(() => expect(screen.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved'), { timeout: 3000 })
    const patches = backend.called('PATCH', `${P}/document`)
    expect(patches.length).toBeGreaterThanOrEqual(1)
    const last = patches.at(-1)!.body as { base_revision: number; section: string; value: Record<string, unknown> }
    expect(last.section).toBe('addressee')
    expect(last.value).toMatchObject({ name: 'Ramesh Das', mobile: '9830000001', title: 'Mr.' })
    expect(patches[0].body).toMatchObject({ base_revision: 5 })
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('stale_version: loads the latest version and says so', async () => {
    const view = makeView()
    const { backend, user } = await open(view, 'customer', OPTIONS, { [`PATCH ${P}/document`]: refused(409, 'stale_version', { current_revision: 9 }) })
    const gets = () => backend.called('GET', P).length
    const before = gets()
    await user.type(screen.getByLabelText(/Full name/), 'X')
    await waitFor(() => expect(screen.getByTestId('save-indicator')).toHaveAttribute('data-state', 'reloaded'), { timeout: 3000 })
    await waitFor(() => expect(gets()).toBeGreaterThan(before))
    expect(screen.getByText('Reloaded the latest version')).toBeInTheDocument()
  })

  it('a refused value shows under its field and is not lost', async () => {
    const { user } = await open(makeView(), 'customer', OPTIONS, { [`PATCH ${P}/document`]: { status: 422, body: { detail: { code: 'invalid_value', message: 'The mobile number must be 10 digits.', field: 'addressee.mobile' } } } })
    const mobile = screen.getByLabelText(/Mobile number/)
    await user.clear(mobile)
    await user.type(mobile, '98300')
    await waitFor(() => expect(screen.getByText('The mobile number must be 10 digits.')).toBeInTheDocument(), { timeout: 3000 })
    expect(mobile).toHaveValue('98300')
    expect(mobile).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId('save-indicator')).toHaveAttribute('data-state', 'error')
  })

  it('announces defaulted sections that followed the plant (regenerated until edited)', async () => {
    const view = makeView()
    const { user } = await open(view, 'project', OPTIONS, { [`PATCH ${P}/document`]: saved(makeView({ revision: 6, document: { ...view.document, plant: { ...view.document.plant, capacity_kwp: '12' } } }), { regenerated_sections: ['payment_terms', 'boq'] }) })
    const cap = screen.getByLabelText(/Plant size/)
    await user.clear(cap)
    await user.type(cap, '12')
    expect(await screen.findByTestId('regenerated', {}, { timeout: 3000 })).toHaveTextContent('the payment terms, the bill of quantities')
  })

  it('materials say they follow the plant until edited…', async () => {
    await open(makeView(), 'system')
    expect(screen.getByTestId('follows-boq')).toHaveTextContent('update when the plant changes')
  })

  it('…and stay as set once edited', async () => {
    await open(makeView({ document: { ...makeView().document, edited: ['boq'] } }), 'system')
    expect(screen.getByTestId('follows-boq')).toHaveTextContent('You changed these')
  })
})

describe('project step', () => {
  it('PM Surya Ghar only for a residential rooftop; the number of houses only for a housing society', async () => {
    await open(makeView(), 'project')
    expect(screen.getByText('PM Surya Ghar subsidy')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Number of houses/)).not.toBeInTheDocument()
  })
  it('subsidy wanted without DCR panels: says why it will not print, and fixes it in one click', async () => {
    const base = makeView().document
    const view = makeView({ document: { ...base, plant: { ...base.plant, dcr: false }, pm_surya_ghar: { ...base.pm_surya_ghar, subsidy_opted: true } } })
    const { backend, user } = await open(view, 'project', OPTIONS, { [`PATCH ${P}/document`]: saved(view) })
    const note = screen.getByTestId('subsidy-needs-dcr')
    await user.click(within(note).getByRole('button', { name: 'Use DCR panels' }))
    await waitFor(() => expect(backend.called('PATCH', `${P}/document`)[0]?.body).toMatchObject({ section: 'plant', value: { dcr: true } }), { timeout: 3000 })
  })

  // FE-19 second pass: a society gets the PM Surya Ghar society subsidy (BE-18 sample 60 kWp × 24 houses).
  it('housing society asks for houses and offers the PM Surya Ghar subsidy', async () => {
    const v = makeView({ document: { ...makeView().document, project: { project_type: 'housing_society', houses: null, roof_area_sqft: null } } })
    await open(v, 'project')
    expect(screen.getByLabelText(/Number of houses/)).toBeInTheDocument()
    expect(screen.getByText('PM Surya Ghar subsidy')).toBeInTheDocument()
  })
})

describe('system step — makes are picked from the catalogue', () => {
  it('offers catalogue brands, the rows’ own makes and Equivalent (no dummy rows, no free text)', async () => {
    const view = makeView()
    const { backend, user } = await open(view, 'system', OPTIONS, { [`PATCH ${P}/document`]: saved(view) })
    const pickers = await screen.findAllByTestId('make-picker')
    await waitFor(() => expect(within(pickers[1]).queryByRole('option', { name: 'Havells' })).toBeInTheDocument())
    const offered = within(pickers[1]).getAllByRole('option').map((o) => o.textContent)
    expect(offered).toEqual(['Add another make…', 'Havells', 'Waaree', 'Equivalent', '– (no make, e.g. installation)'])
    expect(offered).not.toContain('Dummy Co')
    expect(screen.queryByRole('textbox', { name: /make/i })).not.toBeInTheDocument()
    await user.selectOptions(pickers[1], 'Havells')
    await waitFor(() => expect(backend.called('PATCH', `${P}/document`).length).toBe(1), { timeout: 3000 })
    const body = backend.called('PATCH', `${P}/document`)[0].body as { section: string; value: { make: string }[] }
    expect(body.section).toBe('boq')
    expect(body.value[1].make).toBe('Sungrow / Havells')
  })
})

describe('price step', () => {
  it('shows the price master as the reference and sends a total when “I know the total” is chosen', async () => {
    const view = makeView()
    const { backend, user } = await open(view, 'price', OPTIONS, { [`PATCH ${P}/document`]: saved(view) })
    expect(screen.getByTestId('price-master-reference')).toHaveTextContent('₹1,85,000')
    await user.click(screen.getByTestId('price-way-total'))
    await user.type(screen.getByLabelText(/Total the customer pays/), '200000')
    await waitFor(() => expect(backend.called('PATCH', `${P}/document`).length).toBeGreaterThan(0), { timeout: 3000 })
    expect(backend.called('PATCH', `${P}/document`).at(-1)!.body).toMatchObject({ section: 'price', value: { mode: 'staff_total', total: '200000' } })
  })

  it('below the price master: the server’s reason_required shows at the reason field', async () => {
    const view = makeView()
    const { user } = await open(view, 'price', OPTIONS, {
      [`PATCH ${P}/document`]: { status: 422, body: { detail: { code: 'reason_required', message: 'The price is 8.11% below the price master: give the reason.', field: 'price.reason', below_price_master: { list_basic: '185000', basic: '170000', percent: '8.11' } } } },
    })
    await user.click(screen.getByTestId('price-way-basic'))
    await user.type(screen.getByLabelText(/Basic price before GST/), '170000')
    expect(await screen.findByText(/8.11% below the price master: give the reason/, {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByLabelText(/Why is the price lower/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('a discount is not saved until it has a reason', async () => {
    const view = makeView()
    const { backend, user } = await open(view, 'price', OPTIONS, { [`PATCH ${P}/document`]: saved(view) })
    await user.click(screen.getByLabelText(/Give a discount/))
    await user.type(screen.getByLabelText('Discount (₹)'), '5000')
    expect(screen.getByText(/the discount is saved once it has one/)).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 900))
    const sent = backend.called('PATCH', `${P}/document`).map((c) => c.body as { value: { discount?: unknown } })
    expect(sent.some((b) => b.value?.discount)).toBe(false)
    await user.type(screen.getByLabelText(/Reason for the discount/), 'Festival offer')
    await waitFor(() => expect(backend.called('PATCH', `${P}/document`).some((c) => (c.body as { value: { discount?: unknown } }).value?.discount)).toBe(true), { timeout: 3000 })
  })

  it('toggles save at once; the savings inputs appear with the savings page', async () => {
    const view = makeView()
    const { backend, user } = await open(view, 'price', OPTIONS, { [`PATCH ${P}/document`]: saved(view) })
    expect(screen.getByLabelText(/Compare the packages/)).toBeInTheDocument()
    await user.click(screen.getByLabelText(/Add a savings page/))
    await waitFor(() => expect(backend.called('PATCH', `${P}/document`)[0]?.body).toMatchObject({ section: 'display', value: { show_savings: true } }), { timeout: 3000 })
    expect(screen.getByLabelText(/Tariff per unit/)).toBeInTheDocument()
  })

  it('without studio.price the step is read-only', async () => {
    await open(makeView({ can: { price: false } }), 'price')
    expect(screen.getByText(/Only people who can set prices/)).toBeInTheDocument()
    expect(screen.getByTestId('price-way-total')).toBeDisabled()
  })

  it('shows the figures exactly as the API sent them', async () => {
    await open(makeView(), 'price')
    const f = screen.getByTestId('figures-summary')
    expect(within(f).getByTestId('fig-total')).toHaveTextContent('₹2,01,465.00')
    expect(within(f).getByTestId('fig-words')).toHaveTextContent('Rupees Two Lakh One Thousand Four Hundred Sixty-Five Only')
    expect(within(f).getByTestId('fig-payments')).toHaveTextContent('₹1,20,879.00')
  })
})

describe('review — proof-check and the next action', () => {
  const checks: StudioView['checks'] = [
    { id: 'missing_required', level: 'error', field: 'site.town', message: 'Missing: the town named in the letter.', fingerprint: 'e1' },
    { id: 'capacity_above_sanctioned', level: 'warning', field: 'plant.capacity_kwp', message: '3 kWp is above the sanctioned load of 2 kW.', fingerprint: 'w1' },
    { id: 'spelling', level: 'warning', field: 'notes_free', message: "'recieve' may be misspelt.", fingerprint: 'w2', word: 'recieve' },
  ]

  it('errors in red link to their field; issue stays off until all is clear', async () => {
    const { user } = await open(makeView({ checks, errors: 1, warnings_unacknowledged: ['w1', 'w2'], can: { issue: false, submit: false } }), 'review')
    const errors = screen.getByTestId('proof-errors')
    expect(errors).toHaveTextContent('Missing: the town')
    expect(screen.getByTestId('issue-proposal')).toBeDisabled()
    expect(screen.getByTestId('blocked-why')).toHaveTextContent('Fix the items in red first.')
    await user.click(within(errors).getByRole('button', { name: /Fix it in “Site & connection”/ }))
    await waitFor(() => expect(navState.params.get('step')).toBe('site'))
  })

  it('“I have checked this” and “ignore this word” call the API', async () => {
    const view = makeView({ checks: checks.slice(1), warnings_unacknowledged: ['w1', 'w2'] })
    const { backend, user } = await open(view, 'review', OPTIONS, {
      [`POST ${P}/acknowledge-warnings`]: { body: { ...view, warnings_unacknowledged: ['w2'] } },
      [`POST ${P}/spelling/ignore`]: { body: { ...view, checks: checks.slice(1, 2), warnings_unacknowledged: [] } },
    })
    await user.click(screen.getByTestId('ack-capacity_above_sanctioned'))
    await waitFor(() => expect(backend.called('POST', `${P}/acknowledge-warnings`)[0]?.body).toEqual({ fingerprints: ['w1'] }))
    await user.click(await screen.findByTestId('ignore-recieve'))
    await waitFor(() => expect(backend.called('POST', `${P}/spelling/ignore`)[0]?.body).toEqual({ word: 'recieve' }))
    expect(await screen.findByTestId('proof-all-clear')).toBeInTheDocument()
  })

  it('all clear and no approval needed: “Issue proposal” issues and opens the proposal page', async () => {
    const view = makeView()
    const { backend, user } = await open(view, 'review', OPTIONS, { [`POST ${P}/issue`]: { body: { ...view, public_url: 'https://www.gridnova.in/proposal/tok' } } })
    expect(screen.queryByTestId('send-for-approval')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('issue-proposal'))
    await waitFor(() => expect(backend.called('POST', `${P}/issue`)).toHaveLength(1))
    await waitFor(() => expect(push).toHaveBeenCalledWith(`${P}?view=overview&issued=1`))
  })

  it('approval needed: “Send for approval” submits, never issues', async () => {
    const view = makeView({ approval_required: true, approval_reasons: ['price_below_price_master'], can: { issue: false } })
    const { backend, user } = await open(view, 'review', OPTIONS, { [`POST ${P}/submit`]: { body: { ...view, result: 'pending_approval', version: { ...view.version, status: 'pending_approval' } } } })
    expect(screen.queryByTestId('issue-proposal')).not.toBeInTheDocument()
    expect(screen.getByTestId('next-action')).toHaveTextContent('the price is below the price master')
    await user.click(screen.getByTestId('send-for-approval'))
    await waitFor(() => expect(backend.called('POST', `${P}/submit`)).toHaveLength(1))
    expect(backend.called('POST', `${P}/issue`)).toHaveLength(0)
  })

  it('awaiting approval: the preparer is told who decides', async () => {
    await open(makeView({ version: { status: 'pending_approval' }, approval_required: true }), 'review')
    expect(screen.getByTestId('waiting-approval')).toHaveTextContent('Waiting for approval by an Admin or Management.')
  })

  it('a refused issue explains itself', async () => {
    const { user } = await open(makeView(), 'review', OPTIONS, { [`POST ${P}/issue`]: refused(409, 'approval_required') })
    await user.click(screen.getByTestId('issue-proposal'))
    expect(await screen.findByTestId('action-error')).toHaveTextContent('needs approval before it can be issued')
  })

  it('shows the live preview beside the proof-check, with page buttons', async () => {
    setInline(true)
    await open(makeView(), 'review')
    expect(await screen.findByTestId('preview-pages', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Page \d$/ })).toHaveLength(2)
  })
})

describe('the optional assistant', () => {
  it('is not shown while the API reports it off', async () => {
    await open(makeView(), 'customer')
    expect(screen.queryByTestId('assistant-box')).not.toBeInTheDocument()
  })

  it('when on: suggests, saves nothing, and only an accepted suggestion is saved', async () => {
    const view = makeView()
    const { backend, user } = await open(view, 'customer', { ...OPTIONS, assistant_enabled: true }, {
      [`POST ${P}/suggest-from-notes`]: { body: { suggestions: [{ section: 'addressee', field: 'name', value: 'Ramesh Das', status: 'check' }, { section: 'site', field: 'town', value: 'Habra', status: 'check' }], dropped: [], model: 'x', available: true } },
      [`PATCH ${P}/document`]: saved(view),
    })
    await user.click(screen.getByRole('button', { name: /Fill from a message/ }))
    await user.type(screen.getByLabelText(/Paste the customer’s message/), 'Ramesh Das, Habra')
    await user.click(screen.getByRole('button', { name: 'Suggest' }))
    const list = await screen.findByTestId('assistant-suggestions')
    expect(within(list).getAllByRole('listitem')).toHaveLength(1) // only this step's section
    await new Promise((r) => setTimeout(r, 900))
    expect(backend.called('PATCH', `${P}/document`)).toHaveLength(0)
    await user.click(within(list).getByRole('button', { name: /Accept/ }))
    await waitFor(() => expect(backend.called('PATCH', `${P}/document`)[0]?.body).toMatchObject({ section: 'addressee', value: { name: 'Ramesh Das' } }), { timeout: 3000 })
  })
})

describe('read-only', () => {
  it('without studio.edit nothing can be typed', async () => {
    await open(makeView({ can: { edit: false, price: false } }), 'customer')
    expect(screen.getByText(/look at this proposal but not change it/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Full name/)).toBeDisabled()
  })
})
