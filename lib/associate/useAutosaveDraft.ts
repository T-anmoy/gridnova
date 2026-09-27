import { useEffect, useState } from 'react'

// Persists the wizard's plain-text field values (never files — File objects
// aren't structured-cloneable into localStorage, and re-selecting a document
// after a lost connection is a reasonable ask) to this device only, so a
// closed tab or dropped connection doesn't lose a half-filled application.
// True only when the saved draft has at least one non-blank string value —
// the write effect below persists the form on every mount (including the
// very first one, before the visitor has typed anything), so a draft's mere
// *existence* in storage doesn't mean there's anything worth restoring.
function hasMeaningfulContent(draft: Record<string, unknown>): boolean {
  return Object.values(draft).some((v) => typeof v === 'string' && v.trim() !== '')
}

export function useAutosaveDraft<T extends object>(
  key: string,
  initial: T
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  // Computed exactly once, synchronously, before this instance's own write
  // effect (below) has ever run — so it reflects a genuinely pre-existing
  // draft, never one this same mount just wrote.
  const [{ value: restoredValue, hadDraft }] = useState(() => {
    if (typeof window === 'undefined') return { value: initial, hadDraft: false }
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return { value: initial, hadDraft: false }
      const parsed = JSON.parse(raw) as Partial<T>
      return { value: { ...initial, ...parsed }, hadDraft: hasMeaningfulContent(parsed as Record<string, unknown>) }
    } catch {
      return { value: initial, hadDraft: false }
    }
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

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable (private mode, quota) — the form still works, it just won't survive a reload */
    }
  }, [key, value])

  return [value, setValue, restored]
}

export function clearAutosaveDraft(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
