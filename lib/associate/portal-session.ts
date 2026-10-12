import { useAuth } from '@clerk/nextjs'
import { clearDraftsWithPrefix } from './useAutosaveDraft'
import { purgeExpiredPendingPhotos, purgePendingPhotos } from './photo-queue'

// Associates share phones. Everything this portal keeps on the device (form
// drafts, queued photos, the last-used territory) is scoped to the signed-in
// Clerk user and cleared on sign-out.

export const ONBOARDING_DRAFT_PREFIX = 'gna-onboarding-'
export const REGISTER_DRAFT_PREFIX = 'gna-register-'
export const APPLY_DRAFT_PREFIX = 'gna-apply-'
export const LAST_TERRITORY_KEY = 'gna-last-territory'

/** The signed-in Clerk user id (null when signed out), and whether Clerk has loaded. */
export function useDraftUserId(): { userId: string | null; ready: boolean } {
  const { userId, isLoaded } = useAuth()
  return { userId: userId ?? null, ready: isLoaded !== false }
}

export const onboardingDraftKey = (userId: string | null, onboardingId: number | 'new') =>
  `${ONBOARDING_DRAFT_PREFIX}${userId ?? 'anon'}-${onboardingId}`

export const registerDraftKey = (userId: string | null, onboardingId: number) =>
  `${REGISTER_DRAFT_PREFIX}${userId ?? 'anon'}-${onboardingId}`

export const applyDraftKey = (kind: string, userId: string | null) =>
  userId ? `${APPLY_DRAFT_PREFIX}${kind}-${userId}` : `${APPLY_DRAFT_PREFIX}${kind}`

/** Wipes this portal's drafts, queued photos and remembered territory from the device. */
export async function clearPortalDeviceData(): Promise<void> {
  clearDraftsWithPrefix([ONBOARDING_DRAFT_PREFIX, REGISTER_DRAFT_PREFIX, APPLY_DRAFT_PREFIX])
  try {
    window.sessionStorage.removeItem(LAST_TERRITORY_KEY)
  } catch {
    /* ignore */
  }
  await purgePendingPhotos()
}

/** Housekeeping on portal load: drop queued photos past their TTL. */
export function purgeStaleDeviceData(): void {
  void purgeExpiredPendingPhotos()
}
