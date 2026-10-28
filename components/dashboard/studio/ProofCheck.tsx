'use client'

import { AlertTriangle, CheckCircle2, CircleAlert, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { groupChecks, stepOfField, WIZARD_STEPS } from '@/lib/studio/logic'
import type { StudioView } from '@/lib/studio/types'

// The proof-check as the API reports it: errors in red (each links to its field), warnings in
// amber (each needs "I have checked this"; a spelling warning can instead ignore the word for
// this proposal). Nothing here decides — the server re-checks on submit and issue.

const stepTitle = (field: string | null) => WIZARD_STEPS.find((s) => s.id === stepOfField(field))?.title ?? 'Review'

export function ProofCheck({
  view,
  editable,
  busy,
  onGoTo,
  onAcknowledge,
  onIgnoreWord,
}: {
  view: StudioView
  editable: boolean
  busy: string | null
  onGoTo: (field: string) => void
  onAcknowledge: (fingerprints: string[]) => void
  onIgnoreWord: (word: string) => void
}) {
  const { errors, warnings, allClear } = groupChecks(view)
  const open = warnings.filter((w) => !w.acknowledged)

  return (
    <section aria-labelledby="proof-check-title" className="rounded-xl border border-[#e4e8ee] bg-white p-4" data-testid="proof-check">
      <h2 id="proof-check-title" className="font-display text-base font-semibold text-[#091c3c]">
        Proof-check
      </h2>
      <p className="mt-0.5 font-utility text-xs text-[#111827]/60">Run on every save, and again on the final PDF when it is issued.</p>

      {allClear && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 p-3 font-utility text-sm font-medium text-green-800" data-testid="proof-all-clear">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Everything checks out.
        </p>
      )}

      {errors.length > 0 && (
        <div className="mt-3">
          <h3 className="font-utility text-sm font-semibold text-red-800">
            {errors.length} to fix before it can go out
          </h3>
          <ul className="mt-2 space-y-2" data-testid="proof-errors">
            {errors.map((c) => (
              <li key={c.fingerprint} className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-utility text-sm text-red-900">{c.message}</p>
                  {c.field && (
                    <button type="button" onClick={() => onGoTo(c.field!)} className="mt-1 inline-flex min-h-11 items-center font-utility text-xs font-semibold text-red-800 underline underline-offset-2 md:min-h-0">
                      Fix it in “{stepTitle(c.field)}”
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-utility text-sm font-semibold text-amber-900">
              {open.length ? `${open.length} to check` : 'Warnings — all checked'}
            </h3>
            {editable && open.length > 1 && (
              <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => onAcknowledge(open.filter((w) => w.id !== 'spelling').map((w) => w.fingerprint))}>
                I have checked all of these
              </Button>
            )}
          </div>
          <ul className="mt-2 space-y-2" data-testid="proof-warnings">
            {warnings.map((w) => (
              <li key={w.fingerprint} className={`flex items-start gap-2 rounded-lg border p-3 ${w.acknowledged ? 'border-[#e4e8ee] bg-[#f7f9fc]' : 'border-amber-200 bg-amber-50'}`} data-acknowledged={w.acknowledged}>
                {w.acknowledged ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <p className={`font-utility text-sm ${w.acknowledged ? 'text-[#111827]/70' : 'text-amber-950'}`}>{w.message}</p>
                  {w.acknowledged ? (
                    <p className="mt-0.5 font-utility text-xs text-green-800">Checked</p>
                  ) : (
                    editable && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => onAcknowledge([w.fingerprint])} data-testid={`ack-${w.id}`}>
                          {busy === w.fingerprint ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}I have checked this
                        </Button>
                        {w.id === 'spelling' && w.word && (
                          <Button type="button" size="sm" variant="ghost" disabled={!!busy} onClick={() => onIgnoreWord(w.word!)} data-testid={`ignore-${w.word}`}>
                            Ignore “{w.word}” on this proposal
                          </Button>
                        )}
                        {w.field && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => onGoTo(w.field!)}>
                            Change it
                          </Button>
                        )}
                      </div>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
