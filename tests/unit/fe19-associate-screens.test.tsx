import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { ApiError } from '@/lib/dashboard/api-error'
import { hidesAskNova, isBareRoute } from '@/components/SiteChrome'
import { useUnsavedGuard } from '@/lib/proposals/use-unsaved-guard'
import { I18nProvider } from '@/lib/i18n/client'
import { ASSOCIATE_ROUTES } from '@/lib/associates'
import { EN_PARAMS, withI18n } from './helpers/i18n'
import en from '@/messages/en.json'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'

const root = path.resolve(__dirname, '../..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf8')

// ── Verify page (QR scan) ───────────────────────────────────────────────────

const verify = vi.hoisted(() => ({ result: {} as Record<string, unknown>, refetch: vi.fn() }))
const me = vi.hoisted(() => ({ value: {} as Record<string, unknown>, link: vi.fn() }))
vi.mock('@/lib/associate/api-client', () => ({
  useVerifyAssociate: () => ({ isLoading: false, isFetching: false, data: undefined, error: null, refetch: verify.refetch, ...verify.result }),
  useAssociateMe: () => me.value,
  fetchAssociateDocumentLink: (...a: unknown[]) => me.link(...a),
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))

const VerifyAssociateCard = (await import('@/components/associate/VerifyAssociateCard')).default
const PortalIdCard = (await import('@/components/associate/PortalIdCard')).default

describe('the verify page works from a QR scan on a phone (en / hi / bn)', () => {
  beforeEach(() => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true))
  afterEach(() => vi.restoreAllMocks())

  it.each([
    ['en', en],
    ['hi', hi],
    ['bn', bn],
  ] as const)('%s: an active associate shows name, type, status and the payment note', (_l, m) => {
    verify.result = { data: { name: 'Asha Roy', photo_url: null, type: 'associate', level: null, status: 'active' } }
    render(<VerifyAssociateCard associateId="GNA-WB-26-00001" copy={m.associates.verify} />)
    const ok = screen.getByTestId('verify-active')
    expect(ok).toHaveTextContent('Asha Roy')
    expect(ok).toHaveTextContent(m.associates.verify.statusActive)
    expect(ok).toHaveTextContent(m.associates.verify.paymentNote)
  })

  it('an inactive (suspended or closed) associate warns not to hand over money, with a call button', () => {
    verify.result = { data: { name: 'Asha Roy', photo_url: null, type: 'associate', level: null, status: 'inactive' } }
    render(<VerifyAssociateCard associateId="GNA-WB-26-00001" copy={hi.associates.verify} />)
    expect(screen.getByTestId('verify-inactive')).toHaveTextContent(hi.associates.verify.inactiveBody)
    expect(screen.getByTestId('verify-call')).toHaveAttribute('href', 'tel:+919874774440')
  })

  it('an unknown ID is "not found", with advice and no retry', () => {
    verify.result = { error: new ApiError(404, 'x', 'Associate not found.') }
    render(<VerifyAssociateCard associateId="GNA-XX" copy={bn.associates.verify} />)
    expect(screen.getByTestId('verify-notFound')).toHaveTextContent(bn.associates.verify.notFoundAdvice)
    expect(screen.queryByRole('button', { name: bn.associates.verify.retry })).toBeNull()
  })

  it('offline is never "not a Grid Nova associate" — it says offline and offers Try again', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    verify.result = { error: new ApiError(0, 'Network request failed') }
    render(<VerifyAssociateCard associateId="GNA-WB-26-00001" copy={hi.associates.verify} />)
    expect(screen.getByTestId('verify-offline')).toHaveTextContent(hi.associates.verify.offlineTitle)
    expect(screen.queryByText(hi.associates.verify.notFoundTitle)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: hi.associates.verify.retry }))
    expect(verify.refetch).toHaveBeenCalled()
  })

  it.each([
    [500, 'verify-server'],
    [429, 'verify-rateLimited'],
  ])('%i is its own state, not "not found"', (status, id) => {
    verify.result = { error: new ApiError(status, 'x', 'y') }
    render(<VerifyAssociateCard associateId="GNA-WB-26-00001" copy={en.associates.verify} />)
    expect(screen.getByTestId(id)).toBeInTheDocument()
    expect(screen.queryByText(en.associates.verify.notFoundTitle)).toBeNull()
  })

  it('an expired signed photo link falls back to the badge instead of a broken image', () => {
    verify.result = { data: { name: 'Asha Roy', photo_url: 'https://files.example/p.jpg?sig=old', type: 'associate', level: null, status: 'active' } }
    render(<VerifyAssociateCard associateId="GNA-WB-26-00001" copy={en.associates.verify} />)
    fireEvent.error(screen.getByRole('img', { name: 'Asha Roy' }))
    expect(screen.queryByRole('img', { name: 'Asha Roy' })).toBeNull()
  })
})

