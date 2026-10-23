import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { en, withI18n } from './helpers/i18n'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import { I18nProvider } from '@/lib/i18n/client'
import { loadOpenApi, requestSchema, responseSchema, validate } from './helpers/openapi'
import { ONBOARDING_OPTIONS, makeOnboarding } from './fixtures/survey-contract'

// ── Module mocks ────────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({
  role: 'admin' as string | undefined,
  application: null as unknown,
  referralLink: { data: undefined as unknown, error: null as unknown, isLoading: false },
  referrals: new Map<number, unknown>(),
  onboardings: {} as { data?: unknown },
}))
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok', userId: 'user_1', isLoaded: true }),
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: () => ({ user: { publicMetadata: { role: h.role } } }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/associates/portal',
  useParams: () => ({ type: 'associate', id: '7' }),
}))
vi.mock('@/lib/associate/api-client', () => ({
  useAssociateMe: () => ({ data: { associate_id: 'GNA-WB-26-00001', full_name: 'Asha Roy', status: 'active', level: null } }),
  useAssociateApplication: () => ({ data: h.application, isLoading: false, error: null, refetch: vi.fn() }),
  useSetApplicationStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useApproveApplication: () => ({ mutateAsync: vi.fn(), isPending: false }),
  fetchApplicationDocumentLink: vi.fn(),
}))
vi.mock('@/lib/associate/referral-api-client', async (orig) => ({
  ...(await orig<object>()),
  useReferralLink: () => ({ ...h.referralLink, refetch: vi.fn() }),
  useReferrals: (page: number) => ({ data: h.referrals.get(page), error: null, isLoading: false, refetch: vi.fn() }),
}))
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboardings: () => ({ ...h.onboardings, isLoading: false, error: null, refetch: vi.fn() }),
}))

import InstallAppCard from '@/components/associate/InstallAppCard'
import { PortalHelpMenuView, helpWhatsappText } from '@/components/associate/PortalHelpMenu'
import PortalShell from '@/components/associate/PortalShell'
import PinnedAction from '@/components/associate/PinnedAction'
import EstimatedCommissionNote from '@/components/associate/EstimatedCommissionNote'
import CustomersList from '@/components/associate/CustomersList'
import PortalReferrals, { absoluteShareUrl } from '@/components/associate/PortalReferrals'
import PhotoCaptureSlot from '@/components/associate/PhotoCaptureSlot'
import ShareSignInCard, { signInMessage, signInUrl } from '@/components/dashboard/ShareSignInCard'
import ApplicationDetailPage from '@/app/(internal)/dashboard/associate-network/[type]/[id]/page'
import EstimateForm from '@/app/(site)/[lang]/estimate/EstimateForm'
import { __resetInstallPromptForTests, INSTALL_DISMISSED_KEY, isIosSafari } from '@/lib/associate/install-prompt'
import { HELPLINE_DISPLAY, HELPLINE_TEL, indianWhatsappNumber, whatsappShareUrl, whatsappUrl } from '@/lib/contact'
import { REFERRAL_STORAGE_KEY, captureReferral, cleanRef, referralFields } from '@/lib/referral'
import { estimateRequestSchema } from '@/lib/lead-schemas'
import { estimateMirrorPayload } from '@/lib/lead-mirror'
import { DEFAULT_PHOTO_GUIDE, PHOTO_GUIDES, photoGuideFor } from '@/lib/associate/photo-guides'
import { EMPTY_FILTERS, filterApiError, filterFieldGroup, filtersFromParams, filtersToParams, hasActiveFilters, leadExportQuery, leadListQuery } from '@/lib/dashboard/lead-filters'
import { leadListResponseSchema } from '@/lib/dashboard/schemas'
import { ApiError } from '@/lib/dashboard/api-error'
import type { EstimatedCommission } from '@/lib/associate/onboarding-types'
import type { ReferralItem } from '@/lib/associate/referral-api-client'

const ease = en.portalEase
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1'

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}
function setStandalone(on: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes('display-mode: standalone'),
    media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}
function fireInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
  e.prompt = vi.fn(async () => {})
  e.userChoice = Promise.resolve({ outcome })
  act(() => {
    window.dispatchEvent(e)
  })
  return e
}

