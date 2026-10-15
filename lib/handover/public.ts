import { API_BASE_URL } from '@/lib/config'
import { publicHandoverSchema, publicRequestsSchema, type PublicHandover, type ServiceRequest } from './schemas'

// The customer's tokenised handover page (BE-5): `/api/v1/public/handover/{token}`. No sign-in; the
// token in the URL is the whole credential and the backend answers 404 for an unknown, revoked,
// expired or malformed one. Nothing here reads anything but what the token grants.

export const publicHandoverPath = (token: string) => `/api/v1/public/handover/${encodeURIComponent(token)}`
export const publicPdfHref = (token: string) => `${API_BASE_URL}${publicHandoverPath(token)}/pdf`

export type PublicScreen = 'ready' | 'notfound' | 'ratelimited' | 'error'
export interface LoadedHandover {
  screen: PublicScreen
  view: PublicHandover | null
}

/** Server-side fetch of the page. Never cached: a revoked link must stop working at once. */
export async function loadPublicHandover(token: string): Promise<LoadedHandover> {
  try {
    const res = await fetch(`${API_BASE_URL}${publicHandoverPath(token)}`, { cache: 'no-store', headers: { Accept: 'application/json' } })
    if (res.status === 404) return { screen: 'notfound', view: null }
    if (res.status === 429) return { screen: 'ratelimited', view: null }
    if (!res.ok) return { screen: 'error', view: null }
    const parsed = publicHandoverSchema.safeParse(await res.json().catch(() => null))
    // A body that does not match is an honest error, never a half-filled page.
    return parsed.success ? { screen: 'ready', view: parsed.data } : { screen: 'error', view: null }
  } catch {
    return { screen: 'error', view: null }
  }
}

/** The category keys the form offers: the API's list when it sends one, else the contract's five. */
export function categoryKeys(view: PublicHandover): string[] {
  const list = view.service.categories
  if (!list || list.length === 0) return ['no_generation', 'inverter_error', 'physical_damage', 'cleaning_om', 'other']
  return list.map((c) => (typeof c === 'string' ? c : c.key))
}

/** The customer's own requests, fetched on the server with the page. Null when they cannot be read (the page says so). */
export async function loadPublicRequests(token: string): Promise<ServiceRequest[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${publicHandoverPath(token)}/service-requests`, { cache: 'no-store', headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const parsed = publicRequestsSchema.safeParse(await res.json().catch(() => null))
    return parsed.success ? parsed.data.items : null
  } catch {
    return null
  }
}
