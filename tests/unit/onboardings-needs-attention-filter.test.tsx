import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const mockUseStaffOnboardings = vi.fn()
vi.mock('@/lib/dashboard/onboarding-api-client', () => ({
  useStaffOnboardings: (params: unknown) => mockUseStaffOnboardings(params),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockUseStaffOnboardings.mockReturnValue({
    data: { items: [], page: 1, page_size: 25, total: 0 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
})

describe('Staff onboardings list — "Needs attention" filter', () => {
  it('is off by default (needs_attention omitted from the query)', async () => {
    const { default: OnboardingsListPage } = await import('@/app/(internal)/dashboard/onboardings/page')
    render(<OnboardingsListPage />)
    expect(mockUseStaffOnboardings).toHaveBeenLastCalledWith(
      expect.objectContaining({ needs_attention: undefined })
    )
  })

  it('toggling the button turns needs_attention on, resets to page 1, and toggling again turns it off', async () => {
    const { default: OnboardingsListPage } = await import('@/app/(internal)/dashboard/onboardings/page')
    const user = userEvent.setup()
    render(<OnboardingsListPage />)

    const button = screen.getByRole('button', { name: 'Needs attention' })
    await user.click(button)
    expect(mockUseStaffOnboardings).toHaveBeenLastCalledWith(
      expect.objectContaining({ needs_attention: true, page: 1 })
    )

    await user.click(button)
    expect(mockUseStaffOnboardings).toHaveBeenLastCalledWith(
      expect.objectContaining({ needs_attention: undefined, page: 1 })
    )
  })
})