const originalMatchMedia = window.matchMedia
const originalUA = window.navigator.userAgent
beforeEach(() => {
  __resetInstallPromptForTests()
  window.localStorage.clear()
  window.sessionStorage.clear()
  setStandalone(false)
  setUserAgent(ANDROID_UA)
  h.role = 'admin'
  h.referrals = new Map()
  h.referralLink = { data: { associate_id: 'GNA-WB-26-00001', share_path: '/estimate?ref=GNA-WB-26-00001' }, error: null, isLoading: false }
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  window.matchMedia = originalMatchMedia
  setUserAgent(originalUA)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── F1 install card ─────────────────────────────────────────────────────────

describe('F1 — Install the app', () => {
  it('Android Chrome: shows the install button once Chrome offers it, and opens Chrome’s own dialog', async () => {
    render(withI18n(<InstallAppCard />))
    expect(screen.queryByTestId('install-card')).toBeNull()
    const e = fireInstallPrompt('accepted')
    expect(e.defaultPrevented).toBe(true)
    const card = await screen.findByTestId('install-card')
    expect(card).toHaveAttribute('data-mode', 'android')
    await userEvent.setup().click(within(card).getByRole('button', { name: ease.install.button }))
    expect(e.prompt).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByTestId('install-card')).toBeNull())
  })

  it('catches an offer that arrived before the card mounted (another portal screen first)', async () => {
    const { listenForInstallPrompt } = await import('@/lib/associate/install-prompt')
    listenForInstallPrompt()
    fireInstallPrompt()
    render(withI18n(<InstallAppCard />))
    expect(await screen.findByTestId('install-card')).toHaveAttribute('data-mode', 'android')
  })

  it('iPhone Safari: shows the two Share → Add to Home Screen steps, with no install button', async () => {
    setUserAgent(IPHONE_UA)
    render(withI18n(<InstallAppCard />))
    const card = await screen.findByTestId('install-card')
    expect(card).toHaveAttribute('data-mode', 'ios')
    expect(card).toHaveTextContent(ease.install.iosStep1)
    expect(card).toHaveTextContent(ease.install.iosStep2)
    expect(within(card).queryByRole('button', { name: ease.install.button })).toBeNull()
  })

  it('only Safari counts on iPhone (Chrome on iOS cannot add to home screen)', () => {
    expect(isIosSafari(IPHONE_UA)).toBe(true)
    expect(isIosSafari(IPHONE_CHROME_UA)).toBe(false)
    expect(isIosSafari(ANDROID_UA)).toBe(false)
  })

  it('hidden when already running from the home screen', async () => {
    setStandalone(true)
    render(withI18n(<InstallAppCard />))
    fireInstallPrompt()
    setUserAgent(IPHONE_UA)
    await act(async () => {})
    expect(screen.queryByTestId('install-card')).toBeNull()
  })

  it('"Not now" hides it and is remembered on this device', async () => {
    setUserAgent(IPHONE_UA)
    const { unmount } = render(withI18n(<InstallAppCard />))
    await userEvent.setup().click(await screen.findByRole('button', { name: ease.install.dismiss }))
    expect(screen.queryByTestId('install-card')).toBeNull()
    expect(window.localStorage.getItem(INSTALL_DISMISSED_KEY)).toBe('1')
    unmount()
    render(withI18n(<InstallAppCard />))
    await act(async () => {})
    expect(screen.queryByTestId('install-card')).toBeNull()
  })

  it('blocked storage never breaks it (the card shows, dismissal still hides it)', async () => {
    setUserAgent(IPHONE_UA)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    render(withI18n(<InstallAppCard />))
    await userEvent.setup().click(await screen.findByRole('button', { name: ease.install.dismiss }))
    expect(screen.queryByTestId('install-card')).toBeNull()
  })
})

// ── F2 help control ─────────────────────────────────────────────────────────

describe('F2 — Need help? on every portal screen', () => {
  it('Call is a tel: link to the helpline; WhatsApp prefills the Associate ID', async () => {
    render(withI18n(<PortalHelpMenuView associateId="GNA-WB-26-00001" />))
    const toggle = screen.getByRole('button', { name: ease.help.button })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.setup().click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: new RegExp(ease.help.call) })).toHaveAttribute('href', HELPLINE_TEL)
    const wa = screen.getByRole('link', { name: ease.help.whatsappHelp })
    const href = wa.getAttribute('href')!
    expect(href.startsWith('https://wa.me/919874774440?text=')).toBe(true)
    const text = decodeURIComponent(href.split('?text=')[1])
    expect(text).toContain('GNA-WB-26-00001')
    expect(text).toBe(helpWhatsappText(ease.help, 'GNA-WB-26-00001'))
  })

  it('without a known ID the message still reads well; Hindi and Bengali carry the ID too', () => {
    expect(helpWhatsappText(ease.help, null)).toBe(ease.help.whatsappTextNoId)
    expect(helpWhatsappText(hi.portalEase.help, 'GNA-1')).toContain('GNA-1')
    expect(helpWhatsappText(bn.portalEase.help, 'GNA-1')).toContain('GNA-1')
  })

  it('Escape closes it', async () => {
    render(withI18n(<PortalHelpMenuView associateId={null} />))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: ease.help.button }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('link', { name: ease.help.whatsappHelp })).toBeNull()
  })

  it('lives in the shell header — never floating over a pinned submit button, the tab bar or the offline banner', () => {
    render(withI18n(
      <PortalShell base="/associates/portal" active="customers" labels={en.associates.portal.nav} showTerritory={false} signOutLabel="Sign out">
        <form>
          <PinnedAction><button type="submit">Submit customer</button></PinnedAction>
        </form>
      </PortalShell>
    ))
    const help = screen.getByTestId('portal-help-menu')
    expect(screen.getByTestId('portal-language-switcher')).toContainElement(help)
    // No ancestor of the help control is fixed/absolute-positioned (it scrolls with the header).
    for (let el: HTMLElement | null = help; el; el = el.parentElement) {
      expect(el.className).not.toMatch(/\b(fixed|absolute|sticky)\b/)
    }
    const submit = screen.getByRole('button', { name: 'Submit customer' })
    expect(help.contains(submit)).toBe(false)
    expect(screen.getByTestId('pinned-action')).not.toContainElement(help)
    expect(screen.getByTestId('portal-tab-bar')).not.toContainElement(help)
  })

  it('every helpline link in the app comes from lib/contact.ts (no hard-coded copies)', () => {
    const roots = ['app', 'components', 'lib']
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(tsx?|mjs)$/.test(name) && p !== join('lib', 'contact.ts')) {
          const src = readFileSync(p, 'utf8')
          if (/tel:\+919874774440|wa\.me\/919874774440|9874774440/.test(src)) offenders.push(p)
        }
      }
    }
    roots.forEach(walk)
    expect(offenders).toEqual([])
    expect(HELPLINE_DISPLAY).toBe('+91 98747 74440')
  })
})

