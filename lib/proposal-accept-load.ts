import { API_BASE_URL } from '@/lib/config'
import {
  acceptApiPath,
  normalizeAcceptResponse,
  screenForAcceptError,
  screenForView,
  validateAcceptResponse,
  type AcceptScreen,
  type AcceptView,
} from '@/lib/proposal-accept'

export type LoadedProposal = { screen: AcceptScreen; view: AcceptView | null }

/** Server-side fetch of the accept-link summary. Never cached. */
export async function loadProposal(token: string): Promise<LoadedProposal> {
  try {
    const res = await fetch(`${API_BASE_URL}${acceptApiPath(token)}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    const body: unknown = await res.json().catch(() => null)
    if (!res.ok) return { screen: screenForAcceptError(res.status, body), view: null }
    const view = normalizeAcceptResponse(validateAcceptResponse(body))
    return { screen: screenForView(view), view }
  } catch {
    // Backend unreachable or an unreadable body: an honest error with a retry.
    return { screen: 'error', view: null }
  }
}

