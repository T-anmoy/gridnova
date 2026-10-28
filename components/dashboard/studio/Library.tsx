'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { FilePlus2, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { cn } from '@/lib/dashboard/utils'
import { usePermissions } from '@/lib/access/use-permissions'
import { studioApi, useLibrary, useStudioOptions, useStudioToken } from '@/lib/studio/api'
import { studioError } from '@/lib/studio/logic'
import type { BoqRow } from '@/lib/proposals/document-types'
import type { LibraryItem, LibraryKind } from '@/lib/studio/types'
import { INPUT, Notice, SelectInput, TextArea, TextInput } from './ui'

// Ready-made pieces for proposals: special notes, customer-scope sentences, sets of BOQ rows
// and whole templates (saved from a proposal with "Save as template"). Never deleted —
// deactivated items disappear from the pickers and can be switched back on.

const KINDS: { id: LibraryKind; label: string; hint: string }[] = [
  { id: 'note', label: 'Special notes', hint: 'Sentences printed under “Special Notes”.' },
  { id: 'customer_scope_item', label: 'Customer scope', hint: 'What the customer provides — one sentence each.' },
  { id: 'boq_preset', label: 'Material rows', hint: 'Sets of bill-of-quantity rows to add in one go.' },
  { id: 'template', label: 'Templates', hint: 'Whole proposals without the customer — start a new proposal from one.' },
]

interface Draft {
  id: number | null
  kind: LibraryKind
  name: string
  project_type: string
  text: string
  rows: BoqRow[]
}

const emptyDraft = (kind: LibraryKind): Draft => ({ id: null, kind, name: '', project_type: '', text: '', rows: [{ description: '', quantity: '', standard: null, make: 'Equivalent', kind: null }] })