// ── F3 staff WhatsApp share ─────────────────────────────────────────────────

const APP_BASE = {
  application_id: 7, application_type: 'associate', status: 'approved', full_name: 'Sourav Ghosh', mobile: '98300 12345',
  email: 'sourav@example.com', submitted_at: '2026-10-01T00:00:00Z', status_changed_at: '2026-10-02T00:00:00Z',
  address_territory: { state: { name: 'West Bengal' }, district: { name: 'Hooghly' }, block: null }, associate_id: 'GNA-WB-26-00001',
  date_of_birth: '1990-01-01', address_line: 'x', pin_code: '712101', aadhaar_last4: '1234', pan: 'ABCPE1234F', bank_account_last4: '9999',
  bank_ifsc: 'SBIN0001234', kyc_consent_version: '1', kyc_consent_accepted_at: '2026-10-01T00:00:00Z', documents: [], needs_info_note: null,
  rejection_reason: null, verification_call_completed: true, verification_call_note: 'ok', decided_at: '2026-10-02T00:00:00Z', decided_by_employee_id: 'E1',
}

describe('F3 — Staff: share the sign-in on WhatsApp', () => {
  it('the message names the approval, the ID, the invitation email and the sign-in link', () => {
    const msg = signInMessage({ fullName: 'Sourav Ghosh', associateId: 'GNA-WB-26-00001', type: 'associate', email: 's@example.com' })
    expect(msg).toContain('approved')
    expect(msg).toContain('GNA-WB-26-00001')
    expect(msg).toContain('invitation email (sent to s@example.com)')
    expect(msg).toContain('https://www.gridnova.in/associates/sign-in')
    expect(signInUrl('preferred_associate')).toBe('https://www.gridnova.in/preferred/sign-in')
    expect(signInMessage({ fullName: 'A', associateId: 'GNP-1', type: 'preferred_associate' })).toContain('Preferred Associate application is approved')
  })

  it('opens wa.me/91<mobile> with the message URL-encoded', () => {
    render(<ShareSignInCard fullName="Sourav Ghosh" associateId="GNA-WB-26-00001" type="associate" mobile="+91 98300-12345" email="s@example.com" />)
    const href = screen.getByRole('link', { name: /Share sign-in on WhatsApp/ }).getAttribute('href')!
    const msg = signInMessage({ fullName: 'Sourav Ghosh', associateId: 'GNA-WB-26-00001', type: 'associate', email: 's@example.com' })
    expect(href).toBe(`https://wa.me/919830012345?text=${encodeURIComponent(msg)}`)
    expect(href).not.toMatch(/[\s\n]/)
    expect(new URL(href).searchParams.get('text')).toBe(msg)
  })

  it('without a usable mobile only "Copy message" is offered — and it copies the message', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<ShareSignInCard fullName="A" associateId="GNA-1" type="associate" mobile="12345" />)
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Copy message' }))
    expect(writeText).toHaveBeenCalledWith(signInMessage({ fullName: 'A', associateId: 'GNA-1', type: 'associate' }))
  })

  it('normalises Indian mobiles for wa.me', () => {
    expect(indianWhatsappNumber('9830012345')).toBe('919830012345')
    expect(indianWhatsappNumber('+91-98300 12345')).toBe('919830012345')
    expect(indianWhatsappNumber('09830012345')).toBe('919830012345')
    expect(indianWhatsappNumber('5830012345')).toBeNull()
    expect(indianWhatsappNumber(null)).toBeNull()
  })

  it('shows on an approved application for an Admin', () => {
    h.application = APP_BASE
    render(<ApplicationDetailPage />)
    expect(screen.getByTestId('share-sign-in')).toBeInTheDocument()
  })

  it('never before approval', () => {
    h.application = { ...APP_BASE, status: 'under_review', associate_id: null }
    render(<ApplicationDetailPage />)
    expect(screen.queryByTestId('share-sign-in')).toBeNull()
  })

  it('never for a non-Admin', () => {
    h.application = APP_BASE
    h.role = 'sales'
    render(<ApplicationDetailPage />)
    expect(screen.queryByTestId('share-sign-in')).toBeNull()
  })
})

