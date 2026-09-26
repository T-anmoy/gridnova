'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser, useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileText, ShieldOff, XCircle } from 'lucide-react'
import { useProposalInput, useReviewProposalInput, fetchProposalInputFileUrl } from '@/lib/dashboard/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ProposalDraftOutcome, ProposalInputDetail, ProposalInputStatus, Role } from '@/lib/dashboard/types'

function statusVariant(status: ProposalInputStatus) {
  const map: Record<ProposalInputStatus, string> = {
    submitted: 'amber',
    under_review: 'blue',
    approved_for_proposal: 'green',
    rejected: 'gray',
  }
  return (map[status] ?? 'gray') as 'amber' | 'blue' | 'green' | 'gray'
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.detail || err.message
  if (err instanceof Error) return err.message
  return fallback
}

// Renders every field present, skips anything null/undefined/empty — this is
// how `gst_number`/`internal_notes` (omitted entirely for Engineers) and
// every other optional field stay invisible instead of showing as an empty
// label, without special-casing each field name.
function FieldRow({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
  return (
    <div className="flex gap-2 text-sm">
      <dt className="font-utility font-medium text-[#111827]/60 min-w-[160px]">{label}</dt>
      <dd className="font-utility text-[#111827]">{display}</dd>
    </div>
  )
}

function FileRow({ inputId, file }: { inputId: number; file: ProposalInputDetail['files'][number] }) {
  const { getToken } = useAuth()
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      // Signed URLs expire — always fetch a fresh one on click, never cache it.
      const { url } = await fetchProposalInputFileUrl(inputId, file.file_ref, token)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to get download link'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-[#e4e8ee] p-3">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="h-4 w-4 text-[#2f5daa] shrink-0" />
        <div className="min-w-0">
          <p className="font-utility text-sm text-[#111827] truncate">{file.filename}</p>
          <p className="font-utility text-xs text-[#111827]/40">
            {file.target.replace(/_/g, ' ')}{file.document_type ? ` · ${file.document_type.replace(/_/g, ' ')}` : ''}
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => void handleDownload()} disabled={downloading}>
        <Download className="mr-1.5 h-4 w-4" /> {downloading ? 'Loading…' : 'Download'}
      </Button>
    </div>
  )
}

