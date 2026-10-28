'use client'

import { useState } from 'react'
import { Check, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { studioApi, useStudioToken } from '@/lib/studio/api'
import { fieldLabel, studioError } from '@/lib/studio/logic'
import type { AssistantSuggestion } from '@/lib/studio/types'
import { INPUT, Notice } from './ui'

// "Fill from a message" — only when GET /studio/options reports the assistant enabled. It
// suggests customer, site and connection details from pasted text; nothing is saved until the
// person accepts a suggestion (which then saves like any other change they make).

export function AssistantBox({
  proposalId,
  sections,
  onAccept,
}: {
  proposalId: number
  /** The sections this step edits; other suggestions are listed on their own steps. */
  sections: AssistantSuggestion['section'][]
  onAccept: (s: AssistantSuggestion) => void
}) {
  const token = useStudioToken()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[] | null>(null)

  async function ask() {
    setBusy(true)
    setError(null)
    try {
      const res = await studioApi.suggest(token, proposalId, text)
      setSuggestions(res.suggestions)
    } catch (e) {
      setError(studioError(e).message)
    } finally {
      setBusy(false)
    }
  }

  const shown = (suggestions ?? []).filter((s) => sections.includes(s.section))
  const drop = (s: AssistantSuggestion) => setSuggestions((x) => (x ?? []).filter((y) => y !== s))

  return (
    <div className="rounded-xl border border-dashed border-[#2f5daa]/40 bg-[#2f5daa]/[0.03] p-3" data-testid="assistant-box">
      {!open ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Sparkles className="mr-1.5 h-4 w-4 text-[#f7a800]" /> Fill from a message
        </Button>
      ) : (
        <div className="space-y-2">
          <label htmlFor="assistant-text" className="block font-utility text-sm font-medium text-[#091c3c]">
            Paste the customer’s message or your notes
          </label>
          <textarea id="assistant-text" className={INPUT} rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. “Ramesh Das, 98300 12345, 12 Lake Road Habra, WBSEDCL consumer 1234567, 2 kW sanctioned”" />
          <p className="font-utility text-xs text-[#111827]/60">Suggestions only — check each one. Nothing is saved until you accept it. Prices and materials are never suggested.</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void ask()} disabled={busy || !text.trim()}>
              {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Suggest
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setOpen(false); setSuggestions(null) }}>
              Close
            </Button>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {suggestions && shown.length === 0 && <p className="font-utility text-sm text-[#111827]/60">No suggestions for this step.</p>}
          {shown.length > 0 && (
            <ul className="space-y-2" data-testid="assistant-suggestions">
              {shown.map((s, i) => (
                <li key={`${s.section}.${s.field}.${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e4e8ee] bg-white p-2">
                  <span className="min-w-0 flex-1 font-utility text-sm">
                    <span className="text-[#111827]/60">{fieldLabel(`${s.section}.${s.field}`)}:</span>{' '}
                    <strong className="text-[#091c3c]">{Array.isArray(s.value) ? s.value.join(', ') : String(s.value)}</strong>
                    <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] uppercase text-amber-800">check</span>
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={() => { onAccept(s); drop(s) }}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Accept
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => drop(s)}>
                    <X className="mr-1 h-3.5 w-3.5" /> Ignore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