// ── F4 estimated commission ─────────────────────────────────────────────────

const COMMISSION_ACCEPTED: EstimatedCommission = {
  amount: '5000.00', rate: '5.0000', basis: 'accepted_proposal', value_used: '108900.00', basis_amount: '100000.00', pending_reason: null,
}

describe('F4 — Estimated commission', () => {
  it('accepted proposal: the amount in rupees, the basis, and the policy link', () => {
    render(withI18n(<EstimatedCommissionNote value={COMMISSION_ACCEPTED} />))
    const note = screen.getByTestId('estimated-commission')
    expect(note).toHaveTextContent('Estimated commission ₹5,000.00')
    expect(note).toHaveTextContent(ease.commission.basis.accepted_proposal)
    expect(note).toHaveTextContent(ease.commission.paidNote)
    expect(within(note).getByRole('link', { name: ease.commission.policyLink })).toHaveAttribute('href', '/commission-policy')
  })

  it('indicative estimate, lakh grouping', () => {
    render(withI18n(<EstimatedCommissionNote value={{ ...COMMISSION_ACCEPTED, amount: '125000.50', basis: 'indicative_estimate' }} />))
    expect(screen.getByTestId('estimated-commission')).toHaveTextContent('Estimated commission ₹1,25,000.50')
    expect(screen.getByTestId('estimated-commission')).toHaveTextContent(ease.commission.basis.indicative_estimate)
  })

  it('placeholder rates: "rate will be confirmed", never an amount or an assumed rate', () => {
    render(withI18n(<EstimatedCommissionNote value={{ ...COMMISSION_ACCEPTED, amount: null, rate: null, pending_reason: 'placeholder_rates' }} />))
    const note = screen.getByTestId('estimated-commission')
    expect(note).toHaveTextContent(ease.commission.ratePending)
    expect(note.textContent).not.toMatch(/₹|%/)
  })

  it('nothing for null, undefined, or a custom quote (basis_unavailable)', () => {
    const { container, rerender } = render(withI18n(<EstimatedCommissionNote value={null} />))
    expect(container).toBeEmptyDOMElement()
    rerender(withI18n(<EstimatedCommissionNote value={undefined} />))
    expect(container).toBeEmptyDOMElement()
    rerender(withI18n(<EstimatedCommissionNote value={{ ...COMMISSION_ACCEPTED, amount: null, basis_amount: null, pending_reason: 'basis_unavailable' }} />))
    expect(container).toBeEmptyDOMElement()
  })

  it('on the customer list card (itself a link): shown, with the policy named but no nested link', () => {
    h.onboardings = { data: { items: [makeOnboarding({ estimated_commission: COMMISSION_ACCEPTED }), makeOnboarding({ onboarding_id: 502, estimated_commission: null })], page: 1, page_size: 50, total: 2 } }
    const p = en.associates.portal
    render(withI18n(<CustomersList copy={p.customers} nextStepCopy={p.shared.nextStep} actionNeededLabel="x" portalBase="/associates/portal" />))
    const notes = screen.getAllByTestId('estimated-commission')
    expect(notes).toHaveLength(1)
    expect(notes[0]).toHaveTextContent('₹5,000.00')
    expect(notes[0]).toHaveTextContent(ease.commission.policyLink)
    expect(within(notes[0]).queryByRole('link')).toBeNull()
  })

  it('no source file hard-codes a commission rate', () => {
    const src = ['components/associate/EstimatedCommissionNote.tsx', 'components/associate/CustomersList.tsx', 'components/associate/OnboardingDetail.tsx']
      .map((p) => readFileSync(p, 'utf8')).join('\n')
    expect(src).not.toMatch(/\b8\s*%|0\.08\b/)
  })
})

// ── F5 referral link, public forms, referrals list ──────────────────────────

