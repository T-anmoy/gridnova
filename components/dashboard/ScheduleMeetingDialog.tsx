'use client'

import { useState } from 'react'
import { CalendarPlus, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useScheduleMeeting } from '@/lib/dashboard/staff-leads-api-client'
import {
  DURATION_MAX, DURATION_MIN, buildScheduleMeetingBody, formatMeetingTimeIst, mapScheduleMeetingError, safeMeetLink,
} from '@/lib/dashboard/staff-leads-logic'
import { fmt, type StaffLeadsCopy } from '@/lib/dashboard/staff-leads-copy'
import type { ScheduleMeetingResponse } from '@/lib/dashboard/staff-leads-types'

/** Admin / Sales action. The picker is wall-clock India time; an offset is always added before sending. */
export function ScheduleMeetingDialog({ leadId, copy }: { leadId: number; copy: StaffLeadsCopy }) {
  const c = copy.meeting
  const [open, setOpen] = useState(false)
  const [when, setWhen] = useState('')
  const [duration, setDuration] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [serverText, setServerText] = useState<string | undefined>()
  const [result, setResult] = useState<ScheduleMeetingResponse | null>(null)
  const mutation = useScheduleMeeting()

  function reset() {
    setWhen('')
    setDuration('')
    setFormError(null)
    setServerText(undefined)
    setResult(null)
  }

  async function submit() {
    setFormError(null)
    setServerText(undefined)
    const built = buildScheduleMeetingBody(when, duration)
    if (!built.ok) {
      setFormError(c.errors[built.error])
      return
    }
    try {
      setResult(await mutation.mutateAsync({ leadId, body: built.body }))
    } catch (err) {
      const mapped = mapScheduleMeetingError(err)
      setFormError(c.errors[mapped.key])
      setServerText(mapped.serverText)
    }
  }

  const link = result ? safeMeetLink(result.meet_link) : null

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="min-h-11 gap-1.5" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" aria-hidden="true" /> {c.action}
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{c.title}</DialogTitle>
            <DialogDescription>{fmt(c.description, { leadId })}</DialogDescription>
          </DialogHeader>

          {result ? (
            <div role="status" aria-live="polite" className="space-y-3">
              <p className="font-utility text-sm font-semibold text-[#091c3c]">{c.successTitle}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-utility text-sm text-[#111827]">
                <dt className="text-[#111827]/65">{c.when}</dt>
                <dd>{formatMeetingTimeIst(result.scheduled_at)} IST</dd>
                <dt className="text-[#111827]/65">{c.duration}</dt>
                <dd>{fmt(c.durationValue, { minutes: result.duration_minutes })}</dd>
                <dt className="text-[#111827]/65">{c.status}</dt>
                <dd>{c.statuses[result.status] ?? result.status}</dd>
              </dl>
              {link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 font-utility text-sm font-medium text-[#0e2a63] underline"
                >
                  {c.joinLink} <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : (
                <p className="font-utility text-xs text-[#111827]/65">{c.noLink}</p>
              )}
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); void submit() }}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="meeting-when">{c.whenLabel}</Label>
                <Input
                  id="meeting-when"
                  type="datetime-local"
                  className="min-h-11"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  aria-describedby="meeting-when-help"
                  required
                />
                <p id="meeting-when-help" className="font-utility text-xs text-[#111827]/65">{c.whenHelp}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meeting-duration">{c.durationLabel}</Label>
                <Input
                  id="meeting-duration"
                  type="number"
                  inputMode="numeric"
                  min={DURATION_MIN}
                  max={DURATION_MAX}
                  step={1}
                  className="min-h-11"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  aria-describedby="meeting-duration-help"
                />
                <p id="meeting-duration-help" className="font-utility text-xs text-[#111827]/65">{c.durationHelp}</p>
              </div>
              <div role="alert" aria-live="polite">
                {formError && (
                  <p className="font-utility text-sm text-red-700">
                    {formError}
                    {serverText && <span className="mt-1 block text-xs">{serverText}</span>}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>{copy.common.cancel}</Button>
                <Button type="submit" className="min-h-11" disabled={mutation.isPending}>
                  {mutation.isPending ? c.submitting : c.submit}
                </Button>
              </DialogFooter>
            </form>
          )}
          {result && (
            <DialogFooter>
              <Button type="button" className="min-h-11" onClick={() => setOpen(false)}>{copy.common.close}</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
