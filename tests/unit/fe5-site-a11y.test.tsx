// Accessibility behaviour added in FE-5: public forms, the site navigation
// drawer, the language switcher, the error boundary, the offline banner and the
// clickable table rows.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import ContactForm from '@/app/(site)/[lang]/contact/ContactForm'
import EstimateForm from '@/app/(site)/[lang]/estimate/EstimateForm'
import Navigation from '@/components/Navigation'
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher'
import OfflineBanner from '@/components/OfflineBanner'
import SiteError from '@/app/(site)/[lang]/error'
import { ClickableRow } from '@/components/dashboard/ClickableRow'
import { Table, TableBody, TableCell } from '@/components/ui/table'
import Link from 'next/link'
import { en, withI18n } from './helpers/i18n'
import { setLenis } from '@/lib/lenis'

const h = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', async () => {
  const nav = (await import('./helpers/mock-navigation')).navigationMock
  return { ...nav, useRouter: () => ({ ...nav.useRouter(), push: h.push }) }
})

const root = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.resolve(root, rel), 'utf8')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setLenis(null)
})

describe('public forms (contact, estimate)', () => {
  it('contact: a failed submit marks the invalid fields, ties each error to its input, and focuses the first one', async () => {
    const user = userEvent.setup()
    render(<ContactForm t={en.contact.form} />)
    await user.click(screen.getByRole('button', { name: /send message/i }))

    const name = screen.getByLabelText(/your name/i)
    await waitFor(() => expect(name).toHaveFocus())
    expect(name).toHaveAttribute('aria-invalid', 'true')
    const errorId = name.getAttribute('aria-describedby')!
    expect(document.getElementById(errorId)).toHaveAttribute('role', 'alert')
    expect(document.getElementById(errorId)).toHaveTextContent(en.contact.form.errors.nameRequired)
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-invalid', 'true')
  })

  it('contact: sensible autocomplete/inputmode hints, and 16px+ text so iOS does not zoom', () => {
    render(<ContactForm t={en.contact.form} />)
    const email = screen.getByLabelText(/email address/i)
    expect(email).toHaveAttribute('autocomplete', 'email')
    expect(email).toHaveAttribute('spellcheck', 'false')
    expect(screen.getByLabelText(/your name/i)).toHaveAttribute('autocomplete', 'name')
    const phone = screen.getByLabelText(/^phone/i)
    expect(phone).toHaveAttribute('autocomplete', 'tel')
    expect(phone).toHaveAttribute('inputmode', 'tel')
    for (const field of [email, phone]) {
      expect(field.className).toContain('text-base')
      expect(field.className).not.toContain('text-sm')
    }
  })

  it('contact: after a successful send, focus moves to the success heading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })))
    const user = userEvent.setup()
    render(<ContactForm t={en.contact.form} />)
    await user.type(screen.getByLabelText(/your name/i), 'Ravi Sharma')
    await user.type(screen.getByLabelText(/email address/i), 'ravi@example.com')
    await user.selectOptions(screen.getByLabelText(/what are you looking for/i), 'Residential Rooftop')
    await user.type(screen.getByLabelText(/your message/i), 'I would like a quote for a rooftop system please.')
    await user.click(screen.getByRole('button', { name: /send message/i }))
    const heading = await screen.findByRole('heading', { name: en.contact.form.successTitle })
    await waitFor(() => expect(heading).toHaveFocus())
  })

  it('estimate: the customer-type toggles expose their state with aria-pressed', async () => {
    const user = userEvent.setup()
    render(<EstimateForm t={en.estimate.form} />)
    const residential = screen.getByRole('button', { name: en.estimate.form.residential })
    const society = screen.getByRole('button', { name: en.estimate.form.society })
    expect(residential).toHaveAttribute('aria-pressed', 'true')
    expect(society).toHaveAttribute('aria-pressed', 'false')
    await user.click(society)
    expect(society).toHaveAttribute('aria-pressed', 'true')
    expect(residential).toHaveAttribute('aria-pressed', 'false')
  })

  it('estimate: a failed submit focuses the first invalid field', async () => {
    const user = userEvent.setup()
    render(<EstimateForm t={en.estimate.form} />)
    await user.click(screen.getByRole('button', { name: new RegExp(en.estimate.form.submit, 'i') }))
    await waitFor(() => expect(screen.getByLabelText(en.estimate.form.name)).toHaveFocus())
  })
})

describe('site navigation drawer', () => {
  it('toggle exposes aria-expanded/aria-controls; opening moves focus in, Escape closes and returns focus', async () => {
    const user = userEvent.setup()
    render(withI18n(<Navigation />))
    const toggle = screen.getByRole('button', { name: en.nav.openMenu })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'site-mobile-nav')

    await user.click(toggle)
    const panel = document.getElementById('site-mobile-nav')!
    expect(panel).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(panel.contains(document.activeElement)).toBe(true)
    expect(document.activeElement?.tagName).toBe('A')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.getElementById('site-mobile-nav')).not.toBeInTheDocument())
    expect(toggle).toHaveFocus()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('pauses Lenis with the body scroll lock and resumes it on close', async () => {
    const lenis = { stop: vi.fn(), start: vi.fn(), scrollTo: vi.fn() }
    setLenis(lenis as never)
    const user = userEvent.setup()
    render(withI18n(<Navigation />))
    await user.click(screen.getByRole('button', { name: en.nav.openMenu }))
    expect(document.body.style.overflow).toBe('hidden')
    expect(lenis.stop).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(lenis.start).toHaveBeenCalled())
    expect(document.body.style.overflow).toBe('')
  })
})

