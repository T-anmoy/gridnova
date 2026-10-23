'use client'

import { useEffect, useState } from 'react'

// An Associate's referral link is /estimate?ref=<Associate ID>
// (docs/api/associate_ease.md §1). The ID is kept for the rest of the visit
// (sessionStorage) so a visitor who moves on to Book-a-Call still carries it.
// The backend silently ignores an unknown or malformed ref; here an obviously
// bad one is simply dropped. Neither ever blocks or changes the form.

export const REFERRAL_STORAGE_KEY = 'gn-referral-ref'
const MAX_REF_LENGTH = 64 // the backend ignores anything longer
const REF_SHAPE = /^[A-Za-z0-9][A-Za-z0-9 -]*$/

/** A ref worth forwarding, trimmed — or null. */
export function cleanRef(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v.length > 0 && v.length <= MAX_REF_LENGTH && REF_SHAPE.test(v) ? v : null
}

function readStored(): string | null {
  try {
    return cleanRef(window.sessionStorage.getItem(REFERRAL_STORAGE_KEY))
  } catch {
    return null
  }
}

function store(ref: string): void {
  try {
    window.sessionStorage.setItem(REFERRAL_STORAGE_KEY, ref)
  } catch {
    // Storage blocked: the ref still applies to this page.
  }
}

/** The ref from the URL (remembered for the visit), else one remembered earlier in the visit. */
export function captureReferral(search: string): string | null {
  const fromUrl = cleanRef(new URLSearchParams(search).get('ref'))
  if (fromUrl) {
    store(fromUrl)
    return fromUrl
  }
  return readStored()
}

/** Client-only: null on the server render and until mounted. */
export function useReferral(): string | null {
  const [ref, setRef] = useState<string | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL and sessionStorage are only readable after mount
    setRef(captureReferral(window.location.search))
  }, [])
  return ref
}

/** The two optional request fields: `ref` whenever there is one, the consent only when ticked. */
export function referralFields(ref: string | null, consent: boolean): { ref?: string; share_with_referrer?: true } {
  if (!ref) return {}
  return consent ? { ref, share_with_referrer: true } : { ref }
}
