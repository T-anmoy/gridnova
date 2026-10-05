'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

/**
 * Confirmation dialog with a note/reason box. When `required`, confirm stays
 * disabled until the text is non-blank (dishonour, cancel, reject, admin
 * override, mode switch); otherwise the note is optional (verify).
 * `onConfirm` throws to keep the dialog open — the caller maps the error to a
 * sentence, which is shown inside the dialog.
 */
export default function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  required,
  confirmLabel,
  destructive,
  onConfirm,
  describeError,
  confirmDisabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  label: string
  required?: boolean
  confirmLabel: string
  destructive?: boolean
  onConfirm: (text: string) => Promise<unknown>
  describeError: (err: unknown) => string
  // Lets the caller block confirmation outright (e.g. a conflict only someone else can resolve).
  confirmDisabled?: boolean
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(text.trim())
      setText('')
      onOpenChange(false)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setError(null)
          setText('')
        }
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div>
          <label htmlFor="reason-dialog-text" className="mb-1.5 block text-sm font-medium text-gray-700">
            {label}
            {required ? ' *' : ''}
          </label>
          <Textarea id="reason-dialog-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} disabled={busy || confirmDisabled || (!!required && !text.trim())} onClick={() => void confirm()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
