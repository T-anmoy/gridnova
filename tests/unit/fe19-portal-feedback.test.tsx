import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/client'
import { ApiError } from '@/lib/dashboard/api-error'
import { PortalError } from '@/components/associate/PortalError'
import { failureOf, inactiveAccountOf, portalErrorText } from '@/lib/associate/portal-error'
import { formatDateFor, formatDatetimeFor } from '@/lib/i18n/dates'
import { DashboardError } from '@/components/dashboard/DashboardError'
import en from '@/messages/en.json'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import type { Locale } from '@/lib/i18n/config'

// FE-19 P1, P2, P4, P5: the portal never shows a status code or the server's English
// text, a suspended account is told so in its language, and dates follow the language.

const MESSAGES = { en, hi, bn } as const
const inLocale = (locale: Locale, ui: React.ReactNode) => (
  <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
    {ui}
  </I18nProvider>
)

describe('failureOf / inactiveAccountOf', () => {
  afterEach(() => vi.restoreAllMocks())

  it('tells offline from an unreachable server', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(failureOf(new ApiError(0, 'Network request failed'))).toBe('offline')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    expect(failureOf(new ApiError(0, 'Network request failed'))).toBe('network')
  })

  it.each([
    [500, 'server'],
    [503, 'server'],
    [429, 'rateLimited'],
    [401, 'auth'],
    [403, 'forbidden'],
    [404, 'notFound'],
    [409, 'conflict'],
    [422, 'invalid'],
  ])('%i → %s', (status, kind) => {
    expect(failureOf(new ApiError(status, 'x', 'y'))).toBe(kind)
  })

  it('reads README’s inactive-associate refusal', () => {
    expect(inactiveAccountOf(new ApiError(403, 'x', 'This associate account is suspended.'))).toBe('suspended')
    expect(inactiveAccountOf(new ApiError(403, 'x', 'This associate account is deactivated.'))).toBe('deactivated')
    expect(inactiveAccountOf(new ApiError(403, 'x', 'Your role cannot view payments.'))).toBeNull()
  })
})

describe('portalErrorText', () => {
  const copy = hi.portalFeedback

  it('a feature’s own code first, then the portal’s common codes, then the kind of failure — never the English detail', () => {
    const own = { query_window_closed: 'own sentence' }
    expect(portalErrorText(new ApiError(409, 'x', 'Query window closed', { code: 'query_window_closed' }), copy, own)).toBe('own sentence')
    expect(portalErrorText(new ApiError(404, 'x', 'Onboarding not found.', { code: 'not_found' }), copy)).toBe(copy.codes.not_found)
    expect(portalErrorText(new ApiError(422, 'x', 'Some English detail', { code: 'brand_new' }), copy)).toBe(copy.action.invalid)
    expect(portalErrorText(new ApiError(500, 'x', 'Internal Server Error'), copy)).toBe(copy.action.server)
    expect(portalErrorText(new ApiError(403, 'x', 'This associate account is suspended.'), copy)).toBe(copy.account.suspended.title)
  })
})

describe('PortalError', () => {
  beforeEach(() => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true))
  afterEach(() => vi.restoreAllMocks())

  it.each(['en', 'hi', 'bn'] as const)('a server failure in %s: its title and body, Try again, a call button — no status code', (locale) => {
    const retry = vi.fn()
    render(inLocale(locale, <PortalError error={new ApiError(500, 'API error 500', 'Internal Server Error')} onRetry={retry} />))
    const card = screen.getByTestId('portal-error')
    const copy = MESSAGES[locale].portalFeedback
    expect(card).toHaveTextContent(copy.load.server.title)
    expect(card).toHaveTextContent(copy.load.server.body)
    expect(card.textContent).not.toMatch(/500|Internal Server Error|API error/)
    fireEvent.click(screen.getByRole('button', { name: copy.retry }))
    expect(retry).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: new RegExp(copy.call) })).toHaveAttribute('href', 'tel:+919874774440')
  })

  it('offline: says so, in Bengali, with Try again', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    render(inLocale('bn', <PortalError error={new ApiError(0, 'Network request failed')} onRetry={() => {}} />))
    expect(screen.getByTestId('portal-error')).toHaveAttribute('data-kind', 'offline')
    expect(screen.getByText(bn.portalFeedback.load.offline.title)).toBeInTheDocument()
  })

  it.each([
    ['suspended', 'hi'],
    ['deactivated', 'bn'],
  ] as const)('a %s account (%s) gets its own notice, with the helpline — not "your role can’t access this"', (state, locale) => {
    render(inLocale(locale, <PortalError error={new ApiError(403, 'x', `This associate account is ${state}.`)} onRetry={() => {}} />))
    const notice = screen.getByTestId(`account-${state}`)
    expect(notice).toHaveTextContent(MESSAGES[locale].portalFeedback.account[state].title)
    expect(notice).toHaveTextContent(MESSAGES[locale].portalFeedback.account[state].body)
    expect(screen.queryByText(/role/i)).toBeNull()
    expect(screen.queryByRole('button', { name: MESSAGES[locale].portalFeedback.retry })).toBeNull()
  })

  it('a not-found page offers no retry', () => {
    render(inLocale('en', <PortalError error={new ApiError(404, 'x', 'Onboarding not found.')} onRetry={() => {}} />))
    expect(screen.queryByRole('button', { name: en.portalFeedback.retry })).toBeNull()
  })

  it('an ended session offers sign-in again on the right portal', () => {
    render(inLocale('hi', <PortalError error={new ApiError(401, 'x', 'Invalid or expired token.')} />))
    expect(screen.getByRole('link', { name: hi.portalFeedback.signIn })).toHaveAttribute('href', '/hi/associates/sign-in')
  })
})

describe('dates follow the language, in India time, with Latin digits', () => {
  const iso = '2026-10-12T05:30:00Z'

  it('English stays as before', () => {
    expect(formatDateFor('en', iso)).toBe('12 Oct 2026')
  })

  it('Hindi and Bengali use their month names', () => {
    expect(formatDateFor('hi', iso)).toMatch(/12 अक्टू/)
    expect(formatDateFor('bn', iso)).toMatch(/12 অক্টো/)
    expect(formatDatetimeFor('bn', iso)).toMatch(/11:00/)
  })

  it('never Bengali digits', () => {
    expect(formatDateFor('bn', iso)).not.toMatch(/[০-৯]/)
  })

  it('a missing date is a dash and nonsense comes back as it was', () => {
    expect(formatDateFor('hi', null)).toBe('—')
    expect(formatDateFor('hi', 'not a date')).toBe('not a date')
  })
})

describe('staff: a record outside the reviewer’s regions (S5)', () => {
  it('is a calm notice, not a permission error', () => {
    render(<DashboardError error={new ApiError(403, 'x', 'This record is outside the regions you work in.')} onRetry={() => {}} />)
    expect(screen.getByTestId('outside-regions')).toHaveTextContent('Outside the regions you work in')
    expect(screen.queryByText(/role can’t access/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })
})
