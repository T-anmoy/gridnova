import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ArchivePage from '@/app/(internal)/dashboard/archive/page'
import ArchiveProjectPage from '@/app/(internal)/dashboard/archive/[id]/page'
import ArchiveImportPage from '@/app/(internal)/dashboard/archive/import/page'
import { navState } from './helpers/mock-navigation'
import { BATCH_ACTIVE, BATCH_VOIDED, CARD, CARD_FOR_SALES, COMMITTED, DOSSIER, DRY_RUN, PAGE, STATS } from './fixtures/archive-contract'

const h = vi.hoisted(() => ({ role: 'admin' as string | undefined, id: '41' }))
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
  useUser: () => ({ user: { publicMetadata: { role: h.role } }, isLoaded: true }),
}))
vi.mock('@/lib/config', () => ({ API_BASE_URL: 'https://api.test' }))
vi.mock('next/navigation', async () => ({ ...(await import('./helpers/mock-navigation')).navigationMock, useParams: () => ({ id: h.id }) }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

interface Call { method: string; path: string; query: URLSearchParams; body: unknown }
let calls: Call[]
let listResponse: () => Response
let detailResponse: () => Response
let importResponses: Array<() => Response>
let batches: unknown[]
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const err = (status: number, code: string, field?: string) => json({ detail: { code, message: 'server words', ...(field ? { field } : {}) } }, status)

beforeEach(() => {
  h.role = 'admin'
  h.id = '41'
  calls = []
  batches = [BATCH_ACTIVE, BATCH_VOIDED]
  listResponse = () => json(PAGE([CARD, { ...CARD, id: 43, ref: 'GN-0003' }], { total: 52 }))
  detailResponse = () => json(DOSSIER)
  importResponses = []
  navState.reset('/dashboard/archive')
  vi.clearAllMocks()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url)
      const method = (init?.method ?? 'GET').toUpperCase()
      const body = init?.body instanceof FormData ? Object.fromEntries(init.body.entries()) : init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({ method, path: u.pathname, query: u.searchParams, body })
      const p = u.pathname.replace('/api/v1/dashboard/archive', '')
      if (p === '/projects') return listResponse()
      if (/^\/projects\/\d+$/.test(p)) return detailResponse()
      if (p === '/stats') return json(STATS)
      if (p === '/template.csv') return new Response('a,b\r\n', { status: 200, headers: { 'Content-Disposition': 'attachment; filename="template.csv"' } })
      if (p === '/imports' && method === 'GET') return json({ items: batches })
      if (p === '/imports' && method === 'POST') return (importResponses.shift() ?? (() => json(DRY_RUN)))()
      if (/^\/imports\/\d+$/.test(p)) return json({ ...BATCH_ACTIVE, report: COMMITTED })
      if (/^\/imports\/\d+\/void$/.test(p)) return json({ ...BATCH_ACTIVE, status: 'voided', void_reason: (body as { reason: string }).reason })
      return json({}, 404)
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}
const listCalls = () => calls.filter((c) => c.path.endsWith('/projects'))

describe('archive list', () => {
  it('shows the cards, the stats strip and a pager from the server total', async () => {
    wrap(<ArchivePage />)
    expect(await screen.findAllByTestId('archive-row')).toHaveLength(2)
    const stats = await screen.findByTestId('archive-stats')
    expect(within(stats).getByTestId('stats-count')).toHaveTextContent('117')
    expect(within(stats).getByTestId('stats-capacity')).toHaveTextContent('412.500 kW')
    expect(within(stats).getByText(/PM Surya Ghar \(residential\)/)).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3 · 52 total')).toBeInTheDocument()
    expect(listCalls()[0].query.get('page_size')).toBe('25')
    const row = screen.getAllByTestId('archive-row')[0]
    expect(within(row).getByRole('link', { name: 'GN-0001' })).toHaveAttribute('href', '/dashboard/archive/41')
    expect(within(row).getByText('15 Mar 2025')).toBeInTheDocument()
    expect(within(row).getByText('3.000 kW')).toBeInTheDocument()
  })

  it('shows only the fields the response has: no Block or Customer column for Sales', async () => {
    h.role = 'sales'
    listResponse = () => json(PAGE([CARD_FOR_SALES]))
    wrap(<ArchivePage />)
    await screen.findAllByTestId('archive-row')
    const headers = screen.getAllByRole('columnheader').map((c) => c.textContent)
    expect(headers).toEqual(expect.arrayContaining(['Reference', 'Scheme', 'Size', 'State', 'District', 'Commissioned', 'Modules', 'Inverter']))
    expect(headers).not.toContain('Block')
    expect(headers).not.toContain('Customer')
  })

  it('filters go to the API with its parameter names and into the URL; paging resets', async () => {
    navState.reset('/dashboard/archive', 'page=3')
    const user = userEvent.setup()
    wrap(<ArchivePage />)
    await screen.findAllByTestId('archive-row')
    await user.type(screen.getByLabelText('District'), 'Howrah')
    await user.type(screen.getByLabelText('Capacity from (kW)'), '5')
    await user.selectOptions(screen.getByLabelText('Scheme'), 'commercial')
    await user.type(screen.getByLabelText('Module make contains'), 'Adani')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(navState.params.get('district')).toBe('Howrah')
    expect(navState.params.get('capacity_min')).toBe('5')
    expect(navState.params.get('scheme')).toBe('commercial')
    expect(navState.params.get('module_make')).toBe('Adani')
    expect(navState.params.has('page')).toBe(false)
    await waitFor(() => {
      const last = listCalls().at(-1)!
      expect(last.query.get('district')).toBe('Howrah')
      expect(last.query.get('capacity_min')).toBe('5')
      expect(last.query.get('scheme')).toBe('commercial')
      expect(last.query.get('module_make')).toBe('Adani')
      expect(last.query.get('page')).toBe('1')
    })
    // the stats strip uses the same filters but no paging
    const stats = calls.filter((c) => c.path.endsWith('/stats')).at(-1)!
    expect(stats.query.get('district')).toBe('Howrah')
    expect(stats.query.has('page')).toBe(false)
  })

  it('restores the filters from the URL (reload, shared link, back button)', async () => {
    navState.reset('/dashboard/archive', 'district=Howrah&scheme=commercial&commissioned_from=2025-01-01&page=2')
    wrap(<ArchivePage />)
    await screen.findAllByTestId('archive-row')
    expect((screen.getByLabelText('District') as HTMLInputElement).value).toBe('Howrah')
    expect((screen.getByLabelText('Scheme') as HTMLSelectElement).value).toBe('commercial')
    expect((screen.getByLabelText('Commissioned from') as HTMLInputElement).value).toBe('2025-01-01')
    const last = listCalls().at(-1)!
    expect(last.query.get('page')).toBe('2')
    expect(last.query.get('commissioned_from')).toBe('2025-01-01')
  })

  it('does not send an inverted capacity range and says what is wrong', async () => {
    const user = userEvent.setup()
    wrap(<ArchivePage />)
    await screen.findAllByTestId('archive-row')
    const before = listCalls().length
    await user.type(screen.getByLabelText('Capacity from (kW)'), '12')
    await user.type(screen.getByLabelText('Capacity to (kW)'), '3')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(await screen.findByText('The “from” value must not be after the “to” value.')).toBeInTheDocument()
    expect(navState.params.has('capacity_min')).toBe(false)
    expect(listCalls()).toHaveLength(before)
  })

  it('a structured 422 from the server becomes a message at the field, in our words', async () => {
    navState.reset('/dashboard/archive', 'capacity_min=5')
    listResponse = () => err(422, 'invalid_range', 'capacity_min')
    wrap(<ArchivePage />)
    expect(await screen.findByText('The “from” value must not be after the “to” value.')).toBeInTheDocument()
    expect(screen.queryByText('server words')).toBeNull()
  })

  it('Clear removes every filter from the URL', async () => {
    navState.reset('/dashboard/archive', 'district=Howrah&q=Das')
    const user = userEvent.setup()
    wrap(<ArchivePage />)
    await screen.findAllByTestId('archive-row')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(navState.search).toBe('')
  })

  it('says so when nothing matches, and when the backend is unreachable', async () => {
    navState.reset('/dashboard/archive', 'district=Atlantis')
    listResponse = () => json(PAGE([]))
    wrap(<ArchivePage />)
    expect(await screen.findByTestId('archive-empty')).toHaveTextContent('No archived project matches these filters.')
  })

  it('a network failure is an honest error with retry, not an empty list', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      throw new TypeError('Failed to fetch')
    })
    wrap(<ArchivePage />)
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((a) => /Can’t reach the server/.test(a.textContent ?? ''))).toBe(true)
    expect(screen.queryByTestId('archive-empty')).toBeNull()
  })

  it('only Admin gets the Import button', async () => {
    const { unmount } = wrap(<ArchivePage />)
    expect(await screen.findByRole('link', { name: /Import/ })).toHaveAttribute('href', '/dashboard/archive/import')
    unmount()
    for (const role of ['management', 'accounts', 'operations', 'engineer', 'sales']) {
      h.role = role
      const r = wrap(<ArchivePage />)
      await screen.findAllByTestId('archive-row')
      expect(screen.queryByRole('link', { name: /Import/ })).toBeNull()
      r.unmount()
    }
  })

  it('has no horizontal page scroll: the table scrolls in its own container', async () => {
    wrap(<ArchivePage />)
    const table = await screen.findByRole('table', { name: 'Archived projects' })
    expect(table.closest('.overflow-auto')).not.toBeNull()
  })
})

