'use client'

import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { approveError, approvalStateOf, shortHash } from '@/lib/dashboard/placeholders'
import type { ApproveWordingInput, PlaceholderItem } from '@/lib/dashboard/placeholders-api-client'
import { formatDatetime } from '@/lib/dashboard/utils'

/** An approved text, read-only: what the documents print now. */
export function ReadWordingDialog({ item, onClose }: { item: PlaceholderItem | null; onClose: () => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? `${item.id} — ${item.description}` : 'Wording'}</DialogTitle>
          <DialogDescription>
            {item && approvalStateOf(item) === 'approved' && item.approval
              ? `Approved by ${item.approval.by} on ${formatDatetime(item.approval.at)}. Documents print this text exactly as shown.`
              : 'Not approved yet: documents that print this text are held until an Admin approves it.'}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 font-utility text-sm leading-relaxed text-gray-900" data-testid="wording-text" tabIndex={0} aria-label="The approved text">
          {item?.current_text}
        </div>
        <p className="text-xs text-gray-500">{item?.location} · fingerprint <code>{shortHash(item?.current_sha256)}</code></p>
        <DialogFooter>
          <Button variant="outline" className="h-11 sm:h-9" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * BE-22: an Admin reads one drafted text in full and approves it exactly as written. The
 * approval is bound to the hash of the text shown here (`current_sha256`), so a text edited
 * meanwhile is refused (409 text_changed) and the fresh text appears for another read.
 * `item` is looked up from the latest list on every render, which is what makes that work.
 */
export default function ApproveWordingDialog({
  item,
  onOpenChange,
  onApprove,
}: {
  item: PlaceholderItem | null
  onOpenChange: (open: boolean) => void
  onApprove: (input: ApproveWordingInput) => Promise<unknown>
}) {
  const id = useId()
  const [legal, setLegal] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setLegal(false)
    setNote('')
    setError(null)
    onOpenChange(false)
  }

  const legalRequired = item?.legal_review_required === true
  const canSubmit = !!item?.current_text && !!item.current_sha256 && (!legalRequired || legal) && !busy

  async function approve() {
    if (!item?.current_sha256) return
    setBusy(true)
    setError(null)
    try {
      await onApprove({ id: item.id, content_sha256: item.current_sha256, note: note.trim() || undefined, legal_review_confirmed: legalRequired && legal })
      close()
    } catch (err) {
      setError(approveError(err))
    } finally {
      setBusy(false)
    }
  }

  const lapsed = item && approvalStateOf(item) === 'lapsed' ? item.approval : null

  return (
    <Dialog open={!!item} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? `Approve ${item.id} — ${item.description}` : 'Approve wording'}</DialogTitle>
          <DialogDescription>
            Read the whole text. Once approved it is used exactly as written on every document that prints it. If anyone edits it later, the approval lapses and those documents are held again.
          </DialogDescription>
        </DialogHeader>

        {lapsed && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="lapsed-note">
            {lapsed.by} approved an earlier version on {formatDatetime(lapsed.at)}. The text has changed since, so it needs approving again.
          </p>
        )}

        <div
          className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 font-utility text-sm leading-relaxed text-gray-900"
          data-testid="wording-text"
          tabIndex={0}
          aria-label="The text to approve"
        >
          {item?.current_text ?? 'The text could not be loaded.'}
        </div>
        <p className="text-xs text-gray-500">
          {item?.location} · fingerprint <code>{shortHash(item?.current_sha256)}</code>
        </p>

        {legalRequired && (
          <label className="flex items-start gap-2 text-sm text-gray-900">
            <input type="checkbox" checked={legal} onChange={(e) => setLegal(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#0e2a63]" data-testid="legal-tick" />
            <span>This text has been reviewed by Grid Nova’s legal adviser.</span>
          </label>
        )}

        <div className="space-y-1">
          <Label htmlFor={`${id}-note`} className="text-xs">Note (optional)</Label>
          <Textarea id={`${id}-note`} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="For example: read with the owner on 2 November" />
        </div>

        <p role="alert" className={error ? 'text-sm text-red-600' : 'sr-only'}>{error}</p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="h-11 sm:h-9" onClick={close} disabled={busy}>Cancel</Button>
          <Button className="h-11 sm:h-9" disabled={!canSubmit} onClick={() => void approve()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Approve this text
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
