import { useEffect, useRef } from 'react'
import { clearAutosaveDraft, readDraft, writeDraft } from './useAutosaveDraft'

// Typed-in serial rows survive a discarded tab: on phones the browser often
// kills a backgrounded tab without `beforeunload`, so the rows are written
// (debounced) to this device as they are typed, restored with a notice, and
// cleared once the server has saved them. Same 24 h TTL as every draft.

export const SERIAL_DRAFT_DEBOUNCE_MS = 600

/** Key prefix of the staff register panel's drafts; wiped on staff sign-out. */
export const STAFF_REGISTER_DRAFT_PREFIX = 'gna-register-staff-'

/** The stored rows for `key` (rebuilt with `fromStored`), or null when there is no fresh draft. */
export function readSerialDraft<R>(key: string, fromStored: (stored: Record<string, unknown>) => R): R[] | null {
  if (typeof window === 'undefined') return null
  const stored = readDraft(key)
  const list = Array.isArray(stored?.rows) ? (stored.rows as Record<string, unknown>[]) : []
  return list.length ? list.map(fromStored) : null
}

/** Writes the dirty rows (debounced) on every change; an all-clean table removes the draft. */
export function useSerialDraftWriter<R>(
  key: string,
  rows: R[],
  { isDirty, toStored }: { isDirty: (row: R) => boolean; toStored: (row: R) => Record<string, unknown> }
) {
  const latest = useRef({ isDirty, toStored })
  useEffect(() => {
    latest.current = { isDirty, toStored }
  })
  useEffect(() => {
    const timer = setTimeout(() => {
      const dirty = rows.filter(latest.current.isDirty)
      if (dirty.length === 0) clearAutosaveDraft(key)
      else writeDraft(key, { rows: dirty.map(latest.current.toStored) })
    }, SERIAL_DRAFT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [key, rows])
}
