'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { studioApi, studioKeys, useStudioToken } from './api'
import { studioError } from './logic'
import type { SectionEditResponse, StudioView } from './types'

// The wizard saves every field as it is typed: each change replaces the section's local
// draft, and a short pause later the section is sent with PATCH …/document. Saves run one at
// a time (each needs the revision the previous one produced). A `stale_version` answer means
// someone else saved in between: the latest version is loaded, local drafts are dropped and
// the person is told.

export const AUTOSAVE_DELAY_MS = 700

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'reloaded'

export interface SaveOutcome {
  section: string
  regenerated: string[]
  approvalCleared: boolean
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function serverSection(view: StudioView | undefined, section: string): unknown {
  return view ? (view.document as unknown as Record<string, unknown>)[section] : undefined
}

export function useStudioAutosave(proposalId: number, view: StudioView | undefined) {
  const qc = useQueryClient()
  const token = useStudioToken()
  const tokenRef = useRef(token)
  const viewRef = useRef(view)
  // Drafts live in a ref (read by the async save loop) mirrored into state (read by render).
  const drafts = useRef<Record<string, unknown>>({})
  const [draftState, setDraftState] = useState<Record<string, unknown>>({})
  const [reloadCount, setReloadCount] = useState(0)
  const pending = useRef<Set<string>>(new Set())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const running = useRef<Promise<void> | null>(null)
  const [state, setState] = useState<SaveState>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    viewRef.current = view
    tokenRef.current = token
  })

  const sync = () => setDraftState({ ...drafts.current })

  const run = useCallback((): Promise<void> => {
    if (running.current) return running.current
    const work = (async () => {
      while (pending.current.size) {
        const section = pending.current.values().next().value as string
        pending.current.delete(section)
        if (!(section in drafts.current) || !viewRef.current) continue
        const snapshot = drafts.current[section]
        setState('saving')
        try {
          const res: SectionEditResponse = await studioApi.editSection(() => tokenRef.current(), proposalId, {
            base_revision: viewRef.current.revision,
            section,
            value: snapshot,
          })
          viewRef.current = res
          qc.setQueryData(studioKeys.proposal(proposalId), res)
          // The draft goes once the server holds exactly it (a value the server tidied, e.g. a
          // trimmed space, stays local so the cursor never jumps while typing).
          if (drafts.current[section] === snapshot && same(serverSection(res, section), snapshot)) {
            drafts.current = Object.fromEntries(Object.entries(drafts.current).filter(([k]) => k !== section))
          }
          setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== section && !k.startsWith(`${section}.`) && !k.startsWith(`${section}[`))))
          setOutcome({ section, regenerated: res.regenerated_sections ?? [], approvalCleared: !!res.approval_cleared })
          setSavedAt(Date.now())
          setState(pending.current.size ? 'saving' : 'saved')
          void qc.invalidateQueries({ queryKey: ['studio', 'proposals'] })
        } catch (err) {
          const info = studioError(err)
          if (info.code === 'stale_version') {
            drafts.current = {}
            pending.current.clear()
            for (const t of timers.current.values()) clearTimeout(t)
            timers.current.clear()
            setErrors({})
            await qc.invalidateQueries({ queryKey: studioKeys.proposal(proposalId) })
            setState('reloaded')
            setReloadCount((n) => n + 1)
            toast.warning(info.message)
            sync()
            break
          }
          // Shown beside the field the server names, or at the top of the section.
          setErrors((e) => ({ ...e, [info.field ?? section]: info.message }))
          setState('error')
        }
        sync()
      }
    })()
    running.current = work.finally(() => {
      running.current = null
    })
    return running.current
  }, [proposalId, qc])

  const schedule = useCallback(
    (section: string, delay: number) => {
      const old = timers.current.get(section)
      if (old) clearTimeout(old)
      timers.current.set(
        section,
        setTimeout(() => {
          timers.current.delete(section)
          pending.current.add(section)
          void run()
        }, delay),
      )
    },
    [run],
  )

  /** Replace a section's value locally and save it after a short pause (or at once). */
  const edit = useCallback(
    (section: string, value: unknown, opts: { immediate?: boolean } = {}) => {
      drafts.current = { ...drafts.current, [section]: value }
      setState((s) => (s === 'reloaded' || s === 'error' ? 'idle' : s))
      sync()
      schedule(section, opts.immediate ? 0 : AUTOSAVE_DELAY_MS)
    },
    [schedule],
  )

  /** The value to show: the unsaved draft if there is one, else the server's. */
  const value = useCallback(<T,>(section: string, server: T): T => (section in draftState ? (draftState[section] as T) : server), [draftState])

  /** Save everything waiting now (before moving on, issuing or leaving). Resolves when done. */
  const flush = useCallback(async () => {
    for (const [section, t] of timers.current) {
      clearTimeout(t)
      pending.current.add(section)
    }
    timers.current.clear()
    await run()
    if (pending.current.size) await run()
  }, [run])

  const dirty = Object.keys(draftState).some((s) => !same(serverSection(view, s), draftState[s])) || state === 'saving'

  // Leaving with a save waiting: the browser asks first.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  useEffect(() => {
    const t = timers.current
    return () => {
      for (const x of t.values()) clearTimeout(x)
    }
  }, [])

  /** Errors for one field path, or for its whole section. */
  const errorFor = useCallback((field: string) => errors[field] ?? null, [errors])

  return { edit, value, flush, state, errors, errorFor, outcome, savedAt, dirty, reloadCount, clearOutcome: () => setOutcome(null) }
}

export type StudioAutosave = ReturnType<typeof useStudioAutosave>
