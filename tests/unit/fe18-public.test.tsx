// FE-18: the customer's online proposal page /proposal/[token] (every state, wrong last 4,
// accept, decline, no site navigation, noindex) and the verification page /verify/p/[code]
// (every status, the unknown code, in English, Hindi and Bengali), plus proxy.ts and robots.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { OnlineProposal } from '@/app/(internal)/proposal/[token]/OnlineProposal'
import { metadata as onlineMetadata } from '@/app/(internal)/proposal/[token]/layout'
import VerifyProposalCard from '@/components/studio-public/VerifyProposalCard'
import en from '@/messages/en.json'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import type { PublicProposal } from '@/lib/studio/types'
import { PUBLIC_OPEN, VERIFIED, refused, studioBackend } from './fixtures/studio'

const root = path.resolve(__dirname, '../..')
const T = '/public/studio/tok-1'

function openPage(view: Partial<PublicProposal> | null, extra: Parameters<typeof studioBackend>[0] = {}) {
  const backend = studioBackend({ [`GET ${T}`]: view ? { body: { ...PUBLIC_OPEN, ...view } } : { status: 404, body: { detail: 'Not found' } }, ...extra })
  const user = userEvent.setup()
  render(<OnlineProposal token="tok-1" />)
  return { backend, user }
}

beforeEach(() => {
  vi.useRealTimers()
})