describe('F5 — the referral (`ref`) on the public forms', () => {
  it('cleanRef keeps a real Associate ID and drops junk', () => {
    expect(cleanRef(' GNA-WB-26-00001 ')).toBe('GNA-WB-26-00001')
    expect(cleanRef('gna-wb-26-00001')).toBe('gna-wb-26-00001')
    expect(cleanRef('<script>alert(1)</script>')).toBeNull()
    expect(cleanRef('A'.repeat(65))).toBeNull()
    expect(cleanRef('')).toBeNull()
    expect(cleanRef(42)).toBeNull()
  })

  it('is kept for the visit: a later page without ?ref still has it', () => {
    expect(captureReferral('?ref=GNA-WB-26-00001')).toBe('GNA-WB-26-00001')
    expect(window.sessionStorage.getItem(REFERRAL_STORAGE_KEY)).toBe('GNA-WB-26-00001')
    expect(captureReferral('?source=estimate')).toBe('GNA-WB-26-00001')
    // A bad ref in a later URL does not wipe the good one.
    expect(captureReferral('?ref=%3Cbad%3E')).toBe('GNA-WB-26-00001')
  })

  it('blocked storage: the URL ref still applies to the page', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(captureReferral('?ref=GNA-1')).toBe('GNA-1')
    expect(captureReferral('')).toBeNull()
  })

  it('the consent flag is sent only when ticked, and never without a ref', () => {
    expect(referralFields(null, true)).toEqual({})
    expect(referralFields('GNA-1', false)).toEqual({ ref: 'GNA-1' })
    expect(referralFields('GNA-1', true)).toEqual({ ref: 'GNA-1', share_with_referrer: true })
  })

  it('the server route never refuses a request because of the referral fields', () => {
    const base = { customerType: 'residential', name: 'Rina Das', phone: '9830012345', email: 'rina@example.com' }
    for (const ref of [42, 'x'.repeat(200), null, { a: 1 }]) {
      const r = estimateRequestSchema.safeParse({ ...base, ref, shareWithReferrer: 'yes' })
      expect(r.success).toBe(true)
      expect(r.data!.ref).toBeUndefined()
      expect(r.data!.shareWithReferrer).toBeUndefined()
    }
    const ok = estimateRequestSchema.parse({ ...base, ref: ' GNA-1 ', shareWithReferrer: true })
    expect(ok.ref).toBe('GNA-1')
    expect(estimateMirrorPayload(ok)).toMatchObject({ ref: 'GNA-1', share_with_referrer: true })
    const noRef = estimateRequestSchema.parse({ ...base, shareWithReferrer: true })
    expect(estimateMirrorPayload(noRef).share_with_referrer).toBeUndefined()
  })

  async function fillAndSubmit() {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(new RegExp(`^${en.estimate.form.name}`)), 'Rina Das')
    await user.type(screen.getByLabelText(new RegExp(`^${en.estimate.form.phone}`)), '9830012345')
    await user.type(screen.getByLabelText(new RegExp(`^${en.estimate.form.email}`)), 'rina@example.com')
    return user
  }
  function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
    return JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
  }

  it('estimate form with ?ref: one unticked consent box; ref sent, consent not sent until ticked', async () => {
    window.history.replaceState(null, '', '/estimate?ref=GNA-WB-26-00001')
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }) as Response)
    vi.stubGlobal('fetch', fetchMock)
    render(withI18n(<EstimateForm t={en.estimate.form} />))
    const box = await screen.findByRole('checkbox', { name: en.estimate.form.referralConsent })
    expect(box).not.toBeChecked()
    const user = await fillAndSubmit()
    await user.click(screen.getByRole('button', { name: new RegExp(en.estimate.form.submit) }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(sentBody(fetchMock).ref).toBe('GNA-WB-26-00001')
    expect(sentBody(fetchMock)).not.toHaveProperty('shareWithReferrer')
  })

  it('estimate form: ticking the box sends the consent', async () => {
    window.history.replaceState(null, '', '/estimate?ref=GNA-WB-26-00001')
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }) as Response)
    vi.stubGlobal('fetch', fetchMock)
    render(withI18n(<EstimateForm t={en.estimate.form} />))
    const user = await fillAndSubmit()
    await user.click(await screen.findByRole('checkbox', { name: en.estimate.form.referralConsent }))
    await user.click(screen.getByRole('button', { name: new RegExp(en.estimate.form.submit) }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(sentBody(fetchMock)).toMatchObject({ ref: 'GNA-WB-26-00001', shareWithReferrer: true })
  })

  it('estimate form with a bad ref (or none): no consent box, and the form works exactly as before', async () => {
    window.history.replaceState(null, '', '/estimate?ref=%3Cscript%3E')
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }) as Response)
    vi.stubGlobal('fetch', fetchMock)
    render(withI18n(<EstimateForm t={en.estimate.form} />))
    await act(async () => {})
    expect(screen.queryByTestId('referral-consent')).toBeNull()
    const user = await fillAndSubmit()
    await user.click(screen.getByRole('button', { name: new RegExp(en.estimate.form.submit) }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(sentBody(fetchMock)).not.toHaveProperty('ref')
    expect(sentBody(fetchMock)).not.toHaveProperty('shareWithReferrer')
  })
})

