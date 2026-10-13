'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * List filters, tabs and the page number live in the URL so a filtered view
 * can be bookmarked, shared, reloaded and reached with the back button.
 * `set` merges the given keys into the current query (an empty/undefined value
 * removes the key) and resets `page` unless the update names it.
 *
 * The calling component must sit under a <Suspense> boundary
 * (useSearchParams opts the subtree out of static prerendering otherwise).
 */
export function useUrlParams() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const page = Math.max(1, Number(sp.get('page')) || 1)

  function get(key: string): string {
    return sp.get(key) ?? ''
  }

  function has(key: string): boolean {
    return sp.has(key)
  }

  function set(updates: Record<string, string | undefined>) {
    const q = new URLSearchParams(sp.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) q.set(key, value)
      else q.delete(key)
    }
    if (!('page' in updates)) q.delete('page')
    if (q.get('page') === '1') q.delete('page')
    const qs = q.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function setPage(next: number) {
    set({ page: next > 1 ? String(next) : undefined })
  }

  return { get, has, set, page, setPage }
}