export default function Library() {
  const { can } = usePermissions()
  const manage = can('studio.library.manage')
  const qc = useQueryClient()
  const token = useStudioToken()
  const options = useStudioOptions()
  const [kind, setKind] = useState<LibraryKind>('note')
  const [retired, setRetired] = useState(false)
  const list = useLibrary(kind, retired)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const typeLabel = (id: string | null) => (id ? options.data?.project_types.find((t) => t.id === id)?.label ?? id : 'Every project type')

  const refresh = () => void qc.invalidateQueries({ queryKey: ['studio', 'library'] })

  async function save() {
    if (!draft) return
    setBusy(true)
    setError(null)
    const body: Record<string, unknown> = draft.kind === 'boq_preset' ? { rows: draft.rows } : { text: draft.text }
    try {
      if (draft.id == null) {
        await studioApi.createLibraryItem(token, { kind: draft.kind, name: draft.name.trim(), project_type: draft.project_type || null, body })
      } else {
        await studioApi.updateLibraryItem(token, draft.id, draft.kind === 'template' ? { name: draft.name.trim() } : { name: draft.name.trim(), body })
      }
      refresh()
      setDraft(null)
      toast.success('Saved to the Library.')
    } catch (e) {
      setError(studioError(e).message)
    } finally {
      setBusy(false)
    }
  }

  async function setActive(item: LibraryItem, active: boolean) {
    try {
      await studioApi.updateLibraryItem(token, item.id, { active })
      refresh()
      toast.success(active ? 'Switched back on.' : 'Deactivated — it no longer appears in the pickers.')
    } catch (e) {
      toast.error(studioError(e).message)
    }
  }

  const k = KINDS.find((x) => x.id === kind)!

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">Library</h1>
          <p className="mt-1 font-utility text-sm text-[#111827]/65">Ready-made wording and materials, so every proposal reads the same.</p>
        </div>
        {manage && kind !== 'template' && (
          <Button type="button" className="min-h-11" onClick={() => { setError(null); setDraft(emptyDraft(kind)) }} data-testid="library-add">
            <Plus className="mr-1.5 h-4 w-4" /> Add to {k.label.toLowerCase()}
          </Button>
        )}
      </div>

      <div role="tablist" aria-label="Kind" className="flex flex-wrap gap-1 rounded-xl border border-[#e4e8ee] bg-white p-1">
        {KINDS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={kind === x.id} onClick={() => setKind(x.id)} data-testid={`library-tab-${x.id}`}
            className={cn('min-h-11 flex-1 whitespace-nowrap rounded-lg px-3 font-utility text-sm', kind === x.id ? 'bg-[#091c3c] text-white' : 'text-[#091c3c] hover:bg-[#f7f9fc]')}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-utility text-sm text-[#111827]/65">{k.hint}{kind === 'template' && ' To make one, open a proposal and use “Save as template”.'}</p>
        <label className="inline-flex min-h-11 items-center gap-2 font-utility text-sm">
          <input type="checkbox" className="h-4 w-4" checked={retired} onChange={(e) => setRetired(e.target.checked)} /> Show deactivated
        </label>
      </div>

      {list.error ? (
        <DashboardError error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <Skeleton className="h-40 w-full" />
      ) : list.data.items.length === 0 ? (
        <p className="rounded-xl border border-[#e4e8ee] bg-white p-6 text-center font-utility text-sm text-[#111827]/65">Nothing here yet.</p>
      ) : (
        <ul className="space-y-2" data-testid="library-list">
          {list.data.items.map((item) => (
            <li key={item.id} className={cn('rounded-xl border border-[#e4e8ee] bg-white p-4', !item.active && 'opacity-60')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-utility text-sm font-semibold text-[#091c3c]">{item.name}{!item.active && <span className="ml-2 rounded bg-gray-100 px-1.5 text-xs font-normal text-gray-700">Deactivated</span>}</p>
                  <p className="font-utility text-xs text-[#111827]/55">{typeLabel(item.project_type)}</p>
                  {item.body.text && <p className="mt-1 font-utility text-sm text-[#111827]/80">{item.body.text}</p>}
                  {item.body.rows && <p className="mt-1 font-utility text-sm text-[#111827]/80">{item.body.rows.map((r) => r.description).join(' · ')}</p>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {kind === 'template' && item.active && can('studio.edit') && (
                    <Link href={`/dashboard/studio/new?template=${item.id}`} className="inline-flex min-h-11 items-center gap-1 rounded-md bg-[#f7a800] px-3 font-utility text-xs font-semibold text-[#091c3c] md:min-h-8" data-testid="from-template">
                      <FilePlus2 className="h-3.5 w-3.5" /> New proposal from this
                    </Link>
                  )}
                  {manage && (
                    <>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setError(null); setDraft({ id: item.id, kind: item.kind, name: item.name, project_type: item.project_type ?? '', text: item.body.text ?? '', rows: (item.body.rows as BoqRow[]) ?? [] }) }}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> {kind === 'template' ? 'Rename' : 'Edit'}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => void setActive(item, !item.active)} data-testid={`library-toggle-${item.id}`}>
                        {item.active ? 'Deactivate' : 'Switch back on'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id == null ? `Add to ${k.label.toLowerCase()}` : 'Edit'}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <TextInput field="library.name" label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} maxLength={120} hint="Only you and your colleagues see it — e.g. “Net metering by customer”" />
              {draft.id == null && (
                <SelectInput field="library.project_type" label="For" value={draft.project_type} emptyLabel="Every project type" options={(options.data?.project_types ?? []).map((t) => ({ value: t.id, label: t.label }))} onChange={(v) => setDraft({ ...draft, project_type: v })} />
              )}
              {(draft.kind === 'note' || draft.kind === 'customer_scope_item') && (
                <TextArea field="library.text" label="Wording" value={draft.text} onChange={(v) => setDraft({ ...draft, text: v })} maxLength={400} hint="Exactly as it should print, one sentence." />
              )}
              {draft.kind === 'boq_preset' && (
                <fieldset className="space-y-2">
                  <legend className="font-utility text-sm font-medium text-[#091c3c]">Rows</legend>
                  {draft.rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[1fr_6rem_auto] gap-2">
                      <input aria-label={`Row ${i + 1} description`} className={INPUT} value={r.description} placeholder="What it is" onChange={(e) => setDraft({ ...draft, rows: draft.rows.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
                      <input aria-label={`Row ${i + 1} quantity`} className={INPUT} value={r.quantity} placeholder="Qty" onChange={(e) => setDraft({ ...draft, rows: draft.rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)) })} />
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove row ${i + 1}`} onClick={() => setDraft({ ...draft, rows: draft.rows.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, rows: [...draft.rows, { description: '', quantity: '', standard: null, make: 'Equivalent', kind: null }] })}><Plus className="mr-1 h-3.5 w-3.5" /> Add a row</Button>
                  <p className="font-utility text-xs text-[#111827]/60">Makes start as “Equivalent”; pick the make in each proposal.</p>
                </fieldset>
              )}
              {error && <Notice tone="error">{error}</Notice>}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button type="button" disabled={busy || !draft || draft.name.trim().length < 2} onClick={() => void save()} data-testid="library-save">
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
