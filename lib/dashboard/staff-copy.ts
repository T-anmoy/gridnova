// The staff dashboard is English-only, but it reuses components built for the
// associate portal (photo/proof upload, payment forms). Those take their
// strings from the English messages, so they read the same words everywhere.
//
// The strings come from a small GENERATED subset of messages/en.json
// (scripts/extract-staff-copy.mjs → staff-copy.generated.json), not from en.json
// itself: importing en.json here would put every marketing page's copy
// (~140 KB) into the dashboard's client bundle. A unit test keeps the subset in
// sync; run `npm run staff-copy` after editing the source messages.
import copy from './staff-copy.generated.json'

export const STAFF_SHARED_MESSAGES = {
  photoSlot: copy.photoSlot,
  portalErrors: copy.portalErrors,
  siteLocation: copy.siteLocation,
  pricing: copy.pricing,
}
export const STAFF_PAYMENT_COPY = copy.payments
export const STAFF_EXECUTION_COPY = copy.execution
export const STAFF_PHOTOS_COPY = copy.photos
export const STAFF_SITE_LOCATION_COPY = copy.siteLocation
