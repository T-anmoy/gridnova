import { useEffect, useState } from 'react'

// Persists a form's plain-text field values (never files — File objects
// aren't structured-cloneable into localStorage, and re-selecting a document
// after a lost connection is a reasonable ask) to this device only, so a
// closed tab or dropped connection doesn't lose a half-filled form.
//
// Associates share low-end phones, so a draft is never kept for long and never
// holds identity or bank data:
// - `exclude` fields are never written to storage (they restore as `initial`);
// - a draft older than `ttlMs` (default 24 h) is purged when it is read;
// - drafts written before this format (no timestamp) are purged unread.

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

interface StoredDraft {
  savedAt: number
  value: Record<string, unknown>
}

export interface AutosaveOptions<T> {
  exclude?: readonly (keyof T)[]
  ttlMs?: number
}

// True only when the saved draft has at least one non-blank string value —
// the write effect below persists the form on every mount (including the
// very first one, before the visitor has typed anything), so a draft's mere
// *existence* in storage doesn't mean there's anything worth restoring.
function hasMeaningfulContent(draft: Record<string, unknown>): boolean {
  return Object.values(draft).some((v) => typeof v === 'string' && v.trim() !== '')
}

function withoutExcluded<T extends object>(value: T, exclude: readonly (keyof T)[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) }
  for (const k of exclude ?? []) delete out[k as string]
  return out
}

/** The stored draft for `key`, or null when absent, expired or in an old format (those are removed). */
export function readDraft(key: string, ttlMs: number = DRAFT_TTL_MS, now: number = Date.now()): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredDraft> | null
    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.value || typeof parsed.value !== 'object' || now - parsed.savedAt > ttlMs) {
      window.localStorage.removeItem(key)
      return null
    }
    return parsed.value
  } catch {
    return null
  }
}

export function writeDraft(key: string, value: Record<string, unknown>, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: now, value } satisfies StoredDraft))
  } catch {
    /* storage unavailable (private mode, quota) — the form still works, it just won't survive a reload */
  }
}

export function useAutosaveDraft<T extends object>(
  key: string,
  initial: T,
  options: AutosaveOptions<T> = {}
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const { exclude, ttlMs = DRAFT_TTL_MS } = options
  // Computed exactly once, synchronously, before this instance's own write
  // effect (below) has ever run — so it reflects a genuinely pre-existing
  // draft, never one this same mount just wrote.
  const [{ value: restoredValue, hadDraft }] = useState(() => {
    if (typeof window === 'undefined') return { value: initial, hadDraft: false }
    const stored = readDraft(key, ttlMs)
    if (!stored) return { value: initial, hadDraft: false }
    // Even if an older build stored an excluded field, it is never restored.
    const safe = withoutExcluded(stored as T, exclude)
    return { value: { ...initial, ...safe } as T, hadDraft: hasMeaningfulContent(safe) }
  })

  // Starts false on both server and the first client render (so the
  // "restored" banner's presence in the DOM matches on hydration), then
  // flips true post-mount — the standard fix for a client-only signal that
  // must never differ between SSR and first paint.
  const [restored, setRestored] = useState(false)
  useEffect(() => {
    if (hadDraft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount reveal of a value already computed synchronously above; setting it any earlier would mismatch the server render
      setRestored(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount only, matching the "restored" flag's one-time hydration-safe reveal
  }, [])

  const [value, setValue] = useState<T>(restoredValue)

  // `exclude` is a stable list in practice; its contents (not identity) matter.
  const excludeKey = (exclude ?? []).join('|')
  useEffect(() => {
    writeDraft(key, withoutExcluded(value, exclude))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `exclude` is tracked by its contents via excludeKey
  }, [key, value, excludeKey])

  return [value, setValue, restored]
}

export function clearAutosaveDraft(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** Removes every stored draft whose key starts with one of `prefixes` (used on sign-out). */
export function clearDraftsWithPrefix(prefixes: readonly string[]): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && prefixes.some((p) => k.startsWith(p))) keys.push(k)
    }
    keys.forEach((k) => window.localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}
