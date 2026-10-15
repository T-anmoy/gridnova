'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import { DashboardError } from '@/components/dashboard/DashboardError'
import ReasonDialog from '@/components/dashboard/ReasonDialog'
import { RequestBadges, SlaText } from '@/components/dashboard/handover/ServiceRequestRow'
import { notAuthenticatedError } from '@/lib/api/http'
import { useEmployeeMe, useEmployees } from '@/lib/dashboard/api-client'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'
import { formatDate, formatDatetime } from '@/lib/dashboard/utils'
import { HISTORY_LABEL, RAISED_VIA_LABEL, STATUS_LABEL, categoryLabel, handoverErrorMessage } from '@/lib/handover/labels'
import type { ServiceRequest } from '@/lib/handover/schemas'
import {
  fetchRequestPhotoLink,
  useAddRequestNote,
  useAssignRequest,
  useServiceRequest,
  useSetRequestStatus,
} from '@/lib/handover/staff-api-client'

const CLOSED = ['resolved', 'rejected']

function Photos({ request }: { request: ServiceRequest }) {
  const { getToken } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const photos = request.photos ?? []
  if (photos.length === 0) return <p className="text-sm text-gray-500">No photos were attached.</p>
  async function open(ref: string) {
    setError(null)
    try {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      // A signed URL expires: fetch a fresh one on every click.
      const link = await fetchRequestPhotoLink(request.request_id, ref, token)
      window.open(link.url, '_blank', 'noopener')
    } catch (err) {
      setError(handoverErrorMessage(err))
    }
  }
  return (
    <div>
      <ul className="flex flex-wrap gap-2" aria-label="Photos">
        {photos.map((p, i) => (
          <li key={p.file_ref}>
            <Button variant="outline" className="h-11 md:h-9" onClick={() => void open(p.file_ref)}>
              <ExternalLink className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Photo {i + 1}
              {p.filename && <span className="sr-only">{` (${p.filename})`}</span>}
            </Button>
          </li>
        ))}
      </ul>
      <p role="alert" className={error ? 'mt-2 text-sm text-red-600' : 'sr-only'}>{error}</p>
    </div>
  )
}

