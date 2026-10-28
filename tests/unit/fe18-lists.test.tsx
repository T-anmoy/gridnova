// FE-18: starting a proposal (customer search / add with the duplicate warning, project-type
// cards), the proposals list (filters, search, sort, CSV of the visible rows, awaiting
// approval), the Library (create, edit, deactivate, from template) and the Excel import
// (created drafts; every error with its sheet cell).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NewProposal from '@/components/dashboard/studio/NewProposal'
import ProposalsList from '@/components/dashboard/studio/ProposalsList'
import Library from '@/components/dashboard/studio/Library'
import Import from '@/components/dashboard/studio/Import'
import { asRoles } from './helpers/permissions-bridge'
import { navState, push } from './helpers/mock-navigation'
import { OPTIONS, makeView, issuedView, refused, studioBackend } from './fixtures/studio'

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: () => Promise.resolve('token') }), useUser: () => ({ user: { id: 'user_test' } }) }))
vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)

function renderWith(node: React.ReactNode, roles: string[] = ['proposal_desk']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const user = userEvent.setup()
  render(asRoles(roles, <QueryClientProvider client={qc}>{node}</QueryClientProvider>))
  return { user }
}

const CUSTOMER = { id: 3, customer_type: 'individual', title: 'Mr.', name: 'Test Kumar Das', attention: null, mobile: '9830000001', email: null, address_lines: ['12 Lake Road'], gstin: null }

beforeEach(() => navState.reset('/dashboard/studio/new'))

