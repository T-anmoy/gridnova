import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { en, withI18n } from './helpers/i18n'
import { navState } from './helpers/mock-navigation'
import { writeDraft } from '@/lib/associate/useAutosaveDraft'
import { applyDraftKey } from '@/lib/associate/portal-session'
import { fillDateField } from './helpers/date-field'

vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)
// The signed-in user is a tiny store, so a test can let it arrive after the first render (as Clerk's does).
const ADMIN = { firstName: 'Asha', lastName: 'Roy', emailAddresses: [{ emailAddress: 'asha@gridnova.in' }], publicMetadata: { role: 'admin' } }
const userStore = vi.hoisted(() => {
  let user: unknown = undefined
  const subs = new Set<() => void>()
  return {
    get: () => user,
    set: (u: unknown) => { user = u; subs.forEach((s) => s()) },
    subscribe: (cb: () => void) => { subs.add(cb); return () => subs.delete(cb) },
  }
})
vi.mock('@clerk/nextjs', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUser: () => ({ user: useSyncExternalStore(userStore.subscribe, userStore.get, userStore.get) }),
  useClerk: () => ({ signOut: vi.fn() }),
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('t'), userId: null, isLoaded: true }),
  }
})
vi.mock('@/lib/dashboard/api-client', () => ({
  useProposals: () => ({ data: { total: 0 } }),
  prefetchLeads: vi.fn(),
  prefetchProposals: vi.fn(),
  defaultLeadListParams: () => ({}),
}))
// The shell's second-approval badge (GET /approvals).
vi.mock('@/lib/access/api', () => ({ useApprovals: () => ({ data: [] }) }))
vi.mock('@/lib/studio/api', () => ({ useStudioPendingApprovals: () => ({ data: undefined }) }))
vi.mock('@/lib/dashboard/execution-api-client', () => ({ useWorkQueues: () => ({ data: undefined }) }))
vi.mock('@/components/dashboard/CommandPalette', () => ({ CommandPalette: () => null }))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))
vi.mock('@/lib/associate/portal-session', async (orig) => ({
  ...(await orig<object>()),
  useDraftUserId: () => ({ userId: null, ready: true }),
}))
vi.mock('@/lib/associate/api-client', () => ({
  useTerritoryStates: () => ({ data: [] }),
  useTerritoryDistricts: () => ({}),
  useTerritoryBlocks: () => ({}),
  useKycConsent: () => ({ data: undefined }),
  useSeatAvailability: () => ({ data: undefined, isFetching: false }),
  submitApplication: vi.fn(),
}))

const root = path.resolve(__dirname, '../..')
const read = (f: string) => readFileSync(path.join(root, f), 'utf8')

async function mountShell(at: string, signedIn: unknown = ADMIN) {
  userStore.set(signedIn)
  navState.reset(at)
  const { default: DashboardLayout } = await import('@/app/(internal)/dashboard/layout')
  const user = userEvent.setup()
  render(
    <DashboardLayout>
      <p>page body</p>
    </DashboardLayout>,
  )
  return user
}

