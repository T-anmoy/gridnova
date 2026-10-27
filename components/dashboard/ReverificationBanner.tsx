'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useClearReverification } from '@/lib/dashboard/survey-review-api-client'
import { fieldList, surveyReviewError } from '@/lib/dashboard/survey-review-ui'
import { formatDatetime } from '@/lib/dashboard/utils'
import type { ReverificationReason } from '@/lib/dashboard/survey-review-types'
import { usePermissions } from '@/lib/access/use-permissions'

const SOURCE: Record<string, string> = {
  correction: 'an applied survey correction',
  revisit: 'an edit made after a revisit request',
  edit: 'an edit to the survey',
}

/**
 * Shown on a proposal flagged by a survey change. It explains what changed and
 * why sending is blocked; holders of proposals.clear_reverification can clear the flag
 * with a note (the server refuses the person who applied the correction).
 */
export function ReverificationBanner({ proposalId, reason }: { proposalId: number; reason: ReverificationReason | null | undefined }) {
  const { can } = usePermissions()
  const clear = useClearReverification()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fields = fieldList(reason?.fields)

  async function confirm() {
    if (!note.trim()) {
      setNoteError('A note is required to clear re-verification.')
      return
    }
    setError(null)
    try {
      await clear.mutateAsync({ proposalId, note })
      toast.success('Re-verification cleared')
      setOpen(false)
      setNote('')
    } catch (err) {
      setError(surveyReviewError(err))
    }
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4" role="alert" data-testid="reverification-banner">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-amber-900">This proposal needs to be re-verified</p>
          <p className="text-sm text-amber-800">
            The site survey changed{fields ? <> — <span data-testid="reverification-fields">{fields}</span></> : ''}
            {reason ? <> (from {SOURCE[reason.source] ?? 'a survey change'}{reason.at ? `, ${formatDatetime(reason.at)}` : ''})</> : ''}. Check the size and price still fit, then clear this before it is sent or accepted.
          </p>
          {can('proposals.clear_reverification') && (
            <Button size="sm" variant="outline" className="mt-1 min-h-[44px] border-amber-400 bg-white" onClick={() => { setOpen(true); setError(null); setNoteError(null) }}>
              Clear re-verification
            </Button>
          )}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear re-verification?</DialogTitle>
            <DialogDescription>Confirm you have checked the proposal against the changed survey. This is recorded with your note.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reverify-note">Note (required)</Label>
            <Textarea
              id="reverify-note"
              rows={3}
              maxLength={2000}
              value={note}
              className="text-base md:text-sm"
              aria-invalid={noteError ? true : undefined}
              aria-describedby={noteError ? 'reverify-note-error' : undefined}
              onChange={(e) => { setNote(e.target.value); setNoteError(null) }}
            />
            {noteError && <p id="reverify-note-error" className="text-xs text-red-600">{noteError}</p>}
          </div>
          <div aria-live="polite">{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700" data-testid="clear-error">{error}</p>}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={clear.isPending} onClick={() => void confirm()}>{clear.isPending ? 'Clearing…' : 'Clear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
