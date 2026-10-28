'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { FileText, Loader2 } from 'lucide-react'
import {
  useAssociateApplication,
  useSetApplicationStatus,
  useApproveApplication,
  fetchApplicationDocumentLink,
} from '@/lib/associate/api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { staffAssociateError } from '@/lib/associate/staff-associates'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/dashboard/utils'
import ShareSignInCard from '@/components/dashboard/ShareSignInCard'
import type { ApplicationType } from '@/lib/associate/types'
import { RequirePermission } from '@/components/dashboard/RequirePermission'
import { usePermissions } from '@/lib/access/use-permissions'

const errorMessage = staffAssociateError

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="font-utility text-[11px] uppercase tracking-wide text-[#111827]/65">{label}</p>
      <p className="font-utility text-sm text-[#091c3c] mt-0.5">{value ?? '—'}</p>
    </div>
  )
}

function DocumentLink({ applicationType, id, document, filename }: { applicationType: ApplicationType; id: number; document: string; filename: string }) {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(false)

  async function open() {
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      // Signed links expire — always fetched fresh on click, never cached.
      const link = await fetchApplicationDocumentLink(applicationType, id, document, token)
      window.open(link.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to open document'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={() => void open()}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg border border-[#e4e8ee] px-3 py-2 font-utility text-sm text-[#0e2a63] hover:bg-[#f7f9fc] transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      {filename}
    </button>
  )
}

/** The applicant's email carries this text verbatim (associate_journeys.md §1): show it as they will read it. */
function ApplicantPreview({ prefix, text }: { prefix: string; text: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" data-testid="applicant-preview">
      <p className="font-utility text-xs font-semibold text-amber-900">The applicant will read this in their email:</p>
      <p className="mt-1 whitespace-pre-wrap font-utility text-sm text-amber-950">{text.trim() ? `${prefix}${text.trim()}` : '—'}</p>
      <p className="mt-2 font-utility text-xs text-amber-900">Write it to them, in plain words. Leave out internal notes, names of colleagues and anything you would not say to them directly.</p>
    </div>
  )
}

export default function ApplicationDetailPage() {
  return (
    <RequirePermission rule="associates.applications.review" what="Associate applications">
      <ApplicationDetail />
    </RequirePermission>
  )
}

function ApplicationDetail() {
  const params = useParams<{ type: string; id: string }>()
  const router = useRouter()
  const { can } = usePermissions()
  const applicationType = params.type as ApplicationType
  const id = Number(params.id)

  const { data: app, isLoading, error, refetch } = useAssociateApplication(applicationType, id)
  const setStatus = useSetApplicationStatus()
  const approve = useApproveApplication()

  const [approvedId, setApprovedId] = useState<string | null>(null)
  const [callCompleted, setCallCompleted] = useState(false)
  const [callNote, setCallNote] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [infoOpen, setInfoOpen] = useState(false)
  const [infoNote, setInfoNote] = useState('')


  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (isLoading || !app) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  async function moveToReview() {
    try {
      await setStatus.mutateAsync({ applicationType, id, status: 'under_review' })
      toast.success('Moved to under review')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update status'))
    }
  }

  async function confirmReject() {
    if (!rejectReason.trim()) return
    try {
      await setStatus.mutateAsync({ applicationType, id, status: 'rejected', note: rejectReason.trim() })
      toast.success('Application rejected')
      setRejectOpen(false)
      setRejectReason('')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to reject application'))
    }
  }

  async function confirmNeedsInfo() {
    if (!infoNote.trim()) return
    try {
      await setStatus.mutateAsync({ applicationType, id, status: 'needs_info', note: infoNote.trim() })
      toast.success('Marked as needing more info')
      setInfoOpen(false)
      setInfoNote('')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update status'))
    }
  }

  async function confirmApprove() {
    if (!callCompleted || !callNote.trim()) return
    try {
      const result = await approve.mutateAsync({
        applicationType,
        id,
        verificationCallCompleted: callCompleted,
        verificationCallNote: callNote.trim(),
      })
      toast.success(`Approved — Associate ID ${result.associate.associate_id}. The invite and documents are being prepared.`)
      setApprovedId(result.associate.associate_id)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to approve application'))
    }
  }

  const territory = app.requested_territory ?? app.address_territory
  const territoryLabel = [territory.state.name, territory.district?.name, territory.block?.name].filter(Boolean).join(' / ')

  return (
    <div className="max-w-4xl">
      <button onClick={() => router.push('/dashboard/associate-network')} className="font-utility text-sm text-[#0e2a63] mb-4">
        ← Back to queue
      </button>

      {approvedId && (
        <div role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 font-utility text-sm text-green-800" data-testid="approved-notice">
          Approved — the invite and documents are being prepared.{' '}
          <Link href={`/dashboard/associate-network/associates/${approvedId}`} className="font-medium underline">View the associate</Link>
        </div>
      )}

      {can('associates.applications.review') && (app.status === 'approved' || approvedId) && (app.associate_id ?? approvedId) && (
        <ShareSignInCard
          fullName={app.full_name}
          associateId={(app.associate_id ?? approvedId)!}
          type={app.application_type}
          mobile={app.mobile}
          email={app.email}
        />
      )}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">{app.full_name}</h1>
          <p className="font-utility text-sm text-[#111827]/65 mt-1">
            {app.application_type === 'preferred_associate' ? 'Preferred Associate' : 'Associate'} application #{app.application_id}
          </p>
        </div>
        <Badge>{app.status.replace(/_/g, ' ')}</Badge>
      </div>

      <Card className="p-6 mb-4">
        <h2 className="font-display text-sm font-semibold text-[#091c3c] mb-4">Applicant details</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          <Field label="Date of birth" value={app.date_of_birth} />
          <Field label="Mobile" value={app.mobile} />
          <Field label="Email" value={app.email} />
          <Field label="Address" value={app.address_line} />
          <Field label="PIN code" value={app.pin_code} />
          <Field label="Territory" value={territoryLabel} />
          <Field label="Aadhaar (last 4)" value={app.aadhaar_last4} />
          <Field label="PAN" value={app.pan} />
          <Field label="Bank account (last 4)" value={app.bank_account_last4} />
          <Field label="IFSC" value={app.bank_ifsc} />
          {app.capability && <Field label="Capability" value={app.capability} />}
          {app.requested_level && <Field label="Requested level" value={app.requested_level.replace(/_/g, ' ')} />}
        </div>
        {app.application_type === 'preferred_associate' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-5 pt-5 border-t border-[#e4e8ee]">
            <Field label="Business type" value={app.business_type} />
            <Field label="GSTIN" value={app.gstin} />
            <Field label="Office address" value={app.office_address} />
            <Field label="Team size" value={app.team_size} />
            <Field label="Prior experience" value={app.prior_experience} />
            {app.references?.map((ref, i) => (
              <Field key={i} label={`Reference ${i + 1}`} value={`${ref.name} · ${ref.mobile}`} />
            ))}
          </div>
        )}
        <div className="mt-5 pt-5 border-t border-[#e4e8ee]">
          <Field label="KYC consent" value={`v${app.kyc_consent_version} accepted ${formatDate(app.kyc_consent_accepted_at)}`} />
        </div>
      </Card>

      <Card className="p-6 mb-4">
        <h2 className="font-display text-sm font-semibold text-[#091c3c] mb-4">Documents</h2>
        <div className="flex flex-wrap gap-2">
          {app.documents.map((doc) => (
            <DocumentLink key={doc.document} applicationType={applicationType} id={id} document={doc.document} filename={doc.filename} />
          ))}
        </div>
      </Card>

      {(app.needs_info_note || app.rejection_reason) && (
        <Card className="p-6 mb-4 border-amber-200 bg-amber-50">
          {app.needs_info_note && <p className="font-utility text-sm text-amber-800"><strong>Needs info (sent to the applicant):</strong> {app.needs_info_note}</p>}
          {app.rejection_reason && <p className="font-utility text-sm text-red-700 mt-1"><strong>Rejected — reason sent to the applicant:</strong> {app.rejection_reason}</p>}
        </Card>
      )}

      {app.status === 'submitted' && (
        <Card className="p-6 mb-4">
          <p className="font-utility text-sm text-[#111827]/60 mb-3">Move this application into review to begin verification.</p>
          <Button onClick={() => void moveToReview()} disabled={setStatus.isPending}>
            {setStatus.isPending ? 'Updating…' : 'Start review'}
          </Button>
        </Card>
      )}

      {app.status === 'under_review' && (
        <Card className="p-6 mb-4">
          <h2 className="font-display text-sm font-semibold text-[#091c3c] mb-4">Verification call</h2>
          <label className="flex items-center gap-2 mb-3">
            <input type="checkbox" checked={callCompleted} onChange={(e) => setCallCompleted(e.target.checked)} className="h-4 w-4" />
            <span className="font-utility text-sm text-[#091c3c]">Verification call completed</span>
          </label>
          <div className="space-y-1.5 mb-4">
            <Label htmlFor="call-note">Call notes</Label>
            <Textarea id="call-note" value={callNote} onChange={(e) => setCallNote(e.target.value)} rows={3} placeholder="What was confirmed on the call…" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void confirmApprove()} disabled={!callCompleted || !callNote.trim() || approve.isPending}>
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
            <Button variant="outline" onClick={() => setInfoOpen(true)}>Request more info</Button>
            <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setRejectOpen(true)}>Reject</Button>
          </div>
        </Card>
      )}

      {app.status === 'needs_info' && (
        <Card className="p-6 mb-4">
          <p className="font-utility text-sm text-[#111827]/60 mb-3">Waiting on the applicant. Move back to review once they respond.</p>
          <Button onClick={() => void moveToReview()} disabled={setStatus.isPending}>
            {setStatus.isPending ? 'Updating…' : 'Back to review'}
          </Button>
        </Card>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject application</DialogTitle>
            <DialogDescription>A reason is required. It is emailed to the applicant exactly as you write it.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="reject-reason">Reason — shown to the applicant</Label>
          <Textarea id="reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} maxLength={2000} placeholder="Write it to the applicant, e.g. “The PAN card photo is not readable.”" />
          <ApplicantPreview prefix="Reason: " text={rejectReason} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmReject()} disabled={!rejectReason.trim() || setStatus.isPending}>
              {setStatus.isPending ? 'Rejecting…' : 'Reject and email the applicant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request more info</DialogTitle>
            <DialogDescription>Tell the applicant what&apos;s missing or needs correcting. The note is emailed to them exactly as you write it.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="info-note">Note — shown to the applicant</Label>
          <Textarea id="info-note" value={infoNote} onChange={(e) => setInfoNote(e.target.value)} rows={3} maxLength={2000} placeholder="Write it to the applicant, e.g. “Please send a clearer photo of your cancelled cheque.”" />
          <ApplicantPreview prefix="" text={infoNote} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setInfoOpen(false)}>Cancel</Button>
            <Button onClick={() => void confirmNeedsInfo()} disabled={!infoNote.trim() || setStatus.isPending}>
              {setStatus.isPending ? 'Saving…' : 'Email the applicant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