// ── ID card page: the welcome letter (P11) ──────────────────────────────────

describe('ID card page', () => {
  const copy = en.associates.portal.associate.idCard
  beforeEach(() => me.link.mockReset())

  it('offers the welcome letter when it exists, and opens it', async () => {
    me.value = { data: { documents: { id_card: true, welcome_letter: true } }, isLoading: false, error: null, refetch: vi.fn() }
    me.link.mockResolvedValue({ url: 'https://files.example/w.pdf' })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(withI18n(<PortalIdCard copy={copy} />))
    fireEvent.click(screen.getByTestId('welcome-letter'))
    await waitFor(() => expect(me.link).toHaveBeenCalledWith('welcome_letter', 'tok'))
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://files.example/w.pdf', '_blank', 'noopener,noreferrer'))
  })

  it('no welcome letter yet → no button', () => {
    me.value = { data: { documents: { id_card: true, welcome_letter: false } }, isLoading: false, error: null, refetch: vi.fn() }
    render(withI18n(<PortalIdCard copy={copy} />))
    expect(screen.queryByTestId('welcome-letter')).toBeNull()
  })

  it('the button text exists in all three languages', () => {
    for (const m of [en, hi, bn]) expect(m.associates.portal.associate.idCard.downloadWelcome.trim()).not.toBe('')
  })
})

// ── Ask Nova on /verify/* and /proposal/* (item 9) ──────────────────────────

describe('the Ask Nova launcher never covers the end of the verify or proposal pages', () => {
  it.each(['/verify/GNA-WB-26-00001', '/verify/p/ABC123', '/proposal/tok123', '/proposal/accept/tok'])('%s hides the launcher', (p) => {
    expect(hidesAskNova(p)).toBe(true)
  })

  it.each(['/', '/careers', '/payment-policy', '/verifying-nothing'])('%s keeps it', (p) => {
    expect(hidesAskNova(p)).toBe(false)
  })

  it('the verify page keeps the site’s navigation and footer', () => {
    expect(isBareRoute('/verify/GNA-WB-26-00001', true)).toBe(false)
  })
})

// ── Payment methods on the site (item 11) ───────────────────────────────────

describe('the site names cheque, NEFT, RTGS and IMPS only', () => {
  const policies = JSON.parse(read('content/policies/policies.en.json')) as { documents: Record<string, unknown> }

  it('Customer Payment Policy 5.2 lists exactly the four methods', () => {
    const md = read('content/policies/GridNova_Policies_Draft_v1.md')
    const s52 = md.slice(md.indexOf('**5.2 How to pay**'), md.indexOf('**5.3'))
    expect(s52).toContain('by cheque, NEFT, RTGS or IMPS.')
    expect(s52).not.toMatch(/demand draft|UPI|drafts/i)
    // The rest of 5.2 is unchanged.
    expect(s52).toContain('Grid Nova never changes its bank details by phone, WhatsApp or email')
    expect(JSON.stringify(policies)).toContain("by cheque, NEFT, RTGS or IMPS. Make cheques payable to")
  })

  it('no page text, policy or Ask Nova answer offers demand draft or UPI', () => {
    const texts = [read('content/policies/policies.en.json'), read('content/policies/notices.en.json')]
    for (const m of [en, hi, bn]) {
      const copy = { ...m, associates: { ...m.associates, portal: { ...m.associates.portal, payments: { ...m.associates.portal.payments, modes: {} } } } }
      texts.push(JSON.stringify(copy))
    }
    for (const t of texts) {
      expect(t).not.toMatch(/demand draft|डिमांड ड्राफ़्ट|ডিমান্ড ড্রাফট|\bUPI\b/i)
    }
  })

  it('"no cash" stays: it is a prohibition, not a payment method', () => {
    expect(read('content/policies/GridNova_Policies_Draft_v1.md')).toContain('**5.1 No cash, ever**')
  })

  it('the components never name a retired method outside the history label', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(path.join(root, dir))) {
        const rel = `${dir}/${f}`
        if (statSync(path.join(root, rel)).isDirectory()) walk(rel)
        else if (/\.tsx?$/.test(f)) files.push(rel)
      }
    }
    walk('components')
    walk('app')
    // Code comments may explain the history label; shown text may not name the methods.
    const shown = (f: string) => read(f).split('\n').filter((l) => !/^\s*(\/\/|\*|\{\/\*)/.test(l)).join('\n')
    const hits = files.filter((f) => /\bUPI\b|[Dd]emand draft/.test(shown(f)))
    expect(hits).toEqual([])
  })
})

