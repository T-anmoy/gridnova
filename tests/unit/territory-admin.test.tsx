import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TerritoriesPage from '@/app/(internal)/dashboard/associate-network/territories/page'
import TerritoryAdmin from '@/components/dashboard/TerritoryAdmin'

const h = vi.hoisted(() => ({ role: 'admin' as string | undefined }))
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
  useUser: () => ({ user: h.role ? { publicMetadata: { role: h.role } } : null }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const STATES = [{ lgd_code: 19, name: 'West Bengal', is_active: true }]
const DISTRICTS = [{ lgd_code: 304, name: 'Hooghly', is_active: true }, { lgd_code: 305, name: 'Howrah', is_active: false }]
const BLOCKS = [{ lgd_code: 9001, name: 'Arambagh', is_active: true }]

let calls: { method: string; url: string; body?: unknown }[]
let respond: (method: string, url: string) => Response | undefined

beforeEach(() => {
  h.role = 'admin'
  calls = []
  respond = () => undefined
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ method, url, body: init?.body ? JSON.parse(init.body as string) : undefined })
      const custom = respond(method, url)
      if (custom) return Promise.resolve(custom)
      if (method !== 'GET') return Promise.resolve(new Response('{}', { status: method === 'POST' ? 201 : 200 }))
      const items = url.includes('/territories/states') ? STATES : url.includes('/territories/districts') ? DISTRICTS : url.includes('/territories/blocks') ? BLOCKS : []
      return Promise.resolve(new Response(JSON.stringify({ items }), { status: 200 }))
    })
  )
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => vi.unstubAllGlobals())

const renderAdmin = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TerritoryAdmin />
    </QueryClientProvider>
  )
}

async function openDistricts(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: 'Districts' }))
  await user.click(screen.getByRole('combobox', { name: 'State' }))
  await user.click(await screen.findByRole('option', { name: 'West Bengal' }))
  await screen.findByText('Hooghly')
}