describe('the online proposal page', () => {
  it('open: reference, date, capacity, the API’s figures, subsidy and effective cost, milestones, validity, the PDF link', async () => {
    const { backend } = openPage({})
    const figures = await screen.findByTestId('public-figures')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('3 kWp Residential rooftop — Test Kumar Das')
    expect(screen.getByText(/GN\/27\/10\/2026\/01 · 27 October 2026 · 3 kWp/)).toBeInTheDocument()
    expect(figures).toHaveTextContent('₹2,01,465.00')
    expect(screen.getByTestId('public-subsidy')).toHaveTextContent('₹78,000.00')
    expect(screen.getByTestId('public-subsidy')).toHaveTextContent('₹1,23,465.00')
    expect(screen.getByTestId('public-payments')).toHaveTextContent('80% — On commissioning₹1,61,172.00')
    expect(screen.getByTestId('public-validity')).toHaveTextContent('Valid until 11 November 2026')
    expect(screen.getByTestId('public-download')).toHaveAttribute('href', 'http://127.0.0.1:8000/api/v1/public/studio/tok-1/pdf')
    expect(screen.getByTestId('accept-form')).toBeInTheDocument()
    expect(screen.getByTestId('public-contact')).toHaveTextContent('Kolkata office')
    expect(screen.getByTestId('public-contact')).toHaveTextContent('Patna office')
    // Fetched once, from the browser (the view is recorded with the customer's own IP).
    expect(backend.called('GET', T)).toHaveLength(1)
  })

  it('wrong last 4 digits: the customer is told plainly and can try again', async () => {
    const { user, backend } = openPage({}, { [`POST ${T}/accept`]: refused(422, 'mobile_mismatch') })
    await user.type(await screen.findByLabelText('Your full name'), 'Test Kumar Das')
    await user.type(screen.getByLabelText(/Last 4 digits/), '1234')
    await user.click(screen.getByLabelText('I accept this proposal and its terms'))
    await user.click(screen.getByTestId('accept-submit'))
    expect(await screen.findByRole('alert')).toHaveTextContent('not the last 4 digits of the mobile number on the proposal')
    expect(screen.getByLabelText(/Last 4 digits/)).toHaveAttribute('aria-invalid', 'true')
    expect(backend.called('POST', `${T}/accept`)[0].body).toEqual({ full_name: 'Test Kumar Das', mobile_last4: '1234', accept_terms: true })
    expect(screen.getByLabelText(/Last 4 digits/).closest('div')).toHaveTextContent('XXXXXX0001')
  })

  it('the box must be ticked and the name given before anything is sent', async () => {
    const { user, backend } = openPage({})
    await user.click(await screen.findByTestId('accept-submit'))
    expect(screen.getByRole('alert')).toHaveTextContent('Please type your full name.')
    await user.type(screen.getByLabelText('Your full name'), 'T')
    await user.type(screen.getByLabelText(/Last 4 digits/), '0001')
    await user.click(screen.getByTestId('accept-submit'))
    expect(screen.getByRole('alert')).toHaveTextContent('Please tick the box')
    expect(backend.called('POST', `${T}/accept`)).toHaveLength(0)
  })

  it('accepting shows the accepted state with its time', async () => {
    const { user } = openPage({}, { [`POST ${T}/accept`]: { body: { status: 'accepted', accepted_at: '2026-10-28T06:30:00+00:00', already_accepted: false } } })
    await user.type(await screen.findByLabelText('Your full name'), 'Test Kumar Das')
    await user.type(screen.getByLabelText(/Last 4 digits/), '0001')
    await user.click(screen.getByLabelText('I accept this proposal and its terms'))
    await user.click(screen.getByTestId('accept-submit'))
    expect(await screen.findByTestId('state-accepted')).toHaveTextContent('Accepted on 28 October 2026')
    expect(screen.queryByTestId('accept-form')).not.toBeInTheDocument()
  })

  it('accepting a proposal that expired meanwhile switches to the expired state', async () => {
    const { user } = openPage({}, { [`POST ${T}/accept`]: refused(409, 'proposal_expired') })
    await user.type(await screen.findByLabelText('Your full name'), 'T K D')
    await user.type(screen.getByLabelText(/Last 4 digits/), '0001')
    await user.click(screen.getByLabelText('I accept this proposal and its terms'))
    await user.click(screen.getByTestId('accept-submit'))
    expect(await screen.findByTestId('state-expired')).toBeInTheDocument()
  })

  it('decline with an optional reason', async () => {
    const { user, backend } = openPage({}, { [`POST ${T}/decline`]: { body: { status: 'declined', already_declined: false } } })
    await user.click(await screen.findByTestId('decline-open'))
    await user.type(screen.getByLabelText(/tell us why/), 'Too costly for now')
    await user.click(screen.getByTestId('decline-submit'))
    expect(await screen.findByTestId('state-declined')).toBeInTheDocument()
    expect(backend.called('POST', `${T}/decline`)[0].body).toEqual({ reason: 'Too costly for now' })
  })

  it.each([
    ['accepted', 'state-accepted'],
    ['declined', 'state-declined'],
  ] as const)('%s: says so, keeps the figures and the PDF, no accept form', async (state, id) => {
    openPage({ state, accepted_at: '2026-10-28T06:30:00+00:00' })
    expect(await screen.findByTestId(id)).toBeInTheDocument()
    expect(screen.getByTestId('public-download')).toBeInTheDocument()
    expect(screen.queryByTestId('accept-form')).not.toBeInTheDocument()
  })

  it('expired: the message and contact, no figures, no accept', async () => {
    openPage({ state: 'expired' })
    expect(await screen.findByTestId('state-expired')).toHaveTextContent('This proposal has expired — please contact Grid Nova for an updated one.')
    expect(screen.queryByTestId('public-figures')).not.toBeInTheDocument()
    expect(screen.queryByTestId('accept-form')).not.toBeInTheDocument()
    expect(screen.getByTestId('public-contact')).toBeInTheDocument()
  })

  it('superseded: a newer version exists — without revealing it (no figures, no reference)', async () => {
    openPage({ state: 'superseded' })
    const box = await screen.findByTestId('state-superseded')
    expect(box).toHaveTextContent('A newer version of this proposal has been issued.')
    expect(document.body.textContent).not.toContain('GN/27/10/2026/01')
    expect(screen.queryByTestId('public-figures')).not.toBeInTheDocument()
  })

  it('unknown token: not found, with contact', async () => {
    openPage(null)
    expect(await screen.findByTestId('state-notfound')).toHaveTextContent('We could not find this proposal')
  })

  it('lives exactly at /proposal/[token], is never indexed, and shows no site navigation', async () => {
    expect(existsSync(path.join(root, 'app/(internal)/proposal/[token]/page.tsx'))).toBe(true)
    expect(onlineMetadata.robots).toMatchObject({ index: false, follow: false })
    const { isBareRoute } = await import('@/components/SiteChrome')
    expect(isBareRoute('/proposal/AbC-123_tok')).toBe(true)
    expect(isBareRoute('/proposal/new')).toBe(false)
    expect(isBareRoute('/proposal/accept/tok')).toBe(true)
  })
})