// ── Portal switch (item 6) ──────────────────────────────────────────────────

describe('NEXT_PUBLIC_ASSOCIATE_PORTAL_OPEN shows or hides every public associate entry point', () => {
  afterEach(() => vi.doUnmock('@/lib/associates'))

  async function careers(open: boolean) {
    vi.resetModules()
    vi.doMock('@/lib/associates', async (orig) => ({ ...(await orig<typeof import('@/lib/associates')>()), ASSOCIATE_PORTAL_OPEN: open }))
    const { default: CareersPage } = await import('@/app/(site)/[lang]/careers/page')
    return render(withI18n(await CareersPage(EN_PARAMS)))
  }

  it('set: Careers links to both application forms and both sign-ins', async () => {
    const { container } = await careers(true)
    for (const href of Object.values(ASSOCIATE_ROUTES)) expect(container.querySelector(`a[href="${href}"]`), href).not.toBeNull()
  })

  it('unset (closed): none of them is a link', async () => {
    const { container } = await careers(false)
    for (const href of Object.values(ASSOCIATE_ROUTES)) expect(container.querySelector(`a[href="${href}"]`), href).toBeNull()
  })

  it.each([
    ['associates', '@/app/(site)/[lang]/associates/layout'],
    ['preferred', '@/app/(site)/[lang]/preferred/layout'],
  ])('closed: every %s route (apply, sign-in, sign-up, portal) shows "opening soon"', async (_n, p) => {
    vi.resetModules()
    vi.doMock('@/lib/associates', async (orig) => ({ ...(await orig<typeof import('@/lib/associates')>()), ASSOCIATE_PORTAL_OPEN: false }))
    const Layout = (await import(/* @vite-ignore */ p)).default
    render(withI18n(await Layout({ children: <p>real route</p>, params: EN_PARAMS.params })))
    expect(screen.queryByText('real route')).toBeNull()
  })

  it('the public routes it guards all live under those two layouts', () => {
    for (const href of Object.values(ASSOCIATE_ROUTES)) expect(href).toMatch(/^\/(associates|preferred)\//)
    expect(read('app/(site)/[lang]/sitemap.ts'.replace('[lang]/', '').replace('(site)/', ''))).not.toMatch(/associates\/|preferred\//)
  })
})

// ── Resumable survey: leaving while a save runs asks first (P10) ────────────

describe('useUnsavedGuard with the portal’s own question', () => {
  it('asks in the reader’s language before an in-app link while a save is running', () => {
    renderHook(() => useUnsavedGuard(true, hi.portalFeedback.unsaved), {
      wrapper: ({ children }) => <I18nProvider locale="hi" messages={hi as never}>{children}</I18nProvider>,
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const a = document.createElement('a')
    a.href = '/hi/associates/portal'
    document.body.appendChild(a)
    a.click()
    expect(confirm).toHaveBeenCalledWith(hi.portalFeedback.unsaved)
    a.remove()
    confirm.mockRestore()
  })
})