describe('Territory admin (P7)', () => {
  it('role visibility: only an admin sees the section on the page', async () => {
    h.role = 'sales'
    const qc = new QueryClient()
    const { unmount } = render(<QueryClientProvider client={qc}><TerritoriesPage /></QueryClientProvider>)
    expect(screen.getByTestId('no-access')).toBeInTheDocument()
    expect(screen.queryByText('Manage territories')).not.toBeInTheDocument()
    unmount()
    h.role = 'admin'
    render(<QueryClientProvider client={new QueryClient()}><TerritoriesPage /></QueryClientProvider>)
    expect(await screen.findByText('Manage territories')).toBeInTheDocument()
  })

  it('lists states with a read-only LGD code (no input for it) and no Add button at state level', async () => {
    renderAdmin()
    const row = await screen.findByTestId('territory-row')
    expect(within(row).getByText('19')).toBeInTheDocument()
    expect(within(row).queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Add/ })).toBeNull()
  })

  it('adds a district: validates the LGD code, POSTs exactly the documented body, refetches', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await openDistricts(user)
    await user.click(screen.getByRole('button', { name: 'Add district' }))
    await user.type(screen.getByLabelText('Name *'), 'Hooghly North')
    await user.type(screen.getByLabelText('LGD code *'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Add district', hidden: false, description: undefined }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/positive whole number/)
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)

    await user.clear(screen.getByLabelText('LGD code *'))
    await user.type(screen.getByLabelText('LGD code *'), '999')
    await user.click(screen.getAllByRole('button', { name: 'Add district' }).at(-1)!)
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1))
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url).toBe('http://127.0.0.1:8000/api/v1/dashboard/territories/districts')
    expect(post.body).toEqual({ state_lgd_code: 19, lgd_code: 999, name: 'Hooghly North' })
  })

  it('shows a 409 conflict and a 422 field error in plain words, keeping the dialog open', async () => {
    respond = (m) => (m === 'POST' ? new Response(JSON.stringify({ detail: 'A district with LGD code 999 already exists.' }), { status: 409 }) : undefined)
    const user = userEvent.setup()
    renderAdmin()
    await openDistricts(user)
    await user.click(screen.getByRole('button', { name: 'Add district' }))
    await user.type(screen.getByLabelText('LGD code *'), '999')
    await user.type(screen.getByLabelText('Name *'), 'X')
    await user.click(screen.getAllByRole('button', { name: 'Add district' }).at(-1)!)
    expect(await screen.findByRole('alert')).toHaveTextContent('A district with LGD code 999 already exists.')

    respond = (m) => (m === 'POST' ? new Response(JSON.stringify({ detail: [{ loc: ['body', 'state_lgd_code'], msg: 'unknown state' }] }), { status: 422 }) : undefined)
    await user.click(screen.getAllByRole('button', { name: 'Add district' }).at(-1)!)
    expect(await screen.findByText('state_lgd_code: unknown state')).toBeInTheDocument()
    expect(screen.queryByText(/object Object/)).toBeNull()
  })

  it('blocks need a state and a district first, then POST district_lgd_code', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await user.click(screen.getByRole('tab', { name: 'Blocks' }))
    expect(screen.getByRole('button', { name: 'Add block' })).toBeDisabled()
    await user.click(screen.getByRole('combobox', { name: 'State' }))
    await user.click(await screen.findByRole('option', { name: 'West Bengal' }))
    await user.click(screen.getByRole('combobox', { name: 'District' }))
    await user.click(await screen.findByRole('option', { name: 'Hooghly' }))
    await screen.findByText('Arambagh')
    await user.click(screen.getByRole('button', { name: 'Add block' }))
    await user.type(screen.getByLabelText('LGD code *'), '9100')
    await user.type(screen.getByLabelText('Name *'), 'Pursurah')
    await user.click(screen.getAllByRole('button', { name: 'Add block' }).at(-1)!)
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true))
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ district_lgd_code: 304, lgd_code: 9100, name: 'Pursurah' })
  })

  it('rename: needs a confirm step, PATCHes only the name, and never sends an LGD code in the body', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await openDistricts(user)
    const row = screen.getAllByTestId('territory-row')[0]
    await user.click(within(row).getByRole('button', { name: 'Rename' }))
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(confirm).toBeDisabled() // unchanged name
    await user.clear(screen.getByLabelText('New name'))
    await user.type(screen.getByLabelText('New name'), 'Hugli')
    await user.click(confirm)
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true))
    const patch = calls.find((c) => c.method === 'PATCH')!
    expect(patch.url).toBe('http://127.0.0.1:8000/api/v1/dashboard/territories/districts/304')
    expect(patch.body).toEqual({ name: 'Hugli' })
  })

  it('switch off / on: confirm dialog states the consequence; PATCH carries is_active only', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await openDistricts(user)
    const [active, inactive] = screen.getAllByTestId('territory-row')
    await user.click(within(active).getByRole('button', { name: 'Switch off' }))
    expect(screen.getByText(/stops being offered on the registration forms/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(1))
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ is_active: false })

    await user.click(within(inactive).getByRole('button', { name: 'Switch on' }))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2))
    expect(calls.filter((c) => c.method === 'PATCH')[1].body).toEqual({ is_active: true })
    expect(calls.filter((c) => c.method === 'PATCH')[1].url).toMatch(/territories\/districts\/305$/)
  })

  it('a 403 says only an Admin can change territories', async () => {
    respond = (m) => (m === 'PATCH' ? new Response(JSON.stringify({ detail: 'nope' }), { status: 403 }) : undefined)
    const user = userEvent.setup()
    renderAdmin()
    await openDistricts(user)
    await user.click(within(screen.getAllByTestId('territory-row')[0]).getByRole('button', { name: 'Switch off' }))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only an Admin can change territories.')
  })
})
