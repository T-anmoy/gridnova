import { describe, it, expect } from 'vitest'
import en from '@/messages/en.json'
import { ApiError } from '@/lib/dashboard/api-error'
import {
  accuracyBand,
  bestPhotoCandidate,
  buildLocationInput,
  describeSiteLocationError,
  roundedCoordinates,
} from '@/lib/associate/site-location'
import { buildUploadForm } from '@/lib/associate/onboarding-api-client'
import type { SiteLocationOptions } from '@/lib/associate/onboarding-types'

const errors = en.siteLocation.errors
const OPTIONS: SiteLocationOptions = {
  accuracy_good_m: 20,
  accuracy_warn_m: 50,
  accuracy_reject_m: 200,
  sample_seconds: 10,
  required_to_submit: true,
  sources: ['device_gps', 'photo_gps', 'google_maps_link', 'pasted_coordinates'],
  recommended_source: 'photo_gps',
}

describe('buildLocationInput — one field, routed by shape', () => {
  it('sends a link as google_maps_link', () => {
    expect(buildLocationInput('https://maps.app.goo.gl/abc123')).toEqual({ source: 'google_maps_link', link: 'https://maps.app.goo.gl/abc123' })
  })
  it('pulls the link out of a WhatsApp-style message', () => {
    expect(buildLocationInput('My location: https://maps.google.com/?q=22.57,88.36 thanks')).toEqual({
      source: 'google_maps_link',
      link: 'https://maps.google.com/?q=22.57,88.36',
    })
  })
  it('adds https:// to a pasted link that lost its scheme', () => {
    expect(buildLocationInput('maps.app.goo.gl/xyz')).toEqual({ source: 'google_maps_link', link: 'https://maps.app.goo.gl/xyz' })
  })
  it('sends numbers as pasted_coordinates', () => {
    expect(buildLocationInput(' 22.5726, 88.3639 ')).toEqual({ source: 'pasted_coordinates', text: '22.5726, 88.3639' })
  })
  it('returns null for an empty field', () => {
    expect(buildLocationInput('   ')).toBeNull()
  })
  it('respects the contract length limits (link 500, text 100)', () => {
    const link = buildLocationInput(`https://maps.app.goo.gl/${'a'.repeat(600)}`)
    expect(link && link.source === 'google_maps_link' && link.link.length).toBe(500)
    const text = buildLocationInput('1'.repeat(300))
    expect(text && text.source === 'pasted_coordinates' && text.text.length).toBe(100)
  })
})

