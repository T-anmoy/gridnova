'use client'

import { useCallback, useEffect } from 'react'

export const LEAVE_PROMPT = 'You have unsaved changes on this proposal. Leave without saving them?'

/**
 * While `dirty`: the browser asks before a reload / tab close, and an in-app
 * link click (sidebar, breadcrumbs) asks before navigating. Returns a
 * `confirmLeave()` for buttons that navigate in code (Back, version history).
 */
export function useUnsavedGuard(dirty: boolean): () => boolean {
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const href = a.getAttribute('href') ?? ''
      if (href.startsWith('#') || href.startsWith('blob:') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (!window.confirm(LEAVE_PROMPT)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])

  return useCallback(() => !dirty || window.confirm(LEAVE_PROMPT), [dirty])
}