const REFERRAL_WITH_MOBILE: ReferralItem = {
  lead_id: 812, created_at: '2026-10-22T06:14:03.112000+00:00', customer_name: 'Rina Das', location: 'Siliguri, West Bengal', pin_code: '734001',
  enquiry_kind: 'estimate', status: 'in_progress', share_with_referrer: true, customer_mobile: '9830012345',
}
const REFERRAL_WITHOUT_MOBILE: ReferralItem = {
  lead_id: 790, created_at: '2026-10-21T11:02:45.000000+00:00', customer_name: 'Amit Roy', location: null, pin_code: null,
  enquiry_kind: 'call_booked', status: 'received', share_with_referrer: false,
}

function renderReferrals(locale: 'en' | 'hi' = 'en') {
  const messages = locale === 'hi' ? hi : en
  return render(<I18nProvider locale={locale} messages={messages as typeof en}><PortalReferrals /></I18nProvider>)
}

describe('F5 — My link page', () => {
  it('shows the absolute link on the public site, in the viewer’s language', () => {
    expect(absoluteShareUrl('/estimate?ref=GNA-1', 'en')).toBe('https://www.gridnova.in/estimate?ref=GNA-1')
    expect(absoluteShareUrl('/estimate?ref=GNA-1', 'hi')).toBe('https://www.gridnova.in/hi/estimate?ref=GNA-1')
    h.referrals.set(1, { items: [], page: 1, page_size: 25, total: 0 })
    renderReferrals('hi')
    expect(screen.getByTestId('referral-url')).toHaveTextContent('https://www.gridnova.in/hi/estimate?ref=GNA-WB-26-00001')
  })

  it('a QR code, WhatsApp share, copy and PNG download', async () => {
    h.referrals.set(1, { items: [], page: 1, page_size: 25, total: 0 })
    const user = userEvent.setup()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderReferrals()
    const url = 'https://www.gridnova.in/estimate?ref=GNA-WB-26-00001'
    const qr = screen.getByRole('img', { name: ease.referral.qrAlt })
    expect(qr.querySelector('path')!.getAttribute('d')!.length).toBeGreaterThan(100)
    expect(screen.getByRole('link', { name: new RegExp(ease.referral.whatsapp) })).toHaveAttribute(
      'href',
      whatsappShareUrl(ease.referral.shareText.replace('{url}', url))
    )
    await user.click(screen.getByRole('button', { name: new RegExp(ease.referral.copy) }))
    expect(writeText).toHaveBeenCalledWith(url)
    expect(await screen.findByRole('button', { name: new RegExp(ease.referral.copied) })).toBeInTheDocument()

    const blob = new Blob(['png'], { type: 'image/png' })
    const ctx = { fillRect: vi.fn(), fillStyle: '' }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(blob))
    const createUrl = vi.fn(() => 'blob:qr')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await user.click(screen.getByRole('button', { name: new RegExp(ease.referral.downloadQr) }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(createUrl).toHaveBeenCalledWith(blob)
    expect(ctx.fillRect).toHaveBeenCalled()
  })

  it('a copy that fails says so instead of claiming success', async () => {
    h.referrals.set(1, { items: [], page: 1, page_size: 25, total: 0 })
    const user = userEvent.setup()
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: vi.fn(async () => { throw new Error('no') }) }, configurable: true })
    renderReferrals()
    await user.click(screen.getByRole('button', { name: new RegExp(ease.referral.copy) }))
    expect(await screen.findByText(ease.referral.copyFailed)).toBeInTheDocument()
  })

  it('referred enquiries: name, place, kind, status; call/WhatsApp only with the customer’s consent', () => {
    h.referrals.set(1, { items: [REFERRAL_WITH_MOBILE, REFERRAL_WITHOUT_MOBILE], page: 1, page_size: 25, total: 2 })
    renderReferrals()
    const [withMobile, without] = screen.getAllByTestId('referral-row')
    expect(withMobile).toHaveTextContent('Rina Das')
    expect(withMobile).toHaveTextContent('Siliguri, West Bengal · PIN 734001')
    expect(withMobile).toHaveTextContent(ease.referral.kind.estimate)
    expect(withMobile).toHaveTextContent(ease.referral.status.in_progress)
    expect(within(withMobile).getByRole('link', { name: /Call 9830012345/ })).toHaveAttribute('href', 'tel:+919830012345')
    expect(within(withMobile).getByRole('link', { name: new RegExp(ease.referral.whatsappCustomer) })).toHaveAttribute('href', whatsappUrl(undefined, '919830012345'))

    expect(without).toHaveTextContent('Amit Roy')
    expect(without).toHaveTextContent(ease.referral.noLocation)
    expect(without).toHaveTextContent(ease.referral.kind.call_booked)
    expect(without).toHaveTextContent(ease.referral.status.received)
    expect(within(without).queryByRole('link')).toBeNull()
    expect(without).toHaveTextContent(ease.referral.notShared)
  })

  it('empty list, and "Show more" loads the next page', async () => {
    h.referrals.set(1, { items: [REFERRAL_WITH_MOBILE], page: 1, page_size: 25, total: 26 })
    h.referrals.set(2, { items: [REFERRAL_WITHOUT_MOBILE], page: 2, page_size: 25, total: 26 })
    renderReferrals()
    expect(screen.getAllByTestId('referral-row')).toHaveLength(1)
    await userEvent.setup().click(screen.getByRole('button', { name: ease.referral.showMore }))
    expect(screen.getAllByTestId('referral-row')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: ease.referral.showMore })).toBeNull()
  })

  it('the list says so when there is nothing yet', () => {
    h.referrals.set(1, { items: [], page: 1, page_size: 25, total: 0 })
    renderReferrals()
    expect(screen.getByText(ease.referral.listEmpty)).toBeInTheDocument()
  })

  it('both portals have the page, reachable from the desktop nav (the phone tab bar stays as it was)', () => {
    for (const portal of ['associates', 'preferred']) {
      expect(readFileSync(`app/(site)/[lang]/${portal}/portal/referrals/page.tsx`, 'utf8')).toContain('<PortalReferrals />')
    }
    render(withI18n(<PortalShell base="/preferred/portal" active="referrals" labels={en.associates.portal.nav} showTerritory signOutLabel="Sign out">x</PortalShell>))
    const [side] = screen.getAllByRole('navigation', { name: en.associates.portal.nav.navLabel })
    expect(within(side).getByRole('link', { name: ease.referral.nav })).toHaveAttribute('href', '/preferred/portal/referrals')
    expect(within(screen.getByTestId('portal-tab-bar')).queryByRole('link', { name: ease.referral.nav })).toBeNull()
  })
})