describe('dashboard sidebar — its own scroll area', () => {
  // jsdom has no layout: lay the menu's links out 36 px apart in a 400 px window.
  const ROW = 36
  const VISIBLE = 400
  const links = (nav: Element) => Array.from(nav.querySelectorAll('a'))
  const layout = (el: HTMLElement) => {
    const nav = el.closest('[data-testid="sidebar-scroll"]')
    if (el.dataset.testid === 'sidebar-scroll') return { offsetTop: 0, offsetHeight: 0, clientHeight: VISIBLE, scrollHeight: links(el).length * ROW }
    if (nav && el.tagName === 'A') return { offsetTop: links(nav).indexOf(el as HTMLAnchorElement) * ROW, offsetHeight: ROW, clientHeight: 0, scrollHeight: 0 }
    return { offsetTop: 0, offsetHeight: 0, clientHeight: 0, scrollHeight: 0 }
  }
  const inView = (nav: HTMLElement) => {
    const active = within(nav).getByRole('link', { current: 'page' }) as HTMLElement
    const top = layout(active).offsetTop
    return nav.scrollTop <= top && top + ROW <= nav.scrollTop + VISIBLE
  }
  beforeEach(() => {
    for (const prop of ['offsetTop', 'offsetHeight', 'clientHeight', 'scrollHeight'] as const) {
      vi.spyOn(HTMLElement.prototype, prop, 'get').mockImplementation(function (this: HTMLElement) {
        return layout(this)[prop]
      })
    }
  })
  afterEach(() => vi.restoreAllMocks())

  it('only the menu scrolls: min-h-0 + overflow-y-auto + overscroll-contain, between a fixed top and the user block', async () => {
    await mountShell('/dashboard/leads')
    const nav = screen.getByTestId('sidebar-scroll')
    expect(nav.tagName).toBe('NAV')
    for (const c of ['min-h-0', 'flex-1', 'overflow-y-auto', 'overscroll-contain', 'sidebar-scroll']) expect(nav.className).toContain(c)
    // Logo/role at the top and the user block at the bottom are outside the scroll area and never shrink.
    const signOut = screen.getByRole('button', { name: 'Sign out' })
    expect(nav.contains(signOut)).toBe(false)
    expect(signOut.closest('.shrink-0')).not.toBeNull()
    expect(screen.getByText('Grid Nova').closest('.shrink-0')).not.toBeNull()
  })

  it('marks the current page and scrolls it into view inside the menu (Equipment at the bottom)', async () => {
    await mountShell('/dashboard/equipment')
    const nav = screen.getByTestId('sidebar-scroll')
    const active = within(nav).getByRole('link', { current: 'page' })
    expect(active).toHaveTextContent('Equipment')
    expect(nav.scrollTop).toBeGreaterThan(0)
    expect(inView(nav)).toBe(true)
    // More items above the visible window → the top fade is on.
    expect(nav.dataset.moreAbove).toBe('true')
  })

  it('still scrolls to the current page when the role (and so the menu) arrives after the first render', async () => {
    // Before the role is known only the items every role sees are listed.
    await mountShell('/dashboard/equipment', null)
    const nav = screen.getByTestId('sidebar-scroll')
    const countBefore = links(nav).length
    const scrolledBefore = nav.scrollTop
    expect(inView(nav)).toBe(true)
    // The Admin-only items then appear above it and push it down; it is brought back into view.
    act(() => userStore.set(ADMIN))
    expect(links(nav).length).toBeGreaterThan(countBefore)
    expect(nav.scrollTop).toBeGreaterThan(scrolledBefore)
    expect(inView(nav)).toBe(true)
  })

  it('the fixed sidebar starts at lg; below it the drawer is used', async () => {
    await mountShell('/dashboard')
    const aside = document.querySelector('aside')!
    expect(aside.className).toContain('lg:flex')
    expect(aside.className).not.toContain('md:flex')
    expect(screen.getByRole('button', { name: 'Open menu' }).closest('header')!.className).toContain('lg:hidden')
  })
})

