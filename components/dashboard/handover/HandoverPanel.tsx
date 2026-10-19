'use client'

import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Circle, Loader2 } from 'lucide-react'
import SignaturePad, { type SignaturePadHandle } from '@/components/associate/SignaturePad'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import HandoverDelivery from '@/components/dashboard/handover/HandoverDelivery'
import ReasonDialog from '@/components/dashboard/ReasonDialog'
import { ApiError } from '@/lib/dashboard/api-error'
import { formatDatetime } from '@/lib/dashboard/utils'
import { PACK_ITEM_LABEL, handoverErrorMessage } from '@/lib/handover/labels'
import type { Pack, PackItem } from '@/lib/handover/schemas'
import { useAcknowledge, useHandoverPack, useTickOmContact, useTickOrientation } from '@/lib/handover/staff-api-client'

const SIGNATURE_MAX_BYTES = 512 * 1024

// Where each record-backed item gets done — it cannot be ticked here.
const RECORD_HINT: Record<string, string> = {
  commissioning_report: 'Comes from the commissioning stage on the Installation tab.',
  net_meter_report: 'Comes from the net-meter inspection stage on the Installation tab.',
  register_verified: 'Comes from the serial register being verified on the Installation tab.',
  final_payment: 'Comes from verified customer payments in Accounts.',
}

