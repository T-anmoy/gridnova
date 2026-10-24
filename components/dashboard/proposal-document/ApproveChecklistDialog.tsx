'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, FileText, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatInr } from '@/lib/money'
import { PRICE_MODE_LABEL } from '@/lib/proposals/document-logic'
import type { DocumentView } from '@/lib/proposals/document-types'
import { focusField } from './panels'

/** The checks before Approve / Manager sign-off, all from the document the backend returned. */
export function ApproveChecklistDialog({
  view,
  managerSignoff,
  onConfirm,
  loading,
  children,
}: {
  view: DocumentView
  managerSignoff: boolean
  onConfirm: () => void
  loading?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const missing = view.missing_required ?? []
  const figures = view.figures
  const ready = missing.length === 0

  const goTo = (field: string) => {
    setOpen(false)
    // After the dialog has closed and released focus.
    setTimeout(() => focusField(field), 50)
  }
  const goToPreview = () => {
    setOpen(false)
    setTimeout(() => document.querySelector('[data-testid="proposal-preview"]')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 50)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{managerSignoff ? 'Manager sign-off' : 'Approve proposal'}</DialogTitle>
          <DialogDescription>Check these before the proposal is approved. Approval locks it and allocates its reference and date.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3" data-testid="approve-checklist">
          <li className="flex items-start gap-2">
            {ready ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" aria-hidden="true" /> : <XCircle className="mt-0.5 h-4 w-4 text-red-600" aria-hidden="true" />}
            <div className="font-utility text-sm">
              <p className="font-medium">{ready ? 'All required details are filled in' : 'Required details are missing'}</p>
              {!ready && (
                <ul className="mt-1 space-y-0.5">
                  {missing.map((m) => (
                    <li key={m.field}>
                      <button type="button" className="text-left text-[#0e2a63] underline underline-offset-2" onClick={() => goTo(m.field)}>
                        {m.message.charAt(0).toUpperCase() + m.message.slice(1)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-[#0e2a63]" aria-hidden="true" />
            <p className="font-utility text-sm">
              <span className="font-medium">Approval tier:</span> {managerSignoff ? 'manager sign-off (Admin or Management)' : 'standard approval (Admin or Sales)'}
            </p>
          </li>
          <li className="flex items-start gap-2">
            <Circle className="mt-0.5 h-4 w-4 text-[#0e2a63]" aria-hidden="true" />
            <p className="font-utility text-sm">
              <span className="font-medium">Price:</span> {PRICE_MODE_LABEL[figures?.price_mode ?? 'none'] ?? figures?.price_mode}
              {figures?.total && <> — {formatInr(figures.total)} incl. GST</>}
            </p>
          </li>
          <li className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 text-[#0e2a63]" aria-hidden="true" />
            <div className="font-utility text-sm">
              <p>
                <span className="font-medium">Final check:</span> read the preview — after approval it is exactly what the customer receives.
              </p>
              <button type="button" className="text-[#0e2a63] underline underline-offset-2" onClick={goToPreview}>
                Go to the preview
              </button>
            </div>
          </li>
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm()
              setOpen(false)
            }}
            disabled={!ready || loading}
          >
            {loading ? 'Processing...' : managerSignoff ? 'Sign off' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