export default function SiteAssessmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined
  const inputId = parseInt(id, 10)

  const { data: item, isLoading, error, refetch } = useProposalInput(inputId)
  const reviewMutation = useReviewProposalInput()

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [markingUnderReview, setMarkingUnderReview] = useState(false)
  const [approveOutcome, setApproveOutcome] = useState<ProposalDraftOutcome | null>(null)

  const canReview = role === 'admin' || role === 'sales'

  if (role && !canReview) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ShieldOff className="h-12 w-12 text-[#111827]/20 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold text-[#091c3c]">Access Denied</p>
          <p className="font-utility text-sm text-[#111827]/50 mt-1">Site assessments aren&rsquo;t available to your role.</p>
        </div>
      </div>
    )
  }

  async function handleApprove() {
    try {
      const result = await reviewMutation.mutateAsync({ inputId, status: 'approved_for_proposal' })
      setApproveOutcome(result.proposal_draft ?? null)
      toast.success('Assessment approved')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to approve assessment'))
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return
    try {
      await reviewMutation.mutateAsync({ inputId, status: 'rejected', rejectionReason: rejectReason.trim() })
      toast.success('Assessment rejected')
      setRejectOpen(false)
      setRejectReason('')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to reject assessment'))
    }
  }

  async function handleMarkUnderReview() {
    setMarkingUnderReview(true)
    try {
      await reviewMutation.mutateAsync({ inputId, status: 'under_review' })
      toast.success('Marked as under review')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update status'))
    } finally {
      setMarkingUnderReview(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !item) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-utility font-medium text-red-700">
              {error ? 'Failed to load site assessment' : 'Site assessment not found'}
            </p>
            {error && <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>Retry</Button>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#091c3c]">Site Assessment #{item.id}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusVariant(item.status)}>{item.status.replace(/_/g, ' ')}</Badge>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 font-utility text-xs"
                onClick={() => router.push(`/dashboard/leads/${item.lead_id}`)}
              >
                Lead #{item.lead_id}
              </Button>
            </div>
          </div>
        </div>
        {(item.status === 'submitted' || item.status === 'under_review') && (
          <div className="flex gap-2">
            {item.status === 'submitted' && (
              <Button variant="outline" size="sm" onClick={() => void handleMarkUnderReview()} disabled={markingUnderReview}>
                {markingUnderReview ? 'Saving…' : 'Mark Under Review'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setRejectOpen(true)}>
              <XCircle className="mr-1.5 h-4 w-4" /> Reject
            </Button>
            <Button size="sm" onClick={() => void handleApprove()} disabled={reviewMutation.isPending}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> {reviewMutation.isPending ? 'Approving…' : 'Approve for Proposal'}
            </Button>
          </div>
        )}
      </div>

      {approveOutcome && (
        <div className="mb-4 rounded-lg border p-4 bg-blue-50 border-blue-200">
          {approveOutcome.triggered ? (
            <p className="font-utility text-sm text-blue-800">
              A proposal draft was created —{' '}
              <button
                className="underline font-semibold"
                onClick={() => router.push(`/dashboard/proposals/${approveOutcome.proposal_id}`)}
              >
                view Proposal #{approveOutcome.proposal_id} (v{approveOutcome.version})
              </button>
            </p>
          ) : (
            <div>
              <p className="font-utility text-sm font-medium text-blue-800">Approved, but a draft wasn&rsquo;t generated yet.</p>
              <p className="font-utility text-xs text-blue-700 mt-1">{approveOutcome.reason}</p>
              {approveOutcome.missing_fields && approveOutcome.missing_fields.length > 0 && (
                <p className="font-utility text-xs text-blue-700 mt-1">
                  Missing fields: {approveOutcome.missing_fields.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {item.status === 'rejected' && item.rejection_reason && (
        <div className="mb-4 rounded-lg bg-gray-50 border border-gray-200 p-4">
          <p className="font-utility font-medium text-gray-700 text-sm">Rejection Reason</p>
          <p className="font-utility text-gray-600 text-sm mt-1">{item.rejection_reason}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Customer & Project</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <FieldRow label="Customer type" value={item.customer_type} />
                <FieldRow label="Organisation" value={item.organisation_name} />
                <FieldRow label="GST number" value={item.gst_number} />
                <FieldRow label="Project family" value={item.project_family?.replace(/_/g, ' ')} />
                <FieldRow label="Scheme linked" value={item.scheme_linked} />
                <FieldRow label="Scheme name" value={item.scheme_name} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Installation Site</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <FieldRow label="State" value={item.state} />
                <FieldRow label="District" value={item.district} />
                <FieldRow label="PIN code" value={item.pin_code} />
                <FieldRow label="Address" value={item.full_address} />
                <FieldRow label="DISCOM" value={item.discom} />
                <FieldRow label="Consumer number" value={item.consumer_number} />
                <FieldRow label="Site type" value={item.site_type?.replace(/_/g, ' ')} />
                <FieldRow label="Roof/site area" value={item.roof_area_sqft ? `${item.roof_area_sqft} sq ft` : undefined} />
                <FieldRow label="Floors" value={item.floors} />
                <FieldRow label="Shading" value={item.shading_condition?.replace(/_/g, ' ')} />
                <FieldRow label="Structural notes" value={item.structural_notes} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Load & System</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <FieldRow label="Avg. monthly bill" value={item.avg_monthly_bill_inr ? `₹${item.avg_monthly_bill_inr}` : undefined} />
                <FieldRow label="Avg. monthly units" value={item.avg_monthly_units_kwh} />
                <FieldRow label="Peak load (kW)" value={item.peak_load_kw} />
                <FieldRow label="Connection phase" value={item.connection_phase?.replace(/_/g, ' ')} />
                <FieldRow label="Desired output (kW)" value={item.desired_output_kw} />
                <FieldRow label="Load notes" value={item.load_notes} />
                <FieldRow label="Connection type" value={item.connection_type?.replace(/_/g, ' ')} />
                <FieldRow label="Net metering" value={item.net_metering_required} />
                <FieldRow label="DCR panels required" value={item.dcr_panels_required} />
                <FieldRow label="EV charging" value={item.ev_charging} />
                <FieldRow label="Battery storage" value={item.battery_storage} />
                <FieldRow label="Equipment tier" value={item.equipment_tier} />
                <FieldRow label="Additional requirements" value={item.additional_requirements} />
                <FieldRow label="Internal notes" value={item.internal_notes} />
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Uploaded Files</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {item.files.length === 0 ? (
                <p className="font-utility text-sm text-[#111827]/40">No files uploaded</p>
              ) : (
                item.files.map((file) => <FileRow key={file.file_ref} inputId={item.id} file={file} />)
              )}
            </CardContent>
          </Card>

          {item.lead_fields_filled && Object.keys(item.lead_fields_filled).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Lead Fields Filled</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  {Object.entries(item.lead_fields_filled).map(([key, value]) => (
                    <FieldRow key={key} label={key.replace(/_/g, ' ')} value={value as string} />
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={(v) => { setRejectOpen(v); if (!v) setRejectReason('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Assessment</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this site assessment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason *</Label>
            <Textarea id="reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => void handleReject()}
              disabled={reviewMutation.isPending || !rejectReason.trim()}
            >
              {reviewMutation.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
