import { ApiError } from '@/lib/dashboard/api-error'
import type { OnboardingFile, SetSiteLocationInput, SiteLocationOptions } from './onboarding-types'

// ── Link vs coordinates ───────────────────────────────────────────────────
// One paste field. A message copied from WhatsApp may wrap the link in words,
// so the first URL in the text is the link; text with no URL but a Google
// host (no scheme) is a link too; everything else is coordinates text.

const URL_RE = /https?:\/\/[^\s<>"']+/i
const SCHEMELESS_HOST_RE = /\b((?:maps\.app\.goo\.gl|goo\.gl|(?:www\.|maps\.)?google\.[a-z.]+)\/[^\s<>"']+)/i

export function buildLocationInput(raw: string): SetSiteLocationInput | null {
  const text = raw.trim()
  if (!text) return null
  const url = text.match(URL_RE)?.[0]
  if (url) return { source: 'google_maps_link', link: url.slice(0, 500) }
  const bare = text.match(SCHEMELESS_HOST_RE)?.[1]
  if (bare) return { source: 'google_maps_link', link: `https://${bare}`.slice(0, 500) }
  return { source: 'pasted_coordinates', text: text.slice(0, 100) }
}

// ── Accuracy bands ────────────────────────────────────────────────────────
// Thresholds always come from GET /options; the server still enforces them.

export type AccuracyBand = 'good' | 'fair' | 'poor' | 'rejected'

export function accuracyBand(accuracyM: number, o: SiteLocationOptions): AccuracyBand {
  if (accuracyM > o.accuracy_reject_m) return 'rejected'
  if (accuracyM >= o.accuracy_warn_m) return 'poor'
  if (accuracyM > o.accuracy_good_m) return 'fair'
  return 'good'
}

// ── Best camera photo with a location ─────────────────────────────────────

export interface PhotoLocationCandidate {
  slot: string
  accuracy_m: number | null
}

/**
 * The slot whose camera photo has the best (lowest) accuracy. Only camera
 * photos with a stored location count; a photo with no accuracy ranks last.
 */
export function bestPhotoCandidate(
  photos: { slot: string; capture_method?: string | null; latitude?: number | null; longitude?: number | null; accuracy_m?: number | null }[]
): PhotoLocationCandidate | null {
  let best: PhotoLocationCandidate | null = null
  for (const p of photos) {
    if (p.capture_method !== 'camera' || p.latitude == null || p.longitude == null) continue
    const acc = typeof p.accuracy_m === 'number' && p.accuracy_m > 0 ? p.accuracy_m : null
    if (!best || (acc !== null && (best.accuracy_m === null || acc < best.accuracy_m))) best = { slot: p.slot, accuracy_m: acc }
  }
  return best
}

export function serverPhotoCandidates(photos: OnboardingFile[]) {
  return photos.filter((p) => !!p.photo_slot).map((p) => ({ slot: p.photo_slot as string, ...p }))
}

// ── Errors ────────────────────────────────────────────────────────────────

export type SiteLocationErrorCopy = Record<string, string>

/**
 * A plain sentence (and what to do) for every error the contract defines.
 * Unknown codes fall back to the generic line — never a raw code or the
 * server's English text, which could contain a coordinate.
 */
export function describeSiteLocationError(err: unknown, errors: SiteLocationErrorCopy): { text: string; code: string } {
  if (!(err instanceof ApiError)) return { text: errors.generic, code: 'generic' }
  const d = err.structuredDetail
  const code = typeof d?.code === 'string' ? d.code : ''
  if (err.status === 429 || code === 'link_rate_limited') return { text: errors.link_rate_limited, code: 'link_rate_limited' }
  if (err.status === 0) return { text: errors.offline, code: 'offline' }
  if (code === 'outside_india' && d?.likely_swapped === true) return { text: errors.outside_india_swapped, code }
  if (code === 'no_gps_on_photo') {
    const reason = typeof d?.reason === 'string' ? d.reason : ''
    return { text: errors[`no_gps_on_photo_${reason}`] ?? errors.no_gps_on_photo, code }
  }
  if (code === 'invalid_link' || code === 'link_unresolvable') {
    const reason = typeof d?.reason === 'string' ? d.reason : ''
    return { text: errors[`${code}_${reason}`] ?? errors[code], code }
  }
  if (code && errors[code]) return { text: errors[code], code }
  return { text: errors.generic, code: code || 'generic' }
}

/** True when a failure is the network's fault and the same request may be retried later. */
export function isOfflineError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0
}

const R = 4
/** Rounded for display only (about 10 m); the unrounded value is never shown. */
export function roundedCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(R)}, ${lon.toFixed(R)}`
}
