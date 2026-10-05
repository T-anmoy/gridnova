// The staff dashboard is English-only, but it reuses components built for the
// associate portal (photo/proof upload, payment forms). Those take their
// strings from the English message file, so they read the same words everywhere.
import en from '@/messages/en.json'

export const STAFF_SHARED_MESSAGES = { photoSlot: en.photoSlot, portalErrors: en.portalErrors, siteLocation: en.siteLocation }
export const STAFF_PAYMENT_COPY = en.associates.portal.payments
export const STAFF_EXECUTION_COPY = en.associates.portal.execution
export const STAFF_PHOTOS_COPY = en.associates.portal.wizard.photos
