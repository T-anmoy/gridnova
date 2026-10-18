'use client'

// Which record the staff member is looking at, and whether the Ask Nova panel is open.
// Pages register their record with `useNovaPageContext`; the panel (and nothing else)
// sends it with the question, so "this project" means the page's project.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isEmptyContext } from '@/lib/nova/logic'
import type { NovaContext } from '@/lib/nova/schemas'

interface NovaShellState {
  context: NovaContext | null
  setContext: (ctx: NovaContext | null) => void
  panelOpen: boolean
  /** A question typed elsewhere (the command palette) that the chat puts in its box. */
  draft: string
  openPanel: (draft?: string) => void
  closePanel: () => void
}

const noop = () => undefined
const FALLBACK: NovaShellState = {
  context: null,
  setContext: noop,
  panelOpen: false,
  draft: '',
  openPanel: noop,
  closePanel: noop,
}

const NovaShellContext = createContext<NovaShellState>(FALLBACK)

export function NovaShellProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<NovaContext | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const openPanel = useCallback((d?: string) => {
    setDraft(d ?? '')
    setPanelOpen(true)
  }, [])
  const closePanel = useCallback(() => {
    setPanelOpen(false)
    setDraft('')
  }, [])
  const value = useMemo(
    () => ({ context, setContext, panelOpen, draft, openPanel, closePanel }),
    [context, panelOpen, draft, openPanel, closePanel],
  )
  return <NovaShellContext.Provider value={value}>{children}</NovaShellContext.Provider>
}

export function useNovaShell(): NovaShellState {
  return useContext(NovaShellContext)
}

/**
 * Call from a lead / project page with the record it shows. The context is cleared when the
 * page unmounts, so it never follows the user to another page. Outside the dashboard shell
 * this does nothing.
 */
export function useNovaPageContext(ctx: NovaContext | null): void {
  const { setContext } = useNovaShell()
  const key = isEmptyContext(ctx) ? '' : JSON.stringify(ctx)
  useEffect(() => {
    setContext(key ? (JSON.parse(key) as NovaContext) : null)
    return () => setContext(null)
  }, [key, setContext])
}