function AcknowledgeDialog({ open, onOpenChange, onboardingId }: { open: boolean; onOpenChange: (o: boolean) => void; onboardingId: number }) {
  const ack = useAcknowledge(onboardingId)
  const id = useId()
  const pad = useRef<SignaturePadHandle>(null)
  const [method, setMethod] = useState<'signature' | 'in_person'>('signature')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [hasInk, setHasInk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError(handoverErrorMessage(new ApiError(422, 'x', 'x', { code: 'name_required' })))
      nameRef.current?.focus()
      return
    }
    let file: Blob | undefined
    if (method === 'signature') {
      const png = await pad.current?.toPng(SIGNATURE_MAX_BYTES)
      if (!png) {
        setError('The customer has to sign in the box first.')
        return
      }
      file = png
    }
    try {
      await ack.mutateAsync({ method, customer_name: name, note, file })
      setName('')
      setNote('')
      onOpenChange(false)
    } catch (err) {
      setError(handoverErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setError(null); onOpenChange(o) }}>
      <DialogContent className="max-h-[92vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Customer acknowledgement</DialogTitle>
          <DialogDescription>Record that the customer received the system and the handover pack. This cannot be changed once handover is recorded.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3" aria-label="Record the customer acknowledgement">
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-gray-700">How did the customer acknowledge?</legend>
            {([['signature', 'Signed on this device'], ['in_person', 'In person (no signature captured)']] as const).map(([v, label]) => (
              <label key={v} className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="radio" name={`${id}-method`} className="h-5 w-5" checked={method === v} onChange={() => setMethod(v)} /> {label}
              </label>
            ))}
          </fieldset>
          <div>
            <label htmlFor={`${id}-name`} className="mb-1 block text-sm font-medium text-gray-700">Customer’s name *</label>
            <Input id={`${id}-name`} ref={nameRef} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} autoComplete="off" className="h-11 md:h-9" aria-invalid={error && !name.trim() ? true : undefined} />
          </div>
          {method === 'signature' && (
            <SignaturePad ref={pad} id={`${id}-sig`} label="Customer’s signature" hint="Sign with a finger or stylus." clearLabel="Clear" onInkChange={setHasInk} />
          )}
          <div>
            <label htmlFor={`${id}-note`} className="mb-1 block text-sm font-medium text-gray-700">Note (optional)</label>
            <textarea id={`${id}-note`} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-[#e4e8ee] px-3 py-2 text-base md:text-sm" />
          </div>
          <p role="alert" className={error ? 'text-sm text-red-600' : 'sr-only'}>{error}</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => onOpenChange(false)} disabled={ack.isPending}>Cancel</Button>
            <Button type="submit" className="h-11 sm:h-9" disabled={ack.isPending || (method === 'signature' && !hasInk)}>
              {ack.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />} Record acknowledgement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ItemRow({ item, canTick, onAction }: { item: PackItem; canTick: boolean; onAction: (key: string) => void }) {
  const manual = item.source === 'manual'
  const label = PACK_ITEM_LABEL[item.key] ?? item.label
  return (
    <li className="flex gap-3 py-3" data-testid={`pack-item-${item.key}`} data-done={item.done ? 'true' : 'false'}>
      <div className="mt-0.5 shrink-0">
        {item.done ? <Check className="h-4 w-4 text-green-600" aria-label="Done" /> : <Circle className="h-4 w-4 text-gray-500" aria-label="Not done" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">
          {manual ? 'Ticked by staff' : 'From the project records'}
          {item.done_at ? ` · ${formatDatetime(item.done_at)}` : ''}
          {item.done_by ? ` · ${item.done_by}` : ''}
          {item.key === 'acknowledgement' && item.done && item.customer_name ? ` · ${item.customer_name} (${item.method === 'signature' ? 'signed' : 'in person'})` : ''}
        </p>
        {item.note && <p className="mt-0.5 text-xs italic text-gray-600">“{item.note}”</p>}
        {!manual && !item.done && RECORD_HINT[item.key] && <p className="mt-1 text-xs text-amber-700">{RECORD_HINT[item.key]}</p>}
      </div>
      {manual && canTick && (
        <Button variant="outline" size="sm" className="min-h-[44px] shrink-0 md:min-h-0" onClick={() => onAction(item.key)}>
          {item.done ? (item.key === 'acknowledgement' ? 'Replace…' : 'Undo…') : item.key === 'acknowledgement' ? 'Record…' : 'Mark done…'}{' '}
          <span className="sr-only">{label}</span>
        </Button>
      )}
    </li>
  )
}

export default function HandoverPanel({ onboardingId }: { onboardingId: number }) {
  const { data: pack, isLoading, error, refetch } = useHandoverPack(onboardingId)
  const orientation = useTickOrientation(onboardingId)
  const omContact = useTickOmContact(onboardingId)
  const [dialog, setDialog] = useState<{ kind: 'orientation' | 'om_contact'; done: boolean } | 'ack' | null>(null)

  if (isLoading) return <Card><CardContent className="space-y-3 p-6"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-24 w-full" /></CardContent></Card>
  if (error) {
    if (error instanceof ApiError && (error.structuredDetail?.code === 'execution_not_started' || error.status === 404)) {
      return <Card><CardContent className="p-6 text-sm text-gray-600" data-testid="handover-unavailable">{handoverErrorMessage(error)}</CardContent></Card>
    }
    return <DashboardError error={error} onRetry={() => void refetch()} />
  }
  if (!pack) return null

  const canTick = !!pack.can_act && !pack.handover_recorded
  const tickDone = (p: Pack, key: 'orientation' | 'om_contact') => !!p.items.find((i) => i.key === key)?.done
  const act = (key: string) => {
    if (key === 'acknowledgement') setDialog('ack')
    else if (key === 'orientation' || key === 'om_contact') setDialog({ kind: key, done: !tickDone(pack, key) })
  }
  const tick = typeof dialog === 'object' && dialog ? dialog : null

  return (
    <div className="space-y-4" data-testid="handover-panel">
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Handover pack</CardTitle>
            <Badge variant={pack.complete ? 'green' : 'amber'} data-testid="pack-complete-badge">
              {pack.complete ? 'Complete' : `${pack.done} of ${pack.total} done`}
            </Badge>
            {pack.handover_recorded && <Badge variant="blue">Handover recorded</Badge>}
            {!pack.pack_required && <Badge variant="gray">Pack not required</Badge>}
          </div>
          {!pack.handover_recorded && (
            pack.complete ? (
              <p className="text-sm text-green-700" data-testid="pack-ready">The pack is complete. Handover can now be recorded on the <Link className="underline" href="?tab=installation">Installation tab</Link>.</p>
            ) : (
              <div className="text-sm text-amber-800" data-testid="pack-missing">
                {pack.pack_required ? 'Handover cannot be recorded until these are done:' : 'Still open (not required to record handover):'}
                <ul className="mt-1 list-disc pl-5">
                  {pack.missing.map((k) => <li key={k}>{PACK_ITEM_LABEL[k] ?? pack.items.find((i) => i.key === k)?.label ?? k}</li>)}
                </ul>
              </div>
            )
          )}
          {pack.handover_recorded && <p className="text-xs text-gray-500">Handover is recorded, so the pack is frozen.</p>}
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-[#e4e8ee]" aria-label="Pack items">
            {pack.items.map((item) => <ItemRow key={item.key} item={item} canTick={canTick} onAction={act} />)}
          </ul>
          {!pack.can_act && <p className="mt-3 text-xs text-gray-500">Only Operations and Admin tick these items.</p>}
        </CardContent>
      </Card>

      <HandoverDelivery onboardingId={onboardingId} pack={pack} />

      <ReasonDialog
        open={!!tick}
        onOpenChange={(o) => !o && setDialog(null)}
        title={tick ? `${tick.done ? 'Mark done' : 'Undo'}: ${PACK_ITEM_LABEL[tick.kind]}` : ''}
        description={tick?.done ? 'This ticks the item on the handover pack. It is recorded in the audit log.' : 'This removes the tick from the handover pack. It is recorded in the audit log.'}
        label="Note (optional)"
        confirmLabel={tick?.done ? 'Mark done' : 'Undo tick'}
        destructive={!tick?.done}
        describeError={handoverErrorMessage}
        onConfirm={(note) => {
          const run = tick!.kind === 'orientation' ? orientation : omContact
          return run.mutateAsync({ done: tick!.done, ...(note ? { note } : {}) })
        }}
      />
      <AcknowledgeDialog open={dialog === 'ack'} onOpenChange={(o) => !o && setDialog(null)} onboardingId={onboardingId} />
    </div>
  )
}
