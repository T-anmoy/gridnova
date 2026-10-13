import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUser: () => ({ user: { firstName: 'Asha', lastName: 'Roy', emailAddresses: [{ emailAddress: 'asha@gridnova.in' }], publicMetadata: { role: 'admin' } } }),
  useClerk: () => ({ signOut: vi.fn() }),
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('t') }),
}))
vi.mock('@/lib/dashboard/api-client', () => ({
  useProposals: () => ({ data: { total: 3 } }),
  prefetchLeads: vi.fn(),
  prefetchProposals: vi.fn(),
  defaultLeadListParams: () => ({}),
}))
vi.mock('@/lib/dashboard/execution-api-client', () => ({ useWorkQueues: () => ({ data: undefined }) }))
vi.mock('@/components/dashboard/CommandPalette', () => ({ CommandPalette: () => null }))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))

async function mount() {
  const { default: DashboardLayout } = await import('@/app/(internal)/dashboard/layout')
  const user = userEvent.setup()
  render(
    <DashboardLayout>
      <p>page body</p>
    </DashboardLayout>,
  )
  return user
}

describe('dashboard shell — mobile navigation drawer', () => {
  it('is not in the page (or the tab order) until opened; the menu button advertises it', async () => {
    await mount()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Open menu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'dashboard-mobile-nav')
    // Only the desktop sidebar's sign-out exists: the sidebar is no longer mounted twice.
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1)
  })

  it('opens as a modal dialog with labelled controls, closes on Escape, and returns focus to the menu button', async () => {
    const user = await mount()
    const toggle = screen.getByRole('button', { name: 'Open menu' })
    await user.click(toggle)

    const dialog = await screen.findByRole('dialog', { name: 'Navigation menu' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(within(dialog).getByRole('button', { name: 'Close menu' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Leads/ })).toBeInTheDocument()
    // Focus moved into the dialog.
    expect(dialog.contains(document.activeElement)).toBe(true)

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(toggle).toHaveFocus())
  })

  it('traps Tab inside the open drawer', async () => {
    const user = await mount()
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    const dialog = await screen.findByRole('dialog', { name: 'Navigation menu' })
    for (let i = 0; i < 40; i++) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('has a skip link to the main region', async () => {
    await mount()
    const skip = screen.getByRole('link', { name: 'Skip to main content' })
    expect(skip).toHaveAttribute('href', '#main-content')
    expect(document.getElementById('main-content')).toBeInTheDocument()
  })
})