// ── Staff leads: referred by ────────────────────────────────────────────────

describe('Staff leads — referred by (BE-10 §1.4)', () => {
  it('the filter round-trips through the URL and reaches the list and export queries', () => {
    const f = filtersFromParams(new URLSearchParams('referred_by_associate_id=%20GNA-WB-26-00001%20&stage=won'))
    expect(f.referredBy).toBe('GNA-WB-26-00001')
    expect(hasActiveFilters({ ...EMPTY_FILTERS, referredBy: 'GNA-1' })).toBe(true)
    expect(filtersToParams(f).get('referred_by_associate_id')).toBe('GNA-WB-26-00001')
    expect(filtersToParams({ ...f, referredBy: '' }).has('referred_by_associate_id')).toBe(false)
    expect(leadListQuery({ referred_by_associate_id: 'GNA-1', page: 1 })).toContain('referred_by_associate_id=GNA-1')
    expect(leadExportQuery({ referred_by_associate_id: 'GNA-1' })).toContain('referred_by_associate_id=GNA-1')
  })

  it('the structured 422 invalid_associate_id lands under the referred-by field', () => {
    const err = new ApiError(422, 'bad', 'bad', { code: 'invalid_associate_id', message: 'bad', field: 'referred_by_associate_id' })
    const parsed = filterApiError(err)
    expect(parsed).toEqual({ code: 'invalid_associate_id', field: 'referred_by_associate_id' })
    expect(filterFieldGroup(parsed!.field)).toBe('referredBy')
    expect(en.staffLeads.filters.errors.invalid_associate_id).toBeTruthy()
  })

  it('the list schema keeps referred_by', () => {
    const body = { items: [{ id: 1, customer_id: 2, pipeline_stage: 'new', lead_score: null, source: 'website_estimate_form', created_at: '2026-10-22T00:00:00Z', referred_by: { associate_id: 'GNA-1', full_name: 'Sourav Ghosh' } }], page: 1, page_size: 25, total: 1 }
    expect(leadListResponseSchema.parse(body).items[0].referred_by).toEqual({ associate_id: 'GNA-1', full_name: 'Sourav Ghosh' })
  })
})

// ── F6 photo guides ─────────────────────────────────────────────────────────