describe('language switcher', () => {
  it('compact pills carry a 44px hit area; the large variant is 44px tall and wide', () => {
    const { rerender } = render(withI18n(<LanguageSwitcher />))
    const compact = screen.getAllByRole('button')[0]
    expect(compact.className).toContain('after:inset-y-[-9px]')
    rerender(withI18n(<LanguageSwitcher size="md" />))
    const large = screen.getAllByRole('button')[0]
    expect(large.className).toContain('min-h-[44px]')
    expect(large.className).toContain('min-w-[44px]')
  })

  it('keeps a visible keyboard focus ring', () => {
    render(withI18n(<LanguageSwitcher />))
    for (const b of screen.getAllByRole('button')) expect(b.className).toContain('focus-visible:outline-2')
  })
})

describe('error boundary', () => {
  it('shows an on-brand message with Try again (re-runs the render) and a way home, and logs only the digest', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reset = vi.fn()
    const err = Object.assign(new Error('secret customer detail 9876543210'), { digest: 'abc123' })
    const user = userEvent.setup()
    render(withI18n(<SiteError error={err} reset={reset} />))

    expect(screen.getByRole('alert')).toHaveTextContent(en.common.errorTitle)
    expect(screen.getByText(en.common.errorBody)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: en.common.errorHome })).toHaveAttribute('href', '/')
    await user.click(screen.getByRole('button', { name: en.common.errorRetry }))
    expect(reset).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(log.mock.calls)).not.toContain('9876543210')
    expect(JSON.stringify(log.mock.calls)).toContain('abc123')
  })
})

describe('offline banner', () => {
  it('appears while the browser is offline and goes away when it is back (announced politely)', () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
    render(withI18n(<OfflineBanner />))
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByTestId('offline-banner')).toHaveTextContent(en.common.offlineBanner)

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument()
  })
})

describe('ClickableRow', () => {
  const push = h.push

  function row() {
    render(
      <Table>
        <TableBody>
          <ClickableRow href="/dashboard/leads/7">
            <TableCell>
              <Link href="/dashboard/leads/7">Lead 7</Link>
            </TableCell>
            <TableCell>
              <button type="button">Action</button>
            </TableCell>
            <TableCell>plain</TableCell>
          </ClickableRow>
        </TableBody>
      </Table>,
    )
  }

  it('is keyboard reachable and opens on Enter or Space', async () => {
    push.mockClear()
    const user = userEvent.setup()
    row()
    const r = screen.getByText('Lead 7').closest('tr')!
    expect(r).toHaveAttribute('tabindex', '0')
    expect(r).toHaveAttribute('role', 'link')
    r.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(push).toHaveBeenCalledTimes(2)
    expect(push).toHaveBeenCalledWith('/dashboard/leads/7')
  })

  it('a click on plain row text navigates, but clicks on the inner link or button are left alone', async () => {
    push.mockClear()
    const user = userEvent.setup()
    row()
    await user.click(screen.getByText('plain'))
    expect(push).toHaveBeenCalledTimes(1)
    push.mockClear()
    await user.click(screen.getByRole('button', { name: 'Action' }))
    expect(push).not.toHaveBeenCalled()
  })
})

describe('structure checks on the source (cheap guards against regressions)', () => {
  it('no dashboard list row navigates with a bare onClick router.push', () => {
    for (const page of ['leads', 'onboardings', 'operations', 'site-assessments', 'meetings', 'associate-network', 'associate-network/associates', 'proposals', 'accounts']) {
      const src = read(`app/(internal)/dashboard/${page}/page.tsx`)
      expect(src, page).not.toMatch(/<TableRow[^>]*onClick=\{\(\) => router\.push/)
      expect(src, page).toContain('ClickableRow')
    }
  })

  it('no outline-none without a focus-visible replacement, and no transition-all, in app or components', () => {
    const hits = (needle: string) =>
      execSync(`grep -rn "${needle}" app components --include=*.tsx || true`, { cwd: root }).toString().split('\n').filter(Boolean)
    const bare = hits('outline-none').filter((l) => !/focus-visible|data-\[selected|tabIndex|\/\//.test(l))
    expect(bare).toEqual([])
    expect(hits('transition-all')).toEqual([])
  })

  it('every public-site page has a main landmark the skip link can reach', () => {
    for (const rel of ['app/(site)/[lang]/page.tsx', 'app/(site)/[lang]/contact/page.tsx', 'app/(site)/[lang]/estimate/page.tsx', 'app/(site)/[lang]/about/page.tsx']) {
      expect(read(rel)).toContain('<main id="main-content"')
    }
    expect(read('app/(site)/[lang]/layout.tsx')).toContain('href="#main-content"')
  })
})