describe('describeSiteLocationError — every contract code has its own sentence', () => {
  const err = (status: number, detail: Record<string, unknown>) => new ApiError(status, `API error ${status}`, String(detail.message ?? ''), detail)

  const cases: [string, ApiError][] = [
    ['outside_india', err(422, { code: 'outside_india' })],
    ['outside_india_swapped', err(422, { code: 'outside_india', likely_swapped: true })],
    ['invalid_coordinates', err(422, { code: 'invalid_coordinates' })],
    ['accuracy_too_low', err(422, { code: 'accuracy_too_low' })],
    ['no_gps_on_photo_no_photo', err(422, { code: 'no_gps_on_photo', reason: 'no_photo' })],
    ['no_gps_on_photo_not_camera', err(422, { code: 'no_gps_on_photo', reason: 'not_camera' })],
    ['no_gps_on_photo_no_gps', err(422, { code: 'no_gps_on_photo', reason: 'no_gps' })],
    ['unknown_photo_slot', err(422, { code: 'unknown_photo_slot' })],
    ['site_location_not_set', err(409, { code: 'site_location_not_set' })],
    ['not_editable', err(409, { code: 'not_editable' })],
    ['no_coordinates_in_link', err(422, { code: 'no_coordinates_in_link' })],
    ['link_rate_limited', err(429, { code: 'link_rate_limited' })],
    ...(['empty', 'too_long', 'malformed', 'scheme', 'userinfo', 'port', 'host_not_allowed'] as const).map(
      (r): [string, ApiError] => [`invalid_link_${r}`, err(422, { code: 'invalid_link', reason: r })]
    ),
    ...(['timeout', 'network', 'dns', 'blocked_address', 'too_many_redirects'] as const).map(
      (r): [string, ApiError] => [r === 'timeout' || r === 'network' ? `link_unresolvable_${r}` : 'link_unresolvable', err(422, { code: 'link_unresolvable', reason: r })]
    ),
  ]

  it.each(cases)('%s → its own message', (key, e) => {
    const { text } = describeSiteLocationError(e, errors)
    expect(text).toBe((errors as Record<string, string>)[key])
    expect(text).not.toBe(errors.generic)
    expect(text).not.toMatch(/^[a-z_.]+$/) // never a raw key
  })

  it('a bare 429 is the rate-limit message even without a structured body', () => {
    expect(describeSiteLocationError(new ApiError(429, 'API error 429'), errors).text).toBe(errors.link_rate_limited)
  })
  it('a network failure (status 0) says to retry online', () => {
    expect(describeSiteLocationError(new ApiError(0, 'Network request failed'), errors).text).toBe(errors.offline)
  })
  it('an unknown code falls back to a generic sentence, never the server text', () => {
    const { text } = describeSiteLocationError(err(422, { code: 'brand_new', message: 'Point 22.5,88.4 is odd' }), errors)
    expect(text).toBe(errors.generic)
    expect(text).not.toContain('22.5')
  })
})

describe('accuracyBand — thresholds come from /options', () => {
  it.each([
    [12, 'good'],
    [20, 'good'],
    [35, 'fair'],
    [50, 'poor'],
    [120, 'poor'],
    [200, 'poor'],
    [201, 'rejected'],
  ])('%s m → %s', (m, band) => expect(accuracyBand(m, OPTIONS)).toBe(band))
  it('moves with different thresholds', () => {
    expect(accuracyBand(35, { ...OPTIONS, accuracy_good_m: 40 })).toBe('good')
  })
})

describe('bestPhotoCandidate', () => {
  const cam = (slot: string, accuracy_m: number | null, over = {}) => ({ slot, capture_method: 'camera', latitude: 22.5, longitude: 88.3, accuracy_m, ...over })
  it('picks the camera photo with the best accuracy', () => {
    expect(bestPhotoCandidate([cam('a', 30), cam('b', 8), cam('c', 15)])).toEqual({ slot: 'b', accuracy_m: 8 })
  })
  it('ignores gallery photos and photos without a location', () => {
    expect(bestPhotoCandidate([cam('a', 5, { capture_method: 'gallery' }), cam('b', 5, { latitude: null })])).toBeNull()
  })
  it('ranks a photo with unknown accuracy last but still offers it when it is the only one', () => {
    expect(bestPhotoCandidate([cam('a', null), cam('b', 40)])).toEqual({ slot: 'b', accuracy_m: 40 })
    expect(bestPhotoCandidate([cam('a', null)])).toEqual({ slot: 'a', accuracy_m: null })
  })
  it('is null with no photos', () => expect(bestPhotoCandidate([])).toBeNull())
})

describe('misc', () => {
  it('rounds coordinates for display', () => expect(roundedCoordinates(22.572646, 88.363895)).toBe('22.5726, 88.3639'))
  it('camera photos carry accuracy_m in the upload form (documents never need it)', () => {
    const f = new File(['x'], 'p.jpg', { type: 'image/jpeg' })
    const form = buildUploadForm({ file: f, kind: 'photo', photo_slot: 'front', capture_method: 'camera', latitude: 22.5, longitude: 88.3, accuracy_m: 12.5 })
    expect(form.get('accuracy_m')).toBe('12.5')
    expect(buildUploadForm({ file: f, kind: 'photo', accuracy_m: 0 }).has('accuracy_m')).toBe(false)
  })
})
