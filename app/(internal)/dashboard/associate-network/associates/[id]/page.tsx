'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth, useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { ShieldOff, FileText, Loader2 } from 'lucide-react'
import {
  useAdminAssociate,
  useSetAssociateStatus,
  useRetryClerkInvite,
  useRegenerateAssociateDocuments,
  fetchAdminAssociateDocumentLink,
  isPreparing,
  PREPARING_WINDOW_MS,
} from '@/lib/associate/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/dashboard/utils'
import ShareSignInCard from '@/components/dashboard/ShareSignInCard'
import type { Role } from '@/lib/dashboard/types'

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.detail || err.message
  if (err instanceof Error) return err.message
  return fallback
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
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUser()
  const { getToken } = useAuth()
  const role = user?.publicMetadata?.role as Role | undefined
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

  if (role && role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ShieldOff className="h-12 w-12 text-[#111827]/65 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold text-[#091c3c]">Access Denied</p>
        </div>
      </div>
    )
  }

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
      await setStatus.mutateAsync({ associateId, status: 'suspended', reason: reason.trim() })
      toast.success('Associate suspended')
      setSuspendOpen(false)
      setReason('')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to suspend associate'))
    }
  }

  async function confirmDeactivate() {
    if (!reason.trim()) return
    try {
      await setStatus.mutateAsync({ associateId, status: 'deactivated', reason: reason.trim() })
      toast.success('Associate deactivated — seat released')
      setDeactivateOpen(false)
      setReason('')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to deactivate associate'))
    }
  }

  async function handleReactivate() {
    try {
      await setStatus.mutateAsync({ associateId, status: 'active' })
      toast.success('Associate reactivated')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to reactivate associate'))
    }
  }

  const preparing = isPreparing(associate)

  return (
    <div className="max-w-3xl">
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
            label="Invite status"
            value={
              associate.clerk_invite_status === 'failed'
                ? <span className="text-red-600">Failed</span>
                : associate.clerk_invite_status ?? (preparing ? <span data-testid="invite-preparing">Preparing…</span> : 'Pending')
            }
          />
        </div>
        {associate.clerk_invite_status === 'failed' && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => retryInvite.mutate(associateId, { onSuccess: () => toast.success('Invite re-sent'), onError: (err) => toast.error(errorMessage(err, 'Failed to retry invite')) })}
            disabled={retryInvite.isPending}
          >
            Retry Clerk invite
          </Button>
        )}
      </Card>

      {role === 'admin' && associate.status === 'active' && (
        <ShareSignInCard
          fullName={associate.full_name}
          associateId={associate.associate_id}
          type={associate.associate_type}
          mobile={associate.mobile}
          email={associate.email}
        />
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
              {setStatus.isPending ? 'Reactivating…' : 'Reactivate'}
            </Button>
          )}
          {associate.status !== 'deactivated' && (
            <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDeactivateOpen(true)}>Deactivate</Button>
          )}
        </div>
      </Card>

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {associate.full_name}?</DialogTitle>
            <DialogDescription>A reason is required. Suspension can be reversed later.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason for suspension…" />
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
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason for deactivation…" />
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
