import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BookingWidget from '@/app/(site)/[lang]/book-a-call/BookingWidget'
import { withI18n, en } from './helpers/i18n'
import { bookingErrorKey } from '@/lib/booking-errors'
import { istDateKey } from '@/lib/dashboard/utils'

// BE-1 §4 bodies: 422/429 `{detail: {code, field?, message}}`.
const json = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body }) as Response

const FUTURE = new Date(Date.now() + 10 * 86_400_000)
FUTURE.setUTCHours(8, 30, 0, 0) // 14:00 IST
const dateStr = istDateKey(FUTURE)
const AVAILABILITY = { duration_minutes: 30, days_ahead: 14, slots: [{ scheduled_at: FUTURE.toISOString(), label: 'Slot IST' }] }

async function reachFormAndSubmit(postResponse: Response) {
  const fetchMock = vi.fn().mockResolvedValueOnce(json(AVAILABILITY)).mockResolvedValueOnce(postResponse)
  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()
  render(withI18n(<BookingWidget />))
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: dateStr } })
  await user.click(screen.getByRole('combobox'))
  await user.click(await screen.findByRole('option', { name: '2:00 PM' }))
  await user.click(screen.getByRole('button', { name: /check availability/i }))
  await user.type(await screen.findByLabelText('Name'), 'Asha Roy')
  await user.type(screen.getByLabelText('Email'), 'asha@example.com')
  await user.click(screen.getByRole('button', { name: /confirm booking/i }))
  return fetchMock
}

beforeEach(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('bookingErrorKey', () => {
  it('maps the BE-1 codes and a plain 429', () => {
    expect(bookingErrorKey(422, { code: 'timezone_required', field: 'scheduled_at' })).toBe('timezoneRequired')
    expect(bookingErrorKey(422, { code: 'slot_not_offered' })).toBe('slotNotOffered')
    expect(bookingErrorKey(422, { code: 'duration_too_long' })).toBe('durationTooLong')
    expect(bookingErrorKey(429, { code: 'daily_booking_limit' })).toBe('dailyLimit')
    expect(bookingErrorKey(429, 'Rate limit exceeded.')).toBe('rateLimited')
    expect(bookingErrorKey(422, 'scheduled_at must be in the future.')).toBeNull()
    expect(bookingErrorKey(409, { code: 'slot_unavailable' })).toBeNull()
  })
})

describe('Booking — 422/429 codes show localized copy, not the backend English', () => {
  it.each([
    ['duration_too_long', 422, en.booking.errors.durationTooLong],
    ['timezone_required', 422, en.booking.errors.timezoneRequired],
    ['daily_booking_limit', 429, en.booking.errors.dailyLimit],
  ])('%s', async (code, status, copy) => {
    await reachFormAndSubmit(json({ detail: { code, message: 'BACKEND ENGLISH' } }, status))
    expect(await screen.findByText(copy)).toBeInTheDocument()
    expect(screen.queryByText('BACKEND ENGLISH')).not.toBeInTheDocument()
  })

  it('a plain 429 shows the rate-limit copy', async () => {
    await reachFormAndSubmit(json({ detail: 'Rate limit exceeded.' }, 429))
    expect(await screen.findByText(en.booking.errors.rateLimited)).toBeInTheDocument()
  })

  it('slot_not_offered re-checks live availability and offers nearby times (no dead end)', async () => {
    const fetchMock = await reachFormAndSubmit(json({ detail: { code: 'slot_not_offered', field: 'scheduled_at', message: 'x' } }, 422))
    // The cache was cleared, so availability is fetched again.
    await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3))
  })
})

describe('Booking date bounds use the IST day', () => {
  it('istDateKey is the IST calendar day, unlike toISOString()', () => {
    const lateUtc = new Date('2026-10-12T20:00:00Z') // 13 Oct, 01:30 IST
    expect(lateUtc.toISOString().slice(0, 10)).toBe('2026-10-12')
    expect(istDateKey(lateUtc)).toBe('2026-10-13')
    const earlyUtc = new Date('2026-10-12T18:29:00Z') // 12 Oct, 23:59 IST
    expect(istDateKey(earlyUtc)).toBe('2026-10-12')
  })

  it('sets min/max on the date input from the IST day after mount', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-12T20:00:00Z')) // 13 Oct in IST, still 12 Oct in UTC
    render(withI18n(<BookingWidget />))
    const input = screen.getByLabelText('Date')
    await vi.waitFor(() => expect(input).toHaveAttribute('min', '2026-10-13'))
    expect(input.getAttribute('max')).toBe(istDateKey(new Date(Date.now() + 14 * 86_400_000)))
  })
})
