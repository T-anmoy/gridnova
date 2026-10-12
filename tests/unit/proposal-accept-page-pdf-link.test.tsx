import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProposalAcceptPage from '@/app/(internal)/proposal/accept/[token]/page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const READY_RESPONSE = {
  id: 7,
  status: 'acceptable',
  state: 'acceptable',
  customer_name: 'Ravi Sharma',
  total_value: 250000,
  valid_until: '2026-12-01',
  scope: 'Rooftop install',
}

// The page is an async Server Component: await it, then render the result.
async function renderPage(token = 'tok_abc123') {
  render(await ProposalAcceptPage({ params: Promise.resolve({ token }) }))
}

describe('ProposalAcceptPage — PDF availability', () => {
  it('shows a Download proposal (PDF) link pointing to the public PDF endpoint when pdf_available is true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...READY_RESPONSE, pdf_available: true }), { status: 200 }))
    )
    await renderPage()

    const link = screen.getByRole('link', { name: /download proposal \(pdf\)/i })
    expect(link).toHaveAttribute('href', 'http://127.0.0.1:8000/api/v1/public/proposals/tok_abc123/pdf')
  })

  it('shows no download link when pdf_available is false or absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(READY_RESPONSE), { status: 200 })))
    await renderPage()

    expect(screen.getByText(/proposal for ravi sharma/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /download proposal/i })).not.toBeInTheDocument()
  })
})