describe('F6 — Photo guides', () => {
  const knownSlots = [
    ...ONBOARDING_OPTIONS.photo_slots.map((s) => s.key),
    ...Object.keys(en.associates.portal.execution.photoSlots),
  ]

  it('every known slot id has its own entry', () => {
    for (const key of knownSlots) expect(PHOTO_GUIDES[key], key).toBeDefined()
  })

  it('each entry has 2–3 tips in English, Hindi and Bengali', () => {
    for (const { tipsKey } of [...Object.values(PHOTO_GUIDES), DEFAULT_PHOTO_GUIDE]) {
      for (const m of [en, hi, bn]) {
        const tips = (m.photoSlot.guide.tips as Record<string, string[]>)[tipsKey]
        expect(tips.length, `${tipsKey}`).toBeGreaterThanOrEqual(2)
        expect(tips.length).toBeLessThanOrEqual(3)
        tips.forEach((t) => expect(t.trim()).not.toBe(''))
      }
    }
  })

  it('an unknown slot falls back to the general tips; no example image is set yet', () => {
    expect(photoGuideFor('something_new')).toBe(DEFAULT_PHOTO_GUIDE)
    expect(photoGuideFor('toString')).toBe(DEFAULT_PHOTO_GUIDE)
    expect(Object.values(PHOTO_GUIDES).every((g) => !g.exampleImage)).toBe(true)
    expect(readFileSync('lib/associate/photo-guides.ts', 'utf8')).toContain('Example photos to be supplied by Grid Nova (one good photo per slot), placed in `public/portal/examples/`.')
  })

  it('the photo slot has a "How to take this photo" toggle with the slot’s tips, and no image while none is supplied', () => {
    render(withI18n(<PhotoCaptureSlot slotKey="panel_installation_area" label="Panel installation area" captureLabel="Take photo" locationRequiredLabel="x" retryLabel="Retry" value={null} onChange={vi.fn()} />))
    const guide = screen.getByTestId('photo-guide')
    expect(within(guide).getByText(en.photoSlot.guide.toggle)).toBeInTheDocument()
    fireEvent.click(within(guide).getByText(en.photoSlot.guide.toggle))
    for (const tip of en.photoSlot.guide.tips.panel_installation_area) expect(guide).toHaveTextContent(tip)
    expect(within(guide).queryByRole('img')).toBeNull()
  })
})

// ── F7 Sheohar ──────────────────────────────────────────────────────────────

describe('F7 — Sheohar', () => {
  it('is spelled Sheohar in English, and "Seohar" appears nowhere', () => {
    expect(en.projects.districts.names).toContain('Sheohar')
    expect(hi.projects.districts.names).toContain('शिवहर')
    expect(bn.projects.districts.names).toContain('শিওহর')
    for (const f of ['messages/en.json', 'messages/hi.json', 'messages/bn.json']) expect(readFileSync(f, 'utf8')).not.toMatch(/Seohar/)
  })
})

// ── Contract drift ──────────────────────────────────────────────────────────

describe('FE-8 shapes satisfy tests/contract/openapi.json', () => {
  const spec = loadOpenApi()
  const wire = (v: unknown) => JSON.parse(JSON.stringify(v))

  it('GET /associate/referral-link and /associate/referrals (with and without the mobile)', () => {
    expect(validate(spec, responseSchema(spec, '/api/v1/associate/referral-link', 'get')!, h.referralLink.data)).toEqual([])
    expect(validate(spec, responseSchema(spec, '/api/v1/associate/referrals', 'get')!, wire({ items: [REFERRAL_WITH_MOBILE, REFERRAL_WITHOUT_MOBILE], page: 1, page_size: 25, total: 2 }))).toEqual([])
    const params = (spec.paths['/api/v1/associate/referrals'] as { get: { parameters: { name: string }[] } }).get.parameters.map((p) => p.name)
    expect(params).toEqual(expect.arrayContaining(['page', 'page_size']))
  })

  it('the estimate-request mirror and the booking body with ref + consent', () => {
    const d = estimateRequestSchema.parse({ customerType: 'residential', name: 'Rina Das', phone: '9830012345', email: 'rina@example.com', ref: 'GNA-1', shareWithReferrer: true })
    expect(validate(spec, requestSchema(spec, '/api/v1/public/estimate-request', 'post')!, wire(estimateMirrorPayload(d)))).toEqual([])
    const booking = { name: 'Rina', email: 'r@example.com', scheduled_at: '2026-11-01T08:30:00Z', ...referralFields('GNA-1', true) }
    expect(validate(spec, requestSchema(spec, '/api/v1/public/booking', 'post')!, booking)).toEqual([])
  })

  it('the leads list carries referred_by and the filter is a real query parameter', () => {
    const body = { items: [{ id: 1, customer_id: 2, customer_name: 'Rina', pipeline_stage: 'new', lead_score: null, source: 'website_booking', created_at: '2026-10-22T00:00:00Z', assigned_employee_id: null, project_reference_id: null, referred_by: { associate_id: 'GNA-1', full_name: 'Sourav Ghosh' } }], page: 1, page_size: 25, total: 1 }
    expect(validate(spec, responseSchema(spec, '/api/v1/dashboard/leads', 'get')!, body)).toEqual([])
    for (const path of ['/api/v1/dashboard/leads', '/api/v1/dashboard/leads/export']) {
      const names = (spec.paths[path] as { get: { parameters: { name: string }[] } }).get.parameters.map((p) => p.name)
      expect(names).toContain('referred_by_associate_id')
    }
  })
})