describe('archive detail', () => {
  it('groups Project, Location, Equipment, Dates, Warranty, Documents and Data quality flags', async () => {
    wrap(<ArchiveProjectPage />)
    expect(await screen.findByRole('heading', { name: 'GN-0001' })).toBeInTheDocument()
    for (const id of ['project', 'location', 'equipment', 'dates', 'warranty', 'documents', 'quality']) expect(screen.getByTestId(`group-${id}`)).toBeInTheDocument()
    expect(within(screen.getByTestId('field-contract_value_inr')).getByText('₹2,50,000.00')).toBeInTheDocument()
    expect(within(screen.getByTestId('field-warranty_end_modules')).getByText('15 Mar 2037')).toBeInTheDocument()
    expect(within(screen.getByTestId('group-equipment')).getByText('ASP-540')).toBeInTheDocument()
    expect(within(screen.getByTestId('group-quality')).getByText('unknown_block')).toBeInTheDocument()
  })

  it('the map link is built only from stored latitude/longitude and opens safely in a new tab', async () => {
    wrap(<ArchiveProjectPage />)
    const link = await screen.findByRole('link', { name: /Open on Google Maps/ })
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps?q=22.65,88.34')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('has no map link when coordinates are not in the response', async () => {
    const fields = { ...DOSSIER.fields }
    delete fields.latitude
    delete fields.longitude
    detailResponse = () => json({ ...DOSSIER, fields })
    wrap(<ArchiveProjectPage />)
    await screen.findByTestId('archive-dossier')
    expect(screen.queryByRole('link', { name: /Google Maps/ })).toBeNull()
  })

  it('document links open in a new tab with noopener noreferrer; an unsafe stored link is text, not a link', async () => {
    wrap(<ArchiveProjectPage />)
    const docs = await screen.findByRole('list', { name: 'Documents' })
    const link = within(docs).getByRole('link', { name: /Commissioning report/ })
    expect(link).toHaveAttribute('href', 'https://files.example.com/report.pdf')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(within(docs).getByText('Bad link')).toBeInTheDocument()
    expect(within(docs).queryByRole('link', { name: /Bad link/ })).toBeNull()
  })

  it('shows only what is present: a Sales response has no customer, block, address or map', async () => {
    const fields = Object.fromEntries(Object.entries(DOSSIER.fields).filter(([k]) => !['customer_name', 'block', 'address_text', 'pincode', 'latitude', 'longitude', 'documents', 'data_quality_flags', 'contract_value_inr', 'om_status'].includes(k)))
    detailResponse = () => json({ ...DOSSIER, fields, sections: { equipment: DOSSIER.sections.equipment, stages: DOSSIER.sections.stages } })
    wrap(<ArchiveProjectPage />)
    await screen.findByTestId('archive-dossier')
    for (const k of ['customer_name', 'block', 'address_text', 'contract_value_inr']) expect(screen.queryByTestId(`field-${k}`)).toBeNull()
    expect(screen.queryByTestId('group-documents')).toBeNull()
    expect(screen.queryByTestId('group-quality')).toBeNull()
    expect(screen.queryByRole('link', { name: /Google Maps/ })).toBeNull()
  })

  it('a missing or voided project is a plain not-found', async () => {
    detailResponse = () => err(404, 'not_found')
    wrap(<ArchiveProjectPage />)
    expect(await screen.findByTestId('archive-not-found')).toHaveTextContent('doesn’t exist, or its import batch was voided')
  })
})

