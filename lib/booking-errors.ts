// BE-1 §4 error codes for POST /public/booking and GET /availability. The
// backend's English `message` is never shown for these: each code has a
// localized sentence in messages/*.json (booking.errors).
export type BookingErrorKey = 'timezoneRequired' | 'slotNotOffered' | 'durationTooLong' | 'dailyLimit' | 'rateLimited'

const CODE_TO_KEY: Record<string, BookingErrorKey> = {
  timezone_required: 'timezoneRequired',
  slot_not_offered: 'slotNotOffered',
  duration_too_long: 'durationTooLong',
  daily_booking_limit: 'dailyLimit',
}

export function bookingErrorKey(status: number, detail: unknown): BookingErrorKey | null {
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const code = (detail as { code?: unknown }).code
    if (typeof code === 'string' && code in CODE_TO_KEY) return CODE_TO_KEY[code]
  }
  // A plain-string 429 is the per-IP limit, or the same email within 60 s.
  if (status === 429) return 'rateLimited'
  return null
}
