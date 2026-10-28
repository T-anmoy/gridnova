// FE-19 item 7: the Proposal Studio gaps BE-19 closed (proposal_studio.md §§5, 6, 10): the
// customer link from the View, the PDF from JSON pdf-link, reset to defaults, payment-term
// presets, an editable email, makes per BOQ row kind, owner names, capacity, customer filter.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StudioWizard } from '@/components/dashboard/studio/StudioWizard'
import { ProposalOverview } from '@/components/dashboard/studio/ProposalOverview'
import ProposalsList, { capacityOf } from '@/components/dashboard/studio/ProposalsList'
import { makeChoicesForKind, NO_MAKE } from '@/components/dashboard/studio/MaterialsEditor'
import { ownerText } from '@/lib/studio/logic'
import { useStudioProposal } from '@/lib/studio/api'
import type { StudioOptions, StudioView } from '@/lib/studio/types'
import { asRoles } from './helpers/permissions-bridge'
import { navState } from './helpers/mock-navigation'
import { OPTIONS, issuedView, makeView, studioBackend } from './fixtures/studio'

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: () => Promise.resolve('token') }), useUser: () => ({ user: { id: 'user_test', publicMetadata: {} } }) }))
vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)

const P = '/dashboard/studio/proposals/7'
const BE19_OPTIONS: StudioOptions = {
  ...OPTIONS,
  payment_term_presets: [
    { id: 'up_to_10_kw', label: 'Up to 10 kW — price list (20 / 60 / 20)', terms: [{ percent: '20', label: 'On Order' }, { percent: '60', label: 'Against Material Bill' }, { percent: '20', label: 'Before Commissioning' }] },
    { id: 'above_10_kw', label: 'Above 10 kW (25 / 60 / 15)', terms: [{ percent: '25', label: 'Advance along with the order' }, { percent: '60', label: 'Against material' }, { percent: '15', label: 'On commissioning' }] },
  ],
  resettable_sections: ['boq', 'customer_scope', 'payment_terms', 'system'],
  boq_makes: { module: ['Adani', 'Equivalent', 'HR Solar'], inverter: ['Deye', 'Sungrow'], cable: ['Finolex', 'Havells'], other: ['Adani', 'Deye', 'Finolex', 'Havells', 'HR Solar', 'Sungrow', 'Equivalent'] },
  email_message_max: 1500,
}

function Harness({ options }: { options: StudioOptions }) {
  const q = useStudioProposal(7)
  return q.data ? <StudioWizard view={q.data} options={options} /> : <p>loading</p>
}

const saved = (view: StudioView) => ({ body: { ...view, changes: [], regenerated_sections: [], approval_cleared: false } })

async function openWizard(view: StudioView, step: string, extra: Parameters<typeof studioBackend>[0] = {}) {
  navState.reset(P, `step=${step}`)
  const backend = studioBackend({
    [`GET ${P}`]: { body: view },
    'GET /equipment/?is_active=true': { body: { items: [{ brand: 'Sungrow', is_active: true }] } },
    'GET /dashboard/studio/library': { body: { items: [] } },
    [`GET ${P}/preview.pdf`]: { raw: '%PDF-1.7', type: 'application/pdf' },
    ...extra,
  })
  const user = userEvent.setup()
  render(asRoles(['proposal_desk'], <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Harness options={BE19_OPTIONS} /></QueryClientProvider>))
  await screen.findByTestId('wizard-steps')
  return { backend, user }
}

beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})

describe('reset to defaults and payment-term presets', () => {
  it('a section staff changed offers "Reset to defaults"; confirming posts the reset with the revision read', async () => {
    const view = makeView({ revision: 4, document: { edited: ['payment_terms'] } })
    const after = makeView({ revision: 5, document: { edited: [] } })
    const { backend, user } = await openWizard(view, 'terms', { [`POST ${P}/sections/payment_terms/reset`]: saved(after) })
    await user.click(await screen.findByTestId('reset-payment_terms'))
    expect(screen.getByTestId('reset-confirm-payment_terms')).toHaveTextContent('Put the payment terms back to Grid Nova’s standard?')
    await user.click(within(screen.getByTestId('reset-confirm-payment_terms')).getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(backend.called('POST', `${P}/sections/payment_terms/reset`)[0]?.body).toEqual({ base_revision: 4 }))
    await waitFor(() => expect(screen.getByTestId('follows-payment_terms')).toHaveTextContent('Filled in for you'))
  })

  it('a section that still follows the plant has nothing to reset', async () => {
    await openWizard(makeView({ document: { edited: [] } }), 'terms')
    expect(await screen.findByTestId('follows-payment_terms')).toBeInTheDocument()
    expect(screen.queryByTestId('reset-payment_terms')).toBeNull()
  })

  it('choosing a preset saves its terms with the ordinary edit', async () => {
    const view = makeView({ revision: 2 })
    const { backend, user } = await openWizard(view, 'terms', { [`PATCH ${P}/document`]: saved(makeView({ revision: 3 })) })
    await user.selectOptions(await screen.findByTestId('payment-presets'), 'above_10_kw')
    await waitFor(() => expect(backend.called('PATCH', `${P}/document`).length).toBeGreaterThan(0))
    const body = backend.called('PATCH', `${P}/document`)[0].body as { section: string; value: { percent: string }[] }
    expect(body.section).toBe('payment_terms')
    expect(body.value.map((t) => t.percent)).toEqual(['25', '60', '15'])
  })

  it('customer scope and BOQ get the same control', async () => {
    await openWizard(makeView({ document: { edited: ['customer_scope'] } }), 'terms')
    expect(await screen.findByTestId('reset-customer_scope')).toBeInTheDocument()
  })
})

