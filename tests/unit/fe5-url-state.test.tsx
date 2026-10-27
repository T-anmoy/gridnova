import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { navState } from './helpers/mock-navigation'
import { useUrlParams } from '@/lib/dashboard/use-url-params'
import { asRoles } from './helpers/permissions-bridge'

vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)

const mockUseStaffOnboardings = vi.fn()
vi.mock('@/lib/dashboard/onboarding-api-client', () => ({ useStaffOnboardings: (p: unknown) => mockUseStaffOnboardings(p) }))

beforeEach(() => {
  vi.clearAllMocks()
  navState.reset('/dashboard/onboardings')
  mockUseStaffOnboardings.mockReturnValue({ data: { items: [], page: 1, page_size: 25, total: 60 }, isLoading: false, error: null, refetch: vi.fn() })
})

describe('useUrlParams', () => {
  it('merges keys into the query, drops empty values, and resets the page unless it is named', () => {
    navState.reset('/x', '?status=draft&page=3')
    const { result } = renderHook(() => useUrlParams())
    expect(result.current.page).toBe(3)
    expect(result.current.get('status')).toBe('draft')

    act(() => result.current.set({ attention: '1' }))
    expect(navState.search).toBe('status=draft&attention=1') // page reset
    act(() => result.current.set({ status: undefined }))
    expect(navState.search).toBe('attention=1')
    act(() => result.current.setPage(2))
    expect(navState.search).toBe('attention=1&page=2')
    act(() => result.current.setPage(1))
    expect(navState.search).toBe('attention=1') // page 1 is the default, never written
  })

  it('treats a junk page as page 1', () => {
    navState.reset('/x', '?page=abc')
    expect(renderHook(() => useUrlParams()).result.current.page).toBe(1)
  })
})

describe('list pages keep their filters in the URL', () => {
  async function mount() {
    const { default: Page } = await import('@/app/(internal)/dashboard/onboardings/page')
    render(
      <Suspense fallback={null}>
        {asRoles(['admin'], <Page />)}
      </Suspense>,
    )
    return userEvent.setup()
  }

  it('reads status, attention and page from the query on load (a shared or reloaded link)', async () => {
    navState.reset('/dashboard/onboardings', '?status=submitted&attention=1&page=2')
    await mount()
    expect(mockUseStaffOnboardings).toHaveBeenLastCalledWith({ status: 'submitted', needs_attention: true, page: 2, page_size: 25 })
    expect(screen.getByRole('button', { name: 'Needs attention' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('writes a toggled filter to the URL and returns to page 1', async () => {
    navState.reset('/dashboard/onboardings', '?page=2')
    const user = await mount()
    await user.click(screen.getByRole('button', { name: 'Needs attention' }))
    expect(navState.params.get('attention')).toBe('1')
    expect(navState.params.has('page')).toBe(false)
  })

  it('ignores an unknown status in the URL instead of sending it to the API', async () => {
    navState.reset('/dashboard/onboardings', '?status=bogus')
    await mount()
    expect(mockUseStaffOnboardings).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined }))
  })

  it('Next writes ?page=2', async () => {
    const user = await mount()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(navState.params.get('page')).toBe('2')
  })
})
