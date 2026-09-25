import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'tok_abc123' }),
}))

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
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

describe('ProposalAcceptPage — PDF availability', () => {
  it('shows a Download proposal (PDF) link pointing to the public PDF endpoint when pdf_available is true', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:8000')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...READY_RESPONSE, pdf_available: true }), { status: 200 }))
    )
    const { default: ProposalAcceptPage } = await import('@/app/proposal/accept/[token]/page')
    render(<ProposalAcceptPage />)

    const link = await screen.findByRole('link', { name: /download proposal \(pdf\)/i })
    expect(link).toHaveAttribute('href', 'http://127.0.0.1:8000/api/v1/public/proposals/tok_abc123/pdf')
  })

  it('shows no download link when pdf_available is false or absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:8000')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(READY_RESPONSE), { status: 200 }))
    )
    const { default: ProposalAcceptPage } = await import('@/app/proposal/accept/[token]/page')
    render(<ProposalAcceptPage />)

    await screen.findByText(/review & accept your proposal|proposal for/i)
    expect(screen.queryByRole('link', { name: /download proposal/i })).not.toBeInTheDocument()
  })
})