describe('the make picker offers every allowed make for the row’s kind', () => {
  const makes = BE19_OPTIONS.boq_makes!

  it('a module row: the module makes, Equivalent where allowed, and "–"', () => {
    expect(makeChoicesForKind(makes, 'module', ['Adani'])).toEqual(['Adani', 'HR Solar', 'Equivalent', NO_MAKE])
  })

  it('an inverter row has no Equivalent unless the list has one', () => {
    expect(makeChoicesForKind(makes, 'inverter', ['Deye'])).toEqual(['Deye', 'Sungrow', NO_MAKE])
  })

  it('a row without a kind gets every make the BOQ accepts; a row’s own make is never dropped', () => {
    const c = makeChoicesForKind(makes, null, ['Polycab'])
    expect(c).toContain('Polycab')
    expect(c).toContain('Sungrow')
    expect(c).toContain('Finolex')
  })
})

describe('the proposal page', () => {
  const issued = (extra: Partial<StudioView> = {}) => ({ ...issuedView(), public_url: 'https://www.gridnova.in/proposal/tok', ...extra })
  const routes = {
    [`GET ${P}/events`]: { body: { items: [] } },
    'GET /dashboard/studio/customers/3': { body: { customer: { id: 3, customer_type: 'individual', title: 'Mr.', name: 'Test Kumar Das', attention: null, mobile: '9830000001', email: 'test@example.com', address_lines: [], gstin: null }, duplicates: [] } },
    [`GET ${P}/preview.pdf`]: { raw: '%PDF', type: 'application/pdf' },
    'GET /dashboard/studio/options': { body: BE19_OPTIONS },
  }
  const renderPage = (view: StudioView) => {
    const user = userEvent.setup()
    render(asRoles(['proposal_desk'], <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ProposalOverview view={view} justIssued={false} /></QueryClientProvider>))
    return { user }
  }

  it('Download PDF asks for the JSON pdf-link and opens the signed link', async () => {
    const backend = studioBackend({ ...routes, [`GET ${P}/pdf-link`]: { body: { url: 'https://files.example/SP-7.pdf?sig=1', expires_at: '2026-10-28T10:00:00Z', filename: 'SP-7.pdf' } } })
    const tab = { location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    const { user } = renderPage(issued())
    await user.click(screen.getByTestId('action-download'))
    await waitFor(() => expect(tab.location.href).toBe('https://files.example/SP-7.pdf?sig=1'))
    expect(backend.called('GET', `${P}/pdf`)).toHaveLength(0)
  })

  it('Copy customer link uses public_url and never the WhatsApp route; an unreadable link says so', async () => {
    const backend = studioBackend(routes)
    const { user } = renderPage(issued({ public_url: null }))
    await user.click(screen.getByTestId('action-copy-link'))
    expect(await screen.findByTestId('overview-error')).toHaveTextContent('can’t be read for this version')
    expect(backend.called('POST', `${P}/whatsapp-link`)).toHaveLength(0)
  })

  it('the email dialog sends your own subject and message, previewed above the standard lines', async () => {
    const backend = studioBackend({ ...routes, [`POST ${P}/email`]: { body: { sent: true, to: 'test@example.com' } } })
    const { user } = renderPage(issued())
    await waitFor(() => expect(backend.called('GET', '/dashboard/studio/customers/3')).toHaveLength(1))
    await user.click(screen.getByTestId('action-email'))
    const subject = await screen.findByLabelText(/Subject/)
    await user.clear(subject)
    await user.type(subject, 'Your 3 kWp proposal')
    await user.type(screen.getByLabelText(/Your message/), 'As discussed on the call.{enter}The site visit is on Monday.')
    expect(screen.getAllByTestId('email-own-line').map((l) => l.textContent)).toEqual(['As discussed on the call.', 'The site visit is on Monday.'])
    await user.click(screen.getByTestId('email-send'))
    await waitFor(() =>
      expect(backend.called('POST', `${P}/email`)[0]?.body).toEqual({ to: null, subject: 'Your 3 kWp proposal', message: 'As discussed on the call.\nThe site visit is on Monday.' }),
    )
  })

  it('names the owner', () => {
    studioBackend(routes)
    renderPage(issued({ proposal: { ...issuedView().proposal, owner_id: 'user_x', owner_name: 'Desk Person' } }))
    expect(screen.getByTestId('proposal-owner')).toHaveTextContent('Owner: Desk Person')
  })
})

describe('lists: owner names, capacity, customer filter', () => {
  it('owner_name and capacity_kwp from the row; "You" for oneself', () => {
    const row = makeView({ proposal: { owner_id: 'user_x', owner_name: 'Desk Person', capacity_kwp: '52.50', title: 'Commercial rooftop' } }).proposal
    expect(ownerText(row.owner_id, 'user_test', row.owner_name)).toBe('Desk Person')
    expect(ownerText('user_test', 'user_test', 'Me')).toBe('You')
    expect(capacityOf(row)).toBe('52.5')
    expect(capacityOf({ ...row, capacity_kwp: null })).toBe('')
  })

  it('the list sends customer_id when a customer is chosen, and shows the chip', async () => {
    navState.reset('/dashboard/studio/proposals', 'customer=3')
    const backend = studioBackend({
      'GET /dashboard/studio/options': { body: BE19_OPTIONS },
      'GET /dashboard/studio/proposals': { body: { items: [makeView({ proposal: { owner_id: 'user_x', owner_name: 'Desk Person', capacity_kwp: '3' } }).proposal], total: 1, page: 1, page_size: 25 } },
      'GET /dashboard/studio/customers/3': { body: { customer: { id: 3, customer_type: 'individual', title: null, name: 'Test Kumar Das', attention: null, mobile: '9830000001', email: null, address_lines: [], gstin: null }, duplicates: [] } },
    })
    render(asRoles(['proposal_desk'], <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ProposalsList /></QueryClientProvider>))
    const table = await screen.findByTestId('list-table')
    await waitFor(() => expect(backend.calls.some((c) => c.path.includes('customer_id=3'))).toBe(true))
    expect(await screen.findByTestId('filter-customer')).toHaveTextContent('Test Kumar Das')
    expect(within(table).getByText('Desk Person')).toBeInTheDocument()
  })
})

describe('second pass through the samples (item 8)', () => {
  it('a customer-scope check points to Terms & notes, where the list is edited — not to Customer', async () => {
    const { stepOfField } = await import('@/lib/studio/logic')
    expect(stepOfField('customer_scope')).toBe('terms')
    expect(stepOfField('customer_scope[0]')).toBe('terms')
    expect(stepOfField('customer.mobile')).toBe('customer')
  })

  it('a type waiting for Grid Nova’s wording says "not ready to issue", names what is missing, and never asks staff to fix it', async () => {
    const blocked = makeView({
      errors: 1,
      content_blockers: [{ registry: 'PRO-7', message: "Grid Nova's text for utility proposals (sections_library.utility_scale_scope)" }],
      checks: [{ severity: 'error', code: 'content_not_ready', message: 'Waiting for Grid Nova’s text', field: null, fingerprint: 'f1' } as never],
    })
    await openWizard(blocked, 'review')
    const notice = await screen.findByTestId('not-ready-to-issue')
    expect(notice).toHaveTextContent('Not ready to issue yet')
    expect(notice).toHaveTextContent('utility_scale_scope')
    expect(notice).toHaveTextContent('PRO-7')
    expect(screen.queryByText('Fix the items in red first.')).toBeNull()
  })
})

describe('second pass: the housing society sample', () => {
  it('a housing society can opt into the PM Surya Ghar subsidy', async () => {
    const view = makeView({ document: { project: { project_type: 'housing_society', houses: 24, roof_area_sqft: null } } })
    view.proposal.project_type = 'housing_society'
    await openWizard(view, 'project')
    expect(await screen.findByText('PM Surya Ghar subsidy')).toBeInTheDocument()
    expect(screen.getByLabelText(/The customer wants the subsidy/)).toBeInTheDocument()
  })
})