describe('New proposal', () => {
  it('search a customer, choose a project type card, start → the draft opens at the Project step', async () => {
    const backend = studioBackend({
      'GET /dashboard/studio/options': { body: OPTIONS },
      'GET /dashboard/studio/library?kind=template': { body: { items: [] } },
      'GET /dashboard/studio/customers?q=Test&limit=20': { body: { items: [CUSTOMER] } },
      'POST /dashboard/studio/proposals': { status: 201, body: makeView() },
    })
    const { user } = renderWith(<NewProposal />)
    await user.type(screen.getByTestId('customer-search'), 'Test')
    await user.click(await within(await screen.findByTestId('customer-results')).findByRole('button', { name: /Test Kumar Das/ }))
    expect(screen.getByTestId('chosen-customer')).toHaveTextContent('Mr. Test Kumar Das')
    expect(screen.getByTestId('start-proposal')).toBeDisabled()
    const card = await screen.findByTestId('type-residential_rooftop')
    expect(card).toHaveTextContent('A home’s rooftop')
    await user.click(card)
    expect(card).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByTestId('start-proposal'))
    await waitFor(() => expect(backend.called('POST', '/dashboard/studio/proposals')[0]?.body).toEqual({ customer_id: 3, project_type: 'residential_rooftop', template_id: null }))
    expect(push).toHaveBeenCalledWith('/dashboard/studio/proposals/7?step=project')
  })

  it('adding a customer: the duplicate is a warning shown inline, with “use this one instead”', async () => {
    const backend = studioBackend({
      'GET /dashboard/studio/options': { body: OPTIONS },
      'GET /dashboard/studio/library?kind=template': { body: { items: [] } },
      'POST /dashboard/studio/customers': { status: 201, body: { customer: { ...CUSTOMER, id: 11, name: 'Ramesh Das' }, duplicates: [{ id: 3, name: 'Test Kumar Das', mobile: '9830000001', gstin: null, matched_on: ['mobile'] }] } },
      'GET /dashboard/studio/customers/3': { body: { customer: CUSTOMER, duplicates: [] } },
    })
    const { user } = renderWith(<NewProposal />)
    await user.click(screen.getByTestId('add-customer'))
    await user.type(await screen.findByLabelText(/Full name/), 'Ramesh Das')
    await user.type(screen.getByLabelText(/Mobile number/), '9830000001')
    await user.type(screen.getByLabelText('Address line 1'), '5 Station Road')
    await user.click(screen.getByRole('button', { name: /Save customer/ }))
    await waitFor(() => expect(backend.called('POST', '/dashboard/studio/customers')[0]?.body).toMatchObject({ customer_type: 'individual', name: 'Ramesh Das', mobile: '9830000001', address_lines: ['5 Station Road'], gstin: null }))
    const warn = await screen.findByTestId('duplicate-warning')
    expect(warn).toHaveTextContent('same mobile')
    await user.click(within(warn).getByRole('button', { name: 'Use this one instead' }))
    await waitFor(() => expect(screen.getByTestId('chosen-customer')).toHaveTextContent('Test Kumar Das'))
  })

  it('a refused mobile shows under the mobile field', async () => {
    studioBackend({
      'GET /dashboard/studio/options': { body: OPTIONS },
      'GET /dashboard/studio/library?kind=template': { body: { items: [] } },
      'POST /dashboard/studio/customers': { status: 422, body: { detail: { code: 'invalid_value', message: 'Enter a 10-digit Indian mobile number.', field: 'mobile' } } },
    })
    const { user } = renderWith(<NewProposal />)
    await user.click(screen.getByTestId('add-customer'))
    await user.type(await screen.findByLabelText(/Full name/), 'Ramesh Das')
    await user.type(screen.getByLabelText(/Mobile number/), '98300')
    await user.click(screen.getByRole('button', { name: /Save customer/ }))
    expect(await screen.findByText('Enter a 10-digit Indian mobile number.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Mobile number/)).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('Studio proposals list', () => {
  const rows = [
    issuedView({ proposal: { id: 1, code: 'SP-1', title: '3 kWp A', total: '201465.00', customer: { id: 1, name: 'Bina Roy', mobile: '9000000001' }, owner_id: 'user_test' } }).proposal,
    makeView({ proposal: { id: 2, code: 'SP-2', title: '52 kWp B', total: '2500000.00', customer: { id: 2, name: 'Amit Sen', mobile: '9000000002' }, owner_id: 'user_x' } }).proposal,
    makeView({ proposal: { id: 3, code: 'SP-3', title: '10 kWp C', total: '98000.00', customer: { id: 3, name: 'Chandan Das', mobile: '9000000003' }, owner_id: 'user_x' } }).proposal,
  ]
  const ok = (items = rows) => ({ body: { items, total: items.length, page: 1, page_size: 25 } })

  beforeEach(() => navState.reset('/dashboard/studio/proposals'))

  it('filters and search go to the API; Management also sees “Awaiting approval”', async () => {
    const backend = studioBackend({
      'GET /dashboard/studio/options': { body: OPTIONS },
      'GET /dashboard/studio/proposals': ok(),
    })
    const { user } = renderWith(<ProposalsList />, ['management'])
    await screen.findByTestId('list-table')
    await user.selectOptions(screen.getByTestId('filter-status'), 'issued')
    await waitFor(() => expect(backend.calls.some((c) => c.path.includes('status=issued'))).toBe(true))
    await user.selectOptions(screen.getByTestId('filter-type'), 'housing_society')
    await waitFor(() => expect(backend.calls.some((c) => c.path.includes('project_type=housing_society'))).toBe(true))
    await user.type(screen.getByTestId('list-search'), '98300')
    await waitFor(() => expect(backend.calls.some((c) => c.path.includes('q=98300'))).toBe(true))
    navState.reset('/dashboard/studio/proposals')
    await waitFor(() => expect(backend.calls.some((c) => c.path.includes('status=pending_approval'))).toBe(true))
  })

  it('“Mine” sends the owner id', async () => {
    const backend = studioBackend({ 'GET /dashboard/studio/options': { body: OPTIONS }, 'GET /dashboard/studio/proposals': ok() })
    const { user } = renderWith(<ProposalsList />, ['proposal_desk'])
    await screen.findByTestId('list-table')
    await user.selectOptions(screen.getByTestId('filter-owner'), 'me')
    await waitFor(() => expect(backend.calls.some((c) => c.path.includes('owner_id=user_test'))).toBe(true))
  })

  it('sortable columns (total compared as text, not numbers)', async () => {
    studioBackend({ 'GET /dashboard/studio/options': { body: OPTIONS }, 'GET /dashboard/studio/proposals': ok() })
    const { user } = renderWith(<ProposalsList />)
    const table = await screen.findByTestId('list-table')
    const order = () => within(table).getAllByTestId('list-row').map((r) => r.textContent?.match(/SP-\d|GN\/[\d/]+/)?.[0])
    await user.click(within(table).getByRole('button', { name: 'Total' }))
    expect(order()).toEqual(['SP-3', 'GN/27/10/2026/01', 'SP-2'])
    await user.click(within(table).getByRole('button', { name: /Total/ }))
    expect(order()).toEqual(['SP-2', 'GN/27/10/2026/01', 'SP-3'])
    expect(within(table).getByRole('columnheader', { name: /Total/ })).toHaveAttribute('aria-sort', 'descending')
  })

  it('CSV export holds exactly the visible rows', async () => {
    studioBackend({ 'GET /dashboard/studio/options': { body: OPTIONS }, 'GET /dashboard/studio/proposals': ok() })
    let saved = ''
    URL.createObjectURL = vi.fn((b: Blob) => {
      void b.text().then((t) => (saved = t))
      return 'blob:csv'
    })
    URL.revokeObjectURL = vi.fn()
    const { user } = renderWith(<ProposalsList />)
    await screen.findByTestId('list-table')
    await user.click(screen.getByTestId('export-csv'))
    await waitFor(() => expect(saved).toContain('Reference,Code,Customer'))
    const lines = saved.replace(/^﻿/, '').trim().split('\r\n')
    expect(lines).toHaveLength(4)
    expect(lines[1]).toContain('GN/27/10/2026/01,SP-1,Bina Roy')
    expect(lines[2]).toContain('2500000.00')
  })

  it('no rows → a plain empty message', async () => {
    studioBackend({ 'GET /dashboard/studio/options': { body: OPTIONS }, 'GET /dashboard/studio/proposals': ok([]) })
    renderWith(<ProposalsList />)
    expect(await screen.findByTestId('list-empty')).toHaveTextContent('No proposals match these filters.')
  })
})

describe('Library', () => {
  const NOTE = { id: 1, kind: 'note', name: 'Net metering', project_type: null, body: { text: 'Net metering by the customer.' }, active: true }

  it('create a note, edit it, deactivate it', async () => {
    const backend = studioBackend({
      'GET /dashboard/studio/options': { body: OPTIONS },
      'GET /dashboard/studio/library?kind=note': { body: { items: [NOTE] } },
      'POST /dashboard/studio/library': { status: 201, body: { ...NOTE, id: 2 } },
      'PATCH /dashboard/studio/library/1': { body: NOTE },
    })
    const { user } = renderWith(<Library />)
    await screen.findByTestId('library-list')
    await user.click(screen.getByTestId('library-add'))
    await user.type(screen.getByLabelText('Name'), 'Earthing')
    await user.type(screen.getByLabelText('Wording'), 'Earthing pits by Grid Nova.')
    await user.click(screen.getByTestId('library-save'))
    await waitFor(() => expect(backend.called('POST', '/dashboard/studio/library')[0]?.body).toEqual({ kind: 'note', name: 'Earthing', project_type: null, body: { text: 'Earthing pits by Grid Nova.' } }))
    await user.click(screen.getByRole('button', { name: /Edit/ }))
    const wording = await screen.findByLabelText('Wording')
    await user.clear(wording)
    await user.type(wording, 'Net metering by the customer at their cost.')
    await user.click(screen.getByTestId('library-save'))
    await waitFor(() => expect(backend.called('PATCH', '/dashboard/studio/library/1')[0]?.body).toEqual({ name: 'Net metering', body: { text: 'Net metering by the customer at their cost.' } }))
    await user.click(screen.getByTestId('library-toggle-1'))
    await waitFor(() => expect(backend.called('PATCH', '/dashboard/studio/library/1').at(-1)?.body).toEqual({ active: false }))
  })

  it('a template offers “New proposal from this”; Management only reads', async () => {
    studioBackend({
      'GET /dashboard/studio/options': { body: OPTIONS },
      'GET /dashboard/studio/library?kind=note': { body: { items: [] } },
      'GET /dashboard/studio/library?kind=template': { body: { items: [{ id: 5, kind: 'template', name: '3 kW standard', project_type: 'residential_rooftop', body: { document: {} }, active: true }] } },
    })
    const { user } = renderWith(<Library />, ['management'])
    expect(screen.queryByTestId('library-add')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('library-tab-template'))
    expect(await screen.findByText('3 kW standard')).toBeInTheDocument()
    expect(screen.queryByTestId('from-template')).not.toBeInTheDocument() // Management cannot create proposals
    expect(screen.queryByRole('button', { name: /Rename/ })).not.toBeInTheDocument()
  })

  it('the Proposal Desk starts a proposal from a template', async () => {
    studioBackend({
      'GET /dashboard/studio/options': { body: OPTIONS },
      'GET /dashboard/studio/library?kind=note': { body: { items: [] } },
      'GET /dashboard/studio/library?kind=template': { body: { items: [{ id: 5, kind: 'template', name: '3 kW standard', project_type: 'residential_rooftop', body: { document: {} }, active: true }] } },
    })
    const { user } = renderWith(<Library />)
    await user.click(screen.getByTestId('library-tab-template'))
    expect(await screen.findByTestId('from-template')).toHaveAttribute('href', '/dashboard/studio/new?template=5')
  })
})

describe('Excel import', () => {
  const xlsx = () => new File(['PK'], 'proposals.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

  it('created drafts are listed with links', async () => {
    const backend = studioBackend({ 'POST /dashboard/studio/import': { status: 201, body: { created: [{ proposal_id: 21, code: 'SP-000021', title: '3 kWp Residential rooftop — A', duplicate_customers: [] }, { proposal_id: 22, code: 'SP-000022', title: '5 kWp Residential rooftop — B', duplicate_customers: [{ id: 1 }] }] } } })
    const { user } = renderWith(<Import />)
    await user.upload(screen.getByTestId('import-file'), xlsx())
    await user.click(screen.getByTestId('import-upload'))
    const list = await screen.findByTestId('import-created')
    expect(within(list).getByRole('link', { name: 'SP-000021' })).toHaveAttribute('href', '/dashboard/studio/proposals/21')
    expect(list).toHaveTextContent('customer may already exist')
    expect(backend.called('POST', '/dashboard/studio/import')[0].form?.get('file')).toBeInstanceOf(File)
  })

  it('all or nothing: every error is shown with its sheet cell', async () => {
    studioBackend({
      'POST /dashboard/studio/import': refused(422, 'import_failed', { errors: [{ sheet: 'Proposal 2', cell: 'B9', field: 'mobile', message: 'Enter a 10-digit Indian mobile number.' }, { sheet: 'Proposal 3', cell: 'B21', field: 'capacity_kwp', message: 'Must be a number.' }] }),
    })
    const { user } = renderWith(<Import />)
    await user.upload(screen.getByTestId('import-file'), xlsx())
    await user.click(screen.getByTestId('import-upload'))
    const table = await screen.findByTestId('import-errors')
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(table).toHaveTextContent('Proposal 2B9mobileEnter a 10-digit Indian mobile number.')
    expect(screen.getByTestId('import-message')).toHaveTextContent('Nothing was imported')
  })

  it('refuses a non-xlsx file before uploading', async () => {
    renderWith(<Import />)
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(screen.getByTestId('import-file'), new File(['x'], 'p.csv', { type: 'text/csv' }))
    expect(screen.getByText('Choose an Excel .xlsx file.')).toBeInTheDocument()
    expect(screen.getByTestId('import-upload')).toBeDisabled()
  })
})