describe('the verification page', () => {
  const LOCALES = { en: en.proposalVerify, hi: hi.proposalVerify, bn: bn.proposalVerify }

  function verify(locale: keyof typeof LOCALES, reply: Parameters<typeof studioBackend>[0][string]) {
    studioBackend({ 'GET /public/proposals/verify/ABCD2345EFGH': reply })
    render(<VerifyProposalCard code="ABCD2345EFGH" copy={LOCALES[locale]} locale={locale} />)
  }

  it.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])('%s: valid — “genuine” in green with reference, date, project, total and masked name', async (l) => {
    verify(l, { body: VERIFIED })
    const box = await screen.findByTestId('verify-status-valid')
    expect(box).toHaveTextContent(LOCALES[l].statusValidTitle)
    expect(box.className).toContain('green')
    const card = screen.getByTestId('verify-proposal')
    expect(card).toHaveTextContent('GN/27/10/2026/01')
    expect(card).toHaveTextContent('₹2,01,465.00')
    expect(card).toHaveTextContent('Test K.')
  })

  it.each([
    ['superseded', 'statusSupersededTitle'],
    ['expired', 'statusExpiredTitle'],
    ['accepted', 'statusAcceptedTitle'],
    ['declined', 'statusDeclinedTitle'],
  ] as const)('%s has its own wording in every language, and never the green “genuine and current” look', async (status, key) => {
    for (const l of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
      verify(l, { body: { ...VERIFIED, status } })
      const box = await screen.findByTestId(`verify-status-${status}`)
      expect(box).toHaveTextContent(LOCALES[l][key])
      expect(box.textContent).not.toContain(LOCALES[l].statusValidTitle)
      expect(box.className).not.toContain('green')
      document.body.innerHTML = ''
    }
  })

  it.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])('%s: an unknown code warns before any payment', async (l) => {
    verify(l, { status: 404, body: { detail: 'No Grid Nova proposal has this code.' } })
    const box = await screen.findByTestId('verify-status-unknown')
    expect(box).toHaveTextContent(LOCALES[l].notFoundBody)
  })

  it('the English unknown-code wording is the brief’s', () => {
    expect(en.proposalVerify.notFoundBody).toBe('We could not find this proposal. Please contact Grid Nova before making any payment.')
    expect(en.proposalVerify.statusValidTitle).toBe('This is a genuine Grid Nova Energy proposal')
  })

  it('every language has every key, filled', () => {
    for (const m of [hi.proposalVerify, bn.proposalVerify]) {
      expect(Object.keys(m).sort()).toEqual(Object.keys(en.proposalVerify).sort())
      for (const v of Object.values(m)) expect(v.trim()).not.toBe('')
    }
  })

  it('a network failure offers a retry', async () => {
    verify('en', { status: 500, body: { detail: 'boom' } })
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

// ── proxy.ts and robots.ts ──────────────────────────────────────────────────

type Predicate = (req: { nextUrl: { pathname: string } }) => boolean
let predicates: Predicate[] = []
vi.mock('@clerk/nextjs/server', () => ({
  createRouteMatcher: (p: Predicate) => {
    predicates.push(p)
    return (req: { nextUrl: { pathname: string } }) => p(req)
  },
  clerkMiddleware: (h: unknown) => h,
}))
const req = (pathname: string) => ({ nextUrl: { pathname } })

describe('proxy.ts and robots.ts', () => {
  beforeEach(async () => {
    vi.resetModules()
    predicates = []
    await import('@/proxy')
  })

  it('both public pages are reachable signed out; the staff wizard stays protected', () => {
    const [staff, associate, preferred] = predicates
    for (const p of ['/proposal/tok-1', '/verify/p/ABCD2345EFGH', '/hi/verify/p/ABCD2345EFGH', '/bn/verify/p/ABCD2345EFGH']) {
      for (const m of [staff, associate, preferred]) expect(m(req(p)), p).toBe(false)
    }
    expect(staff(req('/proposal/new'))).toBe(true)
    expect(staff(req('/dashboard/studio'))).toBe(true)
  })

  it('robots.txt keeps the online proposals and the verification pages out of search', async () => {
    const { default: robots } = await import('@/app/robots')
    const rules = robots().rules as { disallow: string[] }
    for (const p of ['/proposal/', '/verify/p/', '/hi/verify/p/', '/bn/verify/p/']) expect(rules.disallow).toContain(p)
  })

  it('the verification page itself says noindex', async () => {
    const { generateMetadata } = await import('@/app/(site)/[lang]/verify/p/[code]/page')
    const meta = await generateMetadata({ params: Promise.resolve({ lang: 'hi' }) })
    expect(meta.robots).toMatchObject({ index: false, follow: false })
    expect(meta.title).toBe(hi.proposalVerify.metaTitle)
  })
})

describe('the money rule on the public pages', () => {
  it('shows amounts exactly as sent (no rounding, no recalculation)', async () => {
    openPage({ total: '201465.37', basic: '184999.99', gst: '16465.38' })
    const f = await screen.findByTestId('public-figures')
    expect(within(f).getByText('₹2,01,465.37')).toBeInTheDocument()
    await waitFor(() => expect(f).toHaveTextContent('₹1,84,999.99'))
  })
})
