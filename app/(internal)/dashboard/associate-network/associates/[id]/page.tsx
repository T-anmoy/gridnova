'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { FileText, Loader2 } from 'lucide-react'
import {
  useAdminAssociate,
  useSetAssociateStatus,
  useRetryClerkInvite,
  useRegenerateAssociateDocuments,
  fetchAdminAssociateDocumentLink,
  isPreparing,
  PREPARING_WINDOW_MS,
} from '@/lib/associate/api-client'
import Link from 'next/link'
import { DashboardError } from '@/components/dashboard/DashboardError'
import {
  INVITE_STATE_LABEL,
  accessChangeLines,
  canSendInvite,
  inviteStateOf,
  staffAssociateError,
} from '@/lib/associate/staff-associates'
import type { AssociateStatusChange } from '@/lib/associate/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/dashboard/utils'
import ShareSignInCard from '@/components/dashboard/ShareSignInCard'
import AssociateRateCard from '@/components/dashboard/associate-network/AssociateRateCard'
import AssociatePerformancePanel from '@/components/dashboard/associate-network/AssociatePerformancePanel'
import { RequirePermission } from '@/components/dashboard/RequirePermission'
import { usePermissions } from '@/lib/access/use-permissions'

const errorMessage = staffAssociateError

/** What a suspend / deactivate / reinstate did, shown until it is read. */
function StatusResult({ result, onClose }: { result: AssociateStatusChange; onClose: () => void }) {
  const moving = result.status !== 'active' && result.open_customers > 0
  return (
    <Card className="p-4 mb-4 border-blue-100 bg-blue-50" role="status" data-testid="status-result">
      <p className="font-utility text-sm font-semibold text-blue-900">
        {result.status === 'active' ? 'Reinstated.' : result.status === 'suspended' ? 'Suspended.' : 'Deactivated.'}
      </p>
      <ul className="mt-1 list-disc pl-5 font-utility text-sm text-blue-900" data-testid="access-lines">
        {accessChangeLines(result.access).map((line) => <li key={line}>{line}</li>)}
      </ul>
      {result.status !== 'active' && (
        <p className="mt-2 font-utility text-sm text-blue-900" data-testid="open-customers">
          {result.open_customers === 0
            ? 'They have no open customers.'
            : `They still own ${result.open_customers} open customer${result.open_customers === 1 ? '' : 's'}. Move them to an active associate so the work continues.`}
        </p>
      )}
      {result.status === 'active' && !result.clerk_user_bound && result.clerk_invite_status == null && (
        <p className="mt-2 font-utility text-sm font-semibold text-blue-900" data-testid="new-invite-needed">
          Their earlier invitation was revoked. Send a new invitation so they can sign in.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {moving && (
          <Link href={`/dashboard/associate-network/associates/${encodeURIComponent(result.associate_id)}/move-customers`}>
            <Button size="sm" className="min-h-[44px] md:min-h-0">Move customers</Button>
          </Link>
        )}
        <Button size="sm" variant="outline" className="min-h-[44px] md:min-h-0" onClick={onClose}>Done</Button>
      </div>
    </Card>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="font-utility text-[11px] uppercase tracking-wide text-[#111827]/65">{label}</p>
      <p className="font-utility text-sm text-[#091c3c] mt-0.5">{value ?? '—'}</p>
    </div>
  )
}

export default function AssociateDetailPage() {
  return (
    <RequirePermission rule="associates.applications.review" what="Associates">
      <AssociateDetail />
    </RequirePermission>
  )
}

function AssociateDetail() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { getToken } = useAuth()
  const { can } = usePermissions()
  const associateId = params.id

  // Approval is asynchronous: keep re-reading for about a minute after the page opens.
  const [pollUntil] = useState(() => Date.now() + PREPARING_WINDOW_MS)
  const { data: associate, isLoading, error, refetch } = useAdminAssociate(associateId, { until: pollUntil })
  const setStatus = useSetAssociateStatus()
  const retryInvite = useRetryClerkInvite()
  const regenerateDocs = useRegenerateAssociateDocuments()

  const [suspendOpen, setSuspendOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [docLoading, setDocLoading] = useState<string | null>(null)
  const [statusResult, setStatusResult] = useState<AssociateStatusChange | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)


  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (isLoading || !associate) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  async function openDocument(document: 'id_card' | 'welcome_letter') {
    setDocLoading(document)
    try {
      const token = await getToken()
      if (!token) return
      const link = await fetchAdminAssociateDocumentLink(associateId, document, token)
      window.open(link.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to open document'))
    } finally {
      setDocLoading(null)
    }
  }

  async function confirmSuspend() {
    if (!reason.trim()) return
    try {
      setStatusResult(await setStatus.mutateAsync({ associateId, status: 'suspended', reason: reason.trim() }))
      setSuspendOpen(false)
      setReason('')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to suspend associate'))
    }
  }

  async function confirmDeactivate() {
    if (!reason.trim()) return
    try {
      setStatusResult(await setStatus.mutateAsync({ associateId, status: 'deactivated', reason: reason.trim() }))
      setDeactivateOpen(false)
      setReason('')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to deactivate associate'))
    }
  }

  async function handleReactivate() {
    try {
      setStatusResult(await setStatus.mutateAsync({ associateId, status: 'active' }))
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to reactivate associate'))
    }
  }

  const preparing = isPreparing(associate)

  return (
    <div className="max-w-5xl">
      <button onClick={() => router.push('/dashboard/associate-network/associates')} className="font-utility text-sm text-[#0e2a63] mb-4">
        ← Back to associates
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">{associate.full_name}</h1>
          <p className="font-utility text-sm text-[#111827]/65 mt-1">{associate.associate_id}</p>
        </div>
        <Badge variant={associate.status === 'active' ? 'green' : associate.status === 'suspended' ? 'amber' : 'gray'}>
          {associate.status}
        </Badge>
      </div>

      {preparing && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 font-utility text-sm text-blue-800" data-testid="approval-preparing">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Approved — the invite and documents are being prepared. This page updates by itself.
          <Button variant="outline" size="sm" className="ml-auto min-h-[44px]" onClick={() => void refetch()}>Check again</Button>
        </div>
      )}

      {statusResult && <StatusResult result={statusResult} onClose={() => setStatusResult(null)} />}

      {associate.status === 'suspended' && (
        <Card className="p-4 mb-4 border-amber-200 bg-amber-50" data-testid="commission-frozen">
          <p className="font-utility text-sm text-amber-900">
            <strong>Commission is frozen while suspended.</strong> Their approved entries stay approved but are left out of every payout batch, and are paid in the first batch after they are reinstated.
          </p>
        </Card>
      )}

      {associate.status !== 'active' && (
        <Card className="p-4 mb-4 flex flex-wrap items-center gap-3" data-testid="move-customers-card">
          <p className="font-utility text-sm text-[#091c3c] flex-1 min-w-[16rem]">
            Customers of a {associate.status} associate can be moved to an active associate, so their projects keep moving.
          </p>
          <Link href={`/dashboard/associate-network/associates/${encodeURIComponent(associate.associate_id)}/move-customers`}>
            <Button variant="outline" className="min-h-[44px] md:min-h-0">Move customers</Button>
          </Link>
        </Card>
      )}

      {associate.status_reason && (
        <Card className="p-4 mb-4 border-amber-200 bg-amber-50">
          <p className="font-utility text-sm text-amber-800"><strong>Reason:</strong> {associate.status_reason}</p>
        </Card>
      )}

      <Card className="p-6 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          <Field label="Email" value={associate.email} />
          <Field label="Mobile" value={associate.mobile} />
          <Field label="Type" value={associate.associate_type === 'preferred_associate' ? 'Preferred Associate' : 'Associate'} />
          {associate.capability && <Field label="Capability" value={associate.capability} />}
          {associate.level && <Field label="Level" value={associate.level.replace(/_/g, ' ')} />}
          <Field label="Territory" value={associate.territory} />
          <Field label="Approved" value={formatDate(associate.approved_at)} />
          <Field label="Clerk account" value={associate.clerk_user_bound ? 'Bound' : 'Not yet signed in'} />
          <Field
            label="Invitation"
            value={
              preparing && associate.clerk_invite_status == null ? (
                <span data-testid="invite-preparing">Preparing…</span>
              ) : (
                <span data-testid="invite-state" className={associate.clerk_invite_status === 'failed' ? 'text-red-600' : undefined}>
                  {INVITE_STATE_LABEL[inviteStateOf(associate)]}
                </span>
              )
            }
          />
        </div>
        {canSendInvite(associate) && !preparing && (
          <Button variant="outline" size="sm" className="mt-4 min-h-[44px] md:min-h-0" onClick={() => setInviteOpen(true)} disabled={retryInvite.isPending}>
            {associate.clerk_invite_status === 'sent' ? 'Send invitation again' : 'Send invitation'}
          </Button>
        )}
      </Card>

      {can('associates.applications.review') && associate.status === 'active' && (
        <ShareSignInCard
          fullName={associate.full_name}
          associateId={associate.associate_id}
          type={associate.associate_type}
          mobile={associate.mobile}
          email={associate.email}
        />
      )}

      {/* Personal-sale rate only: territory commission always follows the standard schedule. */}
      {/* Both read commissions.individual_rates.view; setting a rate is commissions.rates.manage. */}
      {can('commissions.individual_rates.view') && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <AssociateRateCard associateId={associateId} canEdit={can('commissions.rates.manage')} />
          <AssociatePerformancePanel associateId={associateId} />
        </div>
      )}

      <Card className="p-6 mb-4">
        <h2 className="font-display text-sm font-semibold text-[#091c3c] mb-4">Documents</h2>
        {associate.documents.error && (
          <p className="font-utility text-sm text-red-600 mb-3">{associate.documents.error}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {(['id_card', 'welcome_letter'] as const).map((doc) => (
            <button
              key={doc}
              onClick={() => void openDocument(doc)}
              disabled={!associate.documents[doc] || docLoading === doc}
              className="flex items-center gap-2 rounded-lg border border-[#e4e8ee] px-3 py-2 font-utility text-sm text-[#0e2a63] hover:bg-[#f7f9fc] transition-colors disabled:opacity-40"
            >
              {docLoading === doc ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {doc === 'id_card' ? 'ID card' : 'Welcome letter'}
              {!associate.documents[doc] && ' (not generated)'}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => regenerateDocs.mutate(associateId, { onSuccess: () => toast.success('Regenerating documents'), onError: (err) => toast.error(errorMessage(err, 'Failed to regenerate')) })}
          disabled={regenerateDocs.isPending}
        >
          Regenerate documents
        </Button>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-sm font-semibold text-[#091c3c] mb-4">Status controls</h2>
        <div className="flex flex-wrap gap-2">
          {associate.status === 'active' && (
            <Button variant="outline" className="text-amber-700 hover:text-amber-800" onClick={() => setSuspendOpen(true)}>Suspend</Button>
          )}
          {associate.status === 'suspended' && (
            <Button onClick={() => void handleReactivate()} disabled={setStatus.isPending}>
              {setStatus.isPending ? 'Reinstating…' : 'Reinstate'}
            </Button>
          )}
          {associate.status !== 'deactivated' && (
            <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDeactivateOpen(true)}>Deactivate</Button>
          )}
        </div>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{associate.clerk_invite_status === 'sent' ? 'Send the invitation again?' : 'Send the invitation?'}</DialogTitle>
            <DialogDescription>
              A new sign-up link goes to {associate.email}.
              {associate.clerk_invite_status === 'sent' && ' The link sent before stops working.'} Check the email address first — if it is wrong, correct it on the application.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              onClick={() =>
                retryInvite.mutate(associateId, {
                  onSuccess: () => {
                    toast.success('Invitation sent')
                    setInviteOpen(false)
                  },
                  onError: (err) => toast.error(errorMessage(err, 'The invitation could not be sent')),
                })
              }
              disabled={retryInvite.isPending}
            >
              {retryInvite.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {associate.full_name}?</DialogTitle>
            <DialogDescription>A reason is required. Suspension can be reversed by reinstating them.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 font-utility text-sm text-amber-900" data-testid="suspend-effects">
            Their sign-in is blocked at once and every open session ends. Their customers stay theirs until you move them. Commission is frozen: approved entries are paid in the first batch after reinstatement.
          </div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason for suspension…" aria-label="Reason for suspension" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmSuspend()} disabled={!reason.trim() || setStatus.isPending}>
              {setStatus.isPending ? 'Suspending…' : 'Confirm suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {associate.full_name}?</DialogTitle>
            <DialogDescription>This is final and releases their territory seat immediately. A reason is required.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-red-100 bg-red-50 p-3 font-utility text-sm text-red-900" data-testid="deactivate-effects">
            Their sign-in is blocked for good and every open session ends. Commission they earned is settled as usual. Move their open customers to an active associate afterwards.
          </div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason for deactivation…" aria-label="Reason for deactivation" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmDeactivate()} disabled={!reason.trim() || setStatus.isPending}>
              {setStatus.isPending ? 'Deactivating…' : 'Confirm deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
