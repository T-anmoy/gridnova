// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'

const mockAuth = vi.fn()
vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }))

afterEach(() => {
  vi.unstubAllGlobals()
  mockAuth.mockReset()
})

const BAD_IDS = ['abc', '12/../../x', '1;DROP', '', ' 1', '1.5', '-3', '%2e%2e', '1\n2']

describe('[id] is validated before any backend URL is built', () => {
  it.each(BAD_IDS)('upload route rejects %j with 400 and never calls the backend', async (id) => {
    mockAuth.mockResolvedValue({ getToken: async () => 'jwt' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { POST } = await import('@/app/api/proposal-inputs/[id]/upload/route')
    const form = new FormData()
    form.set('file', new File(['x'], 'a.pdf'))
    const res = await POST(new Request('http://localhost/api/proposal-inputs/x/upload', { method: 'POST', body: form }), {
      params: Promise.resolve({ id }),
    } as never)
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(BAD_IDS)('lead route rejects %j with 400 and never calls the backend', async (id) => {
    mockAuth.mockResolvedValue({ getToken: async () => 'jwt' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { GET } = await import('@/app/api/proposal-inputs/lead/[id]/route')
    const res = await GET(new Request('http://localhost/api/proposal-inputs/lead/x'), { params: Promise.resolve({ id }) } as never)
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still accepts a numeric id', async () => {
    mockAuth.mockResolvedValue({ getToken: async () => 'jwt' })
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ lead_id: 12, customer: { name: 'A', email: 'a@b.co' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { GET } = await import('@/app/api/proposal-inputs/lead/[id]/route')
    const res = await GET(new Request('http://localhost/api/proposal-inputs/lead/12'), { params: Promise.resolve({ id: '12' }) } as never)
    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8000/api/v1/dashboard/leads/12')
  })
})
