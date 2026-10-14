'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReflectLead } from '@/lib/dashboard/staff-leads-api-client'
import { mapReflectError, reflectOutcome } from '@/lib/dashboard/staff-leads-logic'
import { fmt, type StaffLeadsCopy } from '@/lib/dashboard/staff-leads-copy'

/** POST /leads/{id}/reflect — synchronous, so the button is disabled while it runs. */
export function ReflectButton({ leadId, copy }: { leadId: number; copy: StaffLeadsCopy }) {
  const c = copy.reflect
  const mutation = useReflectLead()
  const [message, setMessage] = useState<{ tone: 'ok' | 'neutral' | 'error'; text: string } | null>(null)

  async function run() {
    if (mutation.isPending) return
    setMessage(null)
    try {
      const outcome = reflectOutcome(await mutation.mutateAsync(leadId))
      if (outcome.kind === 'written') {
        setMessage({ tone: 'ok', text: outcome.count === 1 ? c.writtenOne : fmt(c.written, { count: outcome.count }) })
      } else {
        // Soft failure for "error: …": the server's text can carry internals, so only the translated line is shown.
        const reason = c.skipped[outcome.reason]
        const text = outcome.reason === 'other' && outcome.text ? `${c.skippedPrefix} ${reason} ${outcome.text}` : `${c.skippedPrefix} ${reason}`
        setMessage({ tone: outcome.reason === 'error' ? 'error' : 'neutral', text })
      }
    } catch (err) {
      setMessage({ tone: 'error', text: c.errors[mapReflectError(err).key] })
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" className="min-h-11 gap-1.5" disabled={mutation.isPending} aria-busy={mutation.isPending} onClick={() => void run()}>
        <Sparkles className="h-4 w-4" aria-hidden="true" /> {mutation.isPending ? c.running : c.action}
      </Button>
      <p
        role="status"
        aria-live="polite"
        className={`max-w-xs font-utility text-xs [overflow-wrap:anywhere] ${message?.tone === 'error' ? 'text-red-700' : 'text-[#111827]/75'}`}
      >
        {message?.text}
      </p>
    </div>
  )
}
