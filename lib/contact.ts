// Grid Nova's one public helpline — the single source for every tel: and
// wa.me link in the app. Message files and policy text still spell the number
// out in their own sentences; change those too if it ever changes.

/** As shown to people: "+91 98747 74440". */
export const HELPLINE_DISPLAY = '+91 98747 74440'

/** E.164 for tel: links. */
export const HELPLINE_E164 = '+919874774440'

export const HELPLINE_TEL = `tel:${HELPLINE_E164}`

/** schema.org `telephone` form. */
export const HELPLINE_SCHEMA = '+91-9874774440'

/** wa.me wants the number with country code and no "+". */
const HELPLINE_WA = HELPLINE_E164.slice(1)

/** A WhatsApp chat link, optionally with prefilled text. */
export function whatsappUrl(text?: string, number: string = HELPLINE_WA): string {
  return text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`
}

/** WhatsApp's "share to a chat of your choice" link for `text`. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** The helpline's plain WhatsApp link. */
export const HELPLINE_WHATSAPP = whatsappUrl()

/**
 * An Indian mobile as typed by a person ("98300 12345", "+91-9830012345",
 * "09830012345") → the wa.me number "919830012345", or null when it is not a
 * 10-digit Indian mobile.
 */
export function indianWhatsappNumber(mobile: string | null | undefined): string | null {
  if (!mobile) return null
  const digits = mobile.replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, '')
  return /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : null
}