describe('dashboard mobile drawer', () => {
  it('is full height in dvh with safe-area padding, locks the page scroll, and closes on Escape with focus back on the menu button', async () => {
    const user = await mountShell('/dashboard/leads')
    const toggle = screen.getByRole('button', { name: 'Open menu' })
    await user.click(toggle)
    const dialog = await screen.findByRole('dialog', { name: 'Navigation menu' })
    expect(dialog.className).toContain('h-dvh')
    expect(dialog.className).toContain('pb-[env(safe-area-inset-bottom)]')
    expect(dialog.className).not.toMatch(/\b100vh\b|h-screen/)
    await waitFor(() => expect(document.body).toHaveAttribute('data-scroll-locked'))
    expect(within(dialog).getByTestId('sidebar-scroll')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
    await waitFor(() => expect(toggle).toHaveFocus())
  })

  it('closes on navigation from anywhere (a menu link, the command palette, the back button)', async () => {
    const user = await mountShell('/dashboard/leads')
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await screen.findByRole('dialog')
    act(() => navState.reset('/dashboard/proposals'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // And it can be opened again afterwards.
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('closes when a menu link is followed', async () => {
    const user = await mountShell('/dashboard/leads')
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('link', { name: /Proposals/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('home Services grid — image layout per breakpoint', () => {
  async function renderGrid() {
    const { default: ServicesGrid } = await import('@/components/ServicesGrid')
    render(withI18n(<ServicesGrid t={en.home.services} />))
    return Array.from(document.querySelectorAll<HTMLImageElement>('img'))
  }

  it('the featured card stacks a 16:10 photo over the text until lg, then sits side by side', async () => {
    const [featured] = await renderGrid()
    const box = featured.parentElement!
    expect(box.className).toContain('aspect-[16/10]')
    expect(box.className).toContain('lg:aspect-auto')
    expect(featured.closest('a')!.className).toContain('lg:grid-cols-[1.15fr_1fr]')
    expect(featured.getAttribute('sizes')).toBe(
      '(min-width: 1280px) 642px, (min-width: 1024px) calc(53.5vw - 43px), (min-width: 768px) calc(100vw - 80px), calc(100vw - 48px)',
    )
  })

  it('every other card stacks a 3:2 photo on top below lg (no 112–140 px strip), with sizes for each breakpoint', async () => {
    const [, ...rows] = await renderGrid()
    expect(rows).toHaveLength(en.home.services.rows.length - 1)
    for (const img of rows) {
      const link = img.closest('a')!
      expect(link.className).toMatch(/\bflex flex-col\b/)
      expect(link.className).toContain('lg:grid-cols-[2fr_3fr]')
      expect(link.className).not.toMatch(/grid-cols-\[1(12|40)px/)
      expect(link.className).toContain('h-full')
      expect(img.parentElement!.className).toContain('aspect-[3/2]')
      expect(img.getAttribute('sizes')).toBe('(min-width: 1024px) 400px, (min-width: 768px) calc(50vw - 50px), calc(100vw - 48px)')
      expect(img.className).toContain('object-cover')
      // A deliberate focal point per photo, never the stretched default.
      expect(img.style.objectPosition).not.toBe('')
    }
  })
})

describe('Ask Nova teaser stays off forms', () => {
  const css = read('app/globals.css')

  it('is hidden on the form pages and while any field has focus (the round button stays)', () => {
    expect(css).toMatch(/body:has\(main\[data-form-page\]\) \.nova-teaser,\s*body:has\(:is\(input:not\(\[type="hidden"\]\), textarea, select, \[contenteditable="true"\]\):focus\) \.nova-teaser \{\s*display: none;/)
    expect(css).not.toMatch(/\[data-floating-launcher\][^{]*\{\s*display: none/)
  })

  it('every form page marks its <main>, and keeps room under the last field on phones', () => {
    for (const page of ['contact', 'estimate', 'solar-calculator', 'book-a-call', 'associates/apply/associate', 'associates/apply/preferred']) {
      expect(read(`app/(site)/[lang]/${page}/page.tsx`), page).toMatch(/<main id="main-content" data-form-page=""/)
    }
    expect(css).toMatch(/@media \(max-width: 767px\) \{\s*main\[data-form-page\] \{\s*padding-bottom: max\(6rem/)
  })
})

describe('apply form — date of birth', () => {
  beforeEach(() => window.localStorage.clear())

  // The date of birth is deliberately never written to a draft (APPLY_DRAFT_EXCLUDED:
  // a shared phone must not keep it). The draft keeps working around the new field.
  it('the draft still restores, the date of birth is still never stored, and typing it emits the same value', async () => {
    writeDraft(applyDraftKey('associate', null), { full_name: 'Asha Roy', date_of_birth: '1995-06-14' })
    const { default: AssociateApplyForm, APPLY_DRAFT_EXCLUDED } = await import('@/components/associate/AssociateApplyForm')
    expect(APPLY_DRAFT_EXCLUDED).toContain('date_of_birth')
    render(withI18n(<AssociateApplyForm kind="associate" t={en.associates} />))
    const f = en.associates.wizard.fields
    expect(screen.getByLabelText(f.full_name.label)).toHaveValue('Asha Roy')
    expect(screen.getByLabelText(f.date_of_birth.label)).toHaveValue('')
    fillDateField(f.date_of_birth.label, '14/06/1995')
    expect(screen.getByText('14 June 1995')).toBeInTheDocument()
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(applyDraftKey('associate', null))!).value
      expect(stored.full_name).toBe('Asha Roy')
      expect(stored).not.toHaveProperty('date_of_birth')
    })
  })

  it('no native date input is left anywhere in app/ or components/', () => {
    const hits = execSync('grep -rln \'type="date"\' app components || true', { cwd: root }).toString().trim()
    expect(hits).toBe('')
  })
})