describe('archive import (Admin only)', () => {
  const csv = (name = 'projects.csv', size = 40) => new File([new Uint8Array(size)], name, { type: 'text/csv' })
  const importCalls = () => calls.filter((c) => c.method === 'POST' && c.path.endsWith('/imports'))

  it('every other role gets a no-access page and no requests', async () => {
    for (const role of ['management', 'accounts', 'operations', 'engineer', 'sales']) {
      h.role = role
      calls = []
      const r = wrap(<ArchiveImportPage />)
      expect(await screen.findByTestId('no-access')).toBeInTheDocument()
      expect(calls).toHaveLength(0)
      r.unmount()
    }
  })

  it('dry run → report → confirm with the batch token → done, then the batch list refreshes', async () => {
    importResponses.push(() => json(DRY_RUN), () => json(COMMITTED))
    const user = userEvent.setup()
    wrap(<ArchiveImportPage />)
    await screen.findByText('Import archived projects')
    const run = screen.getByRole('button', { name: 'Run dry run' })
    expect(run).toBeDisabled()
    await user.upload(screen.getByLabelText(/CSV file/), csv())
    await user.click(run)

    const report = await screen.findByTestId('import-report')
    expect(importCalls()[0].body).toMatchObject({ dry_run: 'true' })
    expect(importCalls()[0].body).not.toHaveProperty('batch_token')
    expect(within(report).getByTestId('count-rows')).toHaveTextContent('120')
    expect(within(report).getByTestId('count-will-import')).toHaveTextContent('117')
    expect(within(report).getByTestId('count-errors')).toHaveTextContent('3')
    const errors = within(report).getByTestId('issues-red')
    expect(within(errors).getByText('state is required.')).toBeInTheDocument()
    expect(within(errors).getByText('missing_required')).toBeInTheDocument()
    const warnings = within(report).getByTestId('issues-amber')
    expect(within(warnings).getByText('District not in the territory master.')).toBeInTheDocument()
    expect(within(warnings).getByText(/Only the first 1 are listed/)).toBeInTheDocument()
    expect(within(report).getByText(/personal data imported/)).toBeInTheDocument()
    expect(screen.queryByTestId('import-done')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Confirm import of 117 projects' }))
    expect(await screen.findByTestId('import-done')).toHaveTextContent('Batch #7')
    expect(importCalls()[1].body).toMatchObject({ dry_run: 'false', batch_token: DRY_RUN.batch_token })
    expect(toast.success).toHaveBeenCalledWith('Imported 117 projects')
    // committed → the batches query is refetched
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && c.path.endsWith('/imports')).length).toBeGreaterThanOrEqual(2))
  })

  it('refuses a file over 10 MB or not a CSV before anything is uploaded', async () => {
    // The picker's accept filter is a hint only; the check must not depend on it.
    const user = userEvent.setup({ applyAccept: false })
    wrap(<ArchiveImportPage />)
    await screen.findByText('Import archived projects')
    const input = screen.getByLabelText(/CSV file/)
    await user.upload(input, new File(['x'], 'sheet.xlsx'))
    expect(await screen.findByText(/Choose a \.csv file/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run dry run' })).toBeDisabled()
    const big = csv('big.csv', 1)
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    await user.upload(input, big)
    expect(await screen.findByText(/over 10 MB/)).toBeInTheDocument()
    expect(importCalls()).toHaveLength(0)
  })

  it('cannot confirm when nothing can be imported or the same file is already a batch', async () => {
    importResponses.push(() => json({ ...DRY_RUN, accepted_count: 0, rejected_count: 120 }), () => json({ ...DRY_RUN, already_imported_batch_id: 7 }))
    const user = userEvent.setup()
    wrap(<ArchiveImportPage />)
    await screen.findByText('Import archived projects')
    await user.upload(screen.getByLabelText(/CSV file/), csv())
    await user.click(screen.getByRole('button', { name: 'Run dry run' }))
    expect(await screen.findByRole('button', { name: /Confirm import of 0 projects/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Run dry run' }))
    await screen.findByTestId('already-imported')
    expect(screen.getByTestId('already-imported')).toHaveTextContent('batch #7')
    expect(screen.getByRole('button', { name: /Confirm import/ })).toBeDisabled()
  })

  it('shows the server’s refusal in our words and keeps nothing half-done', async () => {
    importResponses.push(() => err(413, 'file_too_large'), () => json(DRY_RUN), () => err(409, 'batch_token_mismatch'))
    const user = userEvent.setup()
    wrap(<ArchiveImportPage />)
    await screen.findByText('Import archived projects')
    await user.upload(screen.getByLabelText(/CSV file/), csv())
    await user.click(screen.getByRole('button', { name: 'Run dry run' }))
    expect(await screen.findByTestId('import-error')).toHaveTextContent('over 10 MB')
    expect(screen.queryByTestId('import-report')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Run dry run' }))
    await user.click(await screen.findByRole('button', { name: /Confirm import of 117/ }))
    expect(await screen.findByTestId('import-error')).toHaveTextContent('dry run again')
    expect(screen.queryByTestId('import-done')).toBeNull()
  })

  it('downloads the template through the authenticated route', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const user = userEvent.setup()
    wrap(<ArchiveImportPage />)
    await user.click(await screen.findByRole('button', { name: /Download template/ }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(calls.some((c) => c.path === '/api/v1/dashboard/archive/template.csv')).toBe(true)
    click.mockRestore()
  })

  it('lists batches with status; Void needs a reason, a confirm dialog, and posts the reason', async () => {
    const user = userEvent.setup()
    wrap(<ArchiveImportPage />)
    const rows = await screen.findAllByTestId('batch-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('imported')).toBeInTheDocument()
    expect(within(rows[1]).getByText('voided')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Wrong file')).toBeInTheDocument()
    // a voided batch cannot be voided again
    expect(within(rows[1]).queryByRole('button', { name: 'Void' })).toBeNull()

    const confirmSpy = vi.spyOn(window, 'confirm')
    await user.click(within(rows[0]).getByRole('button', { name: 'Void' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Void batch #7?')).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: 'Void batch' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Reason/), 'ab')
    await user.click(confirm)
    expect(await within(dialog).findByText('Give a reason of at least 3 characters.')).toBeInTheDocument()
    expect(calls.some((c) => c.path.endsWith('/void'))).toBe(false)
    await user.type(within(dialog).getByLabelText(/Reason/), 'c wrong sheet')
    await user.click(confirm)
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/imports/7/void'))).toBe(true))
    expect(calls.find((c) => c.path.endsWith('/void'))!.body).toEqual({ reason: 'abc wrong sheet' })
    expect(toast.success).toHaveBeenCalledWith('Batch voided')
    // no browser confirm() anywhere
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('a second void shows the already-voided sentence inside the dialog', async () => {
    const original = (fetch as unknown as ReturnType<typeof vi.fn>).getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string, init?: RequestInit) =>
      url.endsWith('/void') ? err(409, 'already_voided') : original(url, init),
    )
    const user = userEvent.setup()
    wrap(<ArchiveImportPage />)
    const rows = await screen.findAllByTestId('batch-row')
    await user.click(within(rows[0]).getByRole('button', { name: 'Void' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Reason/), 'duplicate')
    await user.click(within(dialog).getByRole('button', { name: 'Void batch' }))
    expect(await within(dialog).findByText(/already been voided/)).toBeInTheDocument()
  })

  it('opens a batch’s stored report', async () => {
    const user = userEvent.setup()
    wrap(<ArchiveImportPage />)
    const rows = await screen.findAllByTestId('batch-row')
    await user.click(within(rows[0]).getByRole('button', { name: 'Report' }))
    expect(await screen.findByTestId('import-report')).toBeInTheDocument()
  })
})
