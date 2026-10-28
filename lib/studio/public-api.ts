// The Studio's public routes (proposal_studio.md §11): the customer's online proposal page
// and the verification a printed QR opens. No sign-in. Called from the browser — never from
// the server — so the view is recorded with the customer's own IP and browser, and a link
// preview fetched by a chat app (which runs no JavaScript) is not counted as a view.

import { publicFetch } from '@/lib/api/http'
import { API_BASE_URL } from '@/lib/config'
import type { ProposalVerification, PublicProposal } from './types'

const enc = encodeURIComponent

export const publicProposalPath = (token: string) => `/api/v1/public/studio/${enc(token)}`
export const verifyPath = (code: string) => `/api/v1/public/proposals/verify/${enc(code)}`

export function fetchPublicProposal(token: string, signal?: AbortSignal): Promise<PublicProposal> {
  return publicFetch<PublicProposal>(publicProposalPath(token), { signal, cache: 'no-store' })
}

/** The PDF link: the API answers 302 to a short-lived signed link (and records a download). */
export function publicPdfUrl(view: Pick<PublicProposal, 'pdf_path'>, token: string): string {
  const path = view.pdf_path?.startsWith('/api/') ? view.pdf_path : `${publicProposalPath(token)}/pdf`
  return `${API_BASE_URL}${path}`
}

export function acceptPublicProposal(token: string, body: { full_name: string; mobile_last4: string; accept_terms: true }) {
  return publicFetch<{ status: 'accepted'; accepted_at: string; already_accepted: boolean }>(`${publicProposalPath(token)}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function declinePublicProposal(token: string, reason: string | null) {
  return publicFetch<{ status: 'declined'; already_declined: boolean }>(`${publicProposalPath(token)}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || null }),
  })
}

export function fetchVerification(code: string, signal?: AbortSignal): Promise<ProposalVerification> {
  return publicFetch<ProposalVerification>(verifyPath(code), { signal, cache: 'no-store' })
}