export default function ServiceRequestDetail({ requestId }: { requestId: number }) {
  const { role } = useStaffRole()
  const { data: r, isLoading, error, refetch } = useServiceRequest(requestId)
  const me = useEmployeeMe()
  const employees = useEmployees({ enabled: role === 'admin' })
  const assign = useAssignRequest()
  const setStatus = useSetRequestStatus()
  const addNote = useAddRequestNote()
  const [dialog, setDialog] = useState<'resolve' | 'reject' | 'note' | 'assign' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [assignee, setAssignee] = useState('')

  const back = (
    <Link href="/dashboard/service-requests" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[#0e2a63]">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Service requests
    </Link>
  )
  if (error) return <div className="space-y-3">{back}<DashboardError error={error} onRetry={() => void refetch()} /></div>
  if (isLoading || !r) return <div className="space-y-3">{back}<Skeleton className="h-40 w-full" /></div>

  const canHandle = !!r.can_handle
  const closed = CLOSED.includes(r.status)
  const names = new Map((employees.data ?? []).map((e) => [e.id, e.name]))
  const who = (id: string | null | undefined) => (!id ? null : id === me.data?.id ? 'You' : (names.get(id) ?? id))
  // Admin can pick any active Admin / Operations / Engineer; the others have no staff list endpoint
  // for these roles, so they can assign to themselves or clear the assignment.
  const pickable = (employees.data ?? []).filter((e) => e.is_active && ['admin', 'operations', 'engineer'].includes(e.role))

  return (
    <div className="space-y-4" data-testid="service-request-detail">
      {back}
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">Request #{r.request_id} — {categoryLabel(r.category)}</CardTitle>
            <RequestBadges request={r} />
          </div>
          <p className="text-sm text-gray-600">
            {r.customer_name ?? 'Customer'}{r.project_reference_id ? ` · ${r.project_reference_id}` : ''}
            {r.onboarding_id != null && <> · <Link className="inline-flex min-h-[44px] items-center text-[#0e2a63] underline" href={`/dashboard/operations/${r.onboarding_id}?tab=service`}>Open project</Link></>}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap break-words text-sm text-gray-900">{r.description}</p>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-gray-500">Raised</dt><dd>{formatDatetime(r.created_at)} · {RAISED_VIA_LABEL[r.raised_via ?? ''] ?? r.raised_via}{r.raised_by ? ` (${r.raised_by})` : ''}</dd></div>
            <div><dt className="text-xs text-gray-500">Contact phone</dt><dd>{r.contact_phone ?? '—'}</dd></div>
            <div><dt className="text-xs text-gray-500">System warranty ends</dt><dd>{r.warranty_end ? formatDate(r.warranty_end) : 'Unknown'}</dd></div>
            <div><dt className="text-xs text-gray-500">SLA due</dt><dd><SlaText request={r} /></dd></div>
            <div><dt className="text-xs text-gray-500">Assigned to</dt><dd data-testid="assignee">{who(r.assignee_id) ?? 'Unassigned'}</dd></div>
            {r.closed_at && <div><dt className="text-xs text-gray-500">Closed</dt><dd>{formatDatetime(r.closed_at)}</dd></div>}
          </dl>
          {r.resolution_note && <p className="rounded-lg bg-[#f7f9fc] px-3 py-2 text-sm"><span className="font-medium">{STATUS_LABEL[r.status]}: </span>{r.resolution_note}</p>}
          <Photos request={r} />
          {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
          {canHandle ? (
            <div className="flex flex-wrap gap-2" data-testid="request-actions">
              {r.status === 'open' && (
                <Button className="h-11 md:h-9" onClick={() => void setStatus.mutateAsync({ requestId, status: 'in_progress' }).then(() => setNotice('Marked in progress.')).catch((e) => setNotice(handoverErrorMessage(e)))}>Start work</Button>
              )}
              {!closed && <Button variant="outline" className="h-11 md:h-9" onClick={() => setDialog('resolve')}>Resolve…</Button>}
              {!closed && <Button variant="outline" className="h-11 md:h-9" onClick={() => setDialog('reject')}>Reject…</Button>}
              <Button variant="outline" className="h-11 md:h-9" onClick={() => setDialog('note')}>Add internal note…</Button>
              {role === 'admin' ? (
                <Button variant="outline" className="h-11 md:h-9" onClick={() => { setAssignee(r.assignee_id ?? ''); setDialog('assign') }}>Assign…</Button>
              ) : (
                <>
                  {me.data && r.assignee_id !== me.data.id && <Button variant="outline" className="h-11 md:h-9" onClick={() => void assign.mutateAsync({ requestId, assigneeId: me.data!.id }).then(() => setNotice('Assigned to you.')).catch((e) => setNotice(handoverErrorMessage(e)))}>Assign to me</Button>}
                  {r.assignee_id && <Button variant="outline" className="h-11 md:h-9" onClick={() => void assign.mutateAsync({ requestId, assigneeId: null }).then(() => setNotice('Assignment cleared.')).catch((e) => setNotice(handoverErrorMessage(e)))}>Unassign</Button>}
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Read-only: only Operations, Engineers and Admin work on service requests.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">History</CardTitle></CardHeader>
        <CardContent>
          {(r.history ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No history yet.</p>
          ) : (
            <ol className="space-y-3" aria-label="Request history">
              {[...(r.history ?? [])].reverse().map((h, i) => (
                <li key={i} className="text-sm" data-testid="history-item">
                  <p className="font-medium text-gray-900">
                    {HISTORY_LABEL[h.kind] ?? h.kind}
                    {h.from_status && h.to_status ? `: ${STATUS_LABEL[h.from_status] ?? h.from_status} → ${STATUS_LABEL[h.to_status] ?? h.to_status}` : h.to_status ? `: ${STATUS_LABEL[h.to_status] ?? h.to_status}` : ''}
                    {h.kind === 'note' && <Badge variant="outline" className="ml-2">Internal</Badge>}
                  </p>
                  {h.note && <p className="whitespace-pre-wrap break-words text-gray-700">{h.note}</p>}
                  <p className="text-xs text-gray-500">{formatDatetime(h.at)}{h.actor ? ` · ${who(h.actor)}` : ''}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <ReasonDialog
        open={dialog === 'resolve'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Resolve this request"
        description="The owning associate and the customer see that it is resolved."
        label="What was done"
        required
        confirmLabel="Mark resolved"
        describeError={handoverErrorMessage}
        onConfirm={async (note) => { await setStatus.mutateAsync({ requestId, status: 'resolved', note }); setNotice('Marked resolved.') }}
      />
      <ReasonDialog
        open={dialog === 'reject'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Reject this request"
        description="Say why it is not being actioned (for example, outside the scope of service)."
        label="Reason"
        required
        destructive
        confirmLabel="Reject request"
        describeError={handoverErrorMessage}
        onConfirm={async (note) => { await setStatus.mutateAsync({ requestId, status: 'rejected', note }); setNotice('Rejected.') }}
      />
      <ReasonDialog
        open={dialog === 'note'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Add an internal note"
        description="Only staff see internal notes."
        label="Note"
        required
        confirmLabel="Add note"
        describeError={handoverErrorMessage}
        onConfirm={async (note) => { await addNote.mutateAsync({ requestId, note }); setNotice('Note added.') }}
      />
      {dialog === 'assign' && (
        <AssignDialog
          open
          onClose={() => setDialog(null)}
          value={assignee}
          onChange={setAssignee}
          options={pickable.map((e) => ({ id: e.id, label: `${e.name} (${e.role})` }))}
          onConfirm={async () => { await assign.mutateAsync({ requestId, assigneeId: assignee || null }); setNotice(assignee ? 'Assignment updated.' : 'Assignment cleared.') }}
        />
      )}
    </div>
  )
}


function AssignDialog({ open, onClose, value, onChange, options, onConfirm }: { open: boolean; onClose: () => void; value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; onConfirm: () => Promise<unknown> }) {
  return (
    <ConfirmDialog open={open} onOpenChange={(o) => !o && onClose()} title="Assign this request" description="Choose who handles it, or clear the assignment." confirmLabel="Save" describeError={handoverErrorMessage} onConfirm={onConfirm}>
      <div>
        <label htmlFor="assign-to" className="mb-1 block text-sm font-medium text-gray-700">Assign to</label>
        <select id="assign-to" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-lg border border-[#e4e8ee] bg-white px-3 text-base md:h-9 md:text-sm">
          <option value="">Nobody (clear assignment)</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
    </ConfirmDialog>
  )
}
