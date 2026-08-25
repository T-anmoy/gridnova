'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import {
  AlertCircle, ArrowLeft, CheckCircle, Clock, Download,
  RefreshCw, Send, ShieldCheck, XCircle,
} from 'lucide-react'
import {
  useProposal, useProposalPdf, useApproveProposal, useManagerSignOff,
  useRequestRevision, useSendProposal, useDraftProposal,
} from '@/lib/dashboard/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { formatCurrency, formatDate, formatDatetime } from '@/lib/dashboard/utils'
import type { ProposalStatus, Role } from '@/lib/dashboard/types'

function statusVariant(status: ProposalStatus) {
  const map: Record<ProposalStatus, string> = {
    draft: 'gray', pending_pricing_validation: 'blue', pending_approval: 'amber',
    revision_requested: 'orange', approved: 'green', sent: 'navy',
  }
  return map[status] as 'gray' | 'blue' | 'amber' | 'orange' | 'green' | 'navy'
}

function ContentSection({ title, content }: { title: string; content?: string | null }) {
  if (!content) return null
  return (
    <Card className="mb-4">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="font-utility text-sm text-[#111827] leading-relaxed whitespace-pre-wrap">{content}</p>
      </CardContent>
    </Card>
  )
}

function ConfirmDialog({
  title,
  description,
  onConfirm,
  loading,
  children,
  variant = 'default',
}: {
  title: string
  description: string
  onConfirm: () => void
  loading?: boolean
  children: React.ReactNode
  variant?: 'default' | 'destructive'
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={() => { onConfirm(); setOpen(false) }}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined

  const proposalId = parseInt(id, 10)
  const { data: proposal, isLoading, error, refetch } = useProposal(proposalId)

  const needsPdfPolling = !!proposal && proposal.status === 'approved' && !proposal.pdf_url
  const { data: pdfData } = useProposalPdf(proposalId, needsPdfPolling)

  const approveMutation = useApproveProposal()
  const signOffMutation = useManagerSignOff()
  const revisionMutation = useRequestRevision()
  const sendMutation = useSendProposal()
  const draftMutation = useDraftProposal()

  const [revisionReason, setRevisionReason] = useState('')
  const [revisionOpen, setRevisionOpen] = useState(false)

  const isSales = role === 'sales'
  const isAdmin = role === 'admin'
  const isManagement = role === 'management'
  const canAct = isAdmin || isSales || isManagement

  async function handleApprove() {
    try {
      await approveMutation.mutateAsync(proposalId)
      toast.success('Proposal approved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve')
    }
  }

  async function handleManagerSignOff() {
    try {
      await signOffMutation.mutateAsync(proposalId)
      toast.success('Manager sign-off completed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign off')
    }
  }

  async function handleSend() {
    try {
      await sendMutation.mutateAsync(proposalId)
      toast.success('Proposal sent to customer')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send')
    }
  }

  async function handleRevision() {
    if (!revisionReason.trim()) {
      toast.error('Please provide a revision reason')
      return
    }
    try {
      await revisionMutation.mutateAsync({ proposalId, reason: revisionReason })
      toast.success('Revision requested')
      setRevisionOpen(false)
      setRevisionReason('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to request revision')
    }
  }

  async function handleGenerateNewDraft() {
    if (!proposal?.lead_id || !proposal?.customer?.id) {
      toast.error('Missing lead or customer data')
      return
    }
    try {
      const result = await draftMutation.mutateAsync({
        lead_id: proposal.lead_id,
        customer_id: proposal.customer.id,
      })
      toast.success('New proposal draft created')
      router.push(`/dashboard/proposals/${result.proposal_id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create draft')
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

  if (error || !proposal) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-utility font-medium text-red-700">
              {error ? 'Failed to load proposal' : 'Proposal not found'}
            </p>
            {error && <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>Retry</Button>}
          </div>
        </div>
      </div>
    )
  }

  const content = proposal.content ?? {}
  const pdfUrl = pdfData?.pdf_url ?? proposal.pdf_url

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#091c3c]">
              Proposal #{proposal.id}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">v{proposal.version}</Badge>
              <Badge variant={statusVariant(proposal.status)}>{proposal.status.replace(/_/g, ' ')}</Badge>
              {proposal.requires_manager_signoff && (
                <Badge variant="amber" className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Manager sign-off required
                </Badge>
              )}
              {proposal.status === 'sent' && (
                proposal.accepted_at ? (
                  <Badge variant="green" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Accepted
                  </Badge>
                ) : (
                  <Badge variant="amber" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Awaiting acceptance
                  </Badge>
                )
              )}
            </div>
            {proposal.customer && (
              <p className="font-utility text-sm text-[#111827]/60 mt-1">
                {proposal.customer.name}
                {proposal.customer.company && ` · ${proposal.customer.company}`}
              </p>
            )}
            <p className="font-display text-lg font-semibold text-[#091c3c] mt-1">
              {formatCurrency(proposal.total_value)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        {canAct && (
          <div className="flex flex-wrap gap-2 items-center">
            {/* Revision request (any non-sent status) */}
            {proposal.status !== 'sent' && (
              <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <XCircle className="mr-1.5 h-4 w-4" /> Request Revision
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Revision</DialogTitle>
                    <DialogDescription>Provide a reason for the revision request.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="revision-reason">Reason *</Label>
                    <Textarea
                      id="revision-reason"
                      placeholder="Describe what needs to be revised..."
                      value={revisionReason}
                      onChange={(e) => setRevisionReason(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setRevisionOpen(false); setRevisionReason('') }}>Cancel</Button>
                    <Button
                      onClick={() => void handleRevision()}
                      disabled={revisionMutation.isPending || !revisionReason.trim()}
                    >
                      {revisionMutation.isPending ? 'Sending...' : 'Request Revision'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Draft: send for pricing check */}
            {proposal.status === 'draft' && (isAdmin || isSales) && (
              <ConfirmDialog
                title="Send for Pricing Check"
                description="This will submit the proposal for pricing validation. Continue?"
                onConfirm={() => void handleApprove()}
                loading={approveMutation.isPending}
              >
                <Button size="sm">Send for Pricing Check</Button>
              </ConfirmDialog>
            )}

            {/* Pending approval — standard (no manager signoff required) */}
            {proposal.status === 'pending_approval' && !proposal.requires_manager_signoff && (isAdmin || isSales) && (
              <ConfirmDialog
                title="Approve Proposal"
                description={`Approve proposal #${proposal.id} for ${formatCurrency(proposal.total_value)}?`}
                onConfirm={() => void handleApprove()}
                loading={approveMutation.isPending}
              >
                <Button size="sm">
                  <CheckCircle className="mr-1.5 h-4 w-4" /> Approve
                </Button>
              </ConfirmDialog>
            )}

            {/* Pending approval — manager signoff required, Management/Admin only */}
            {proposal.status === 'pending_approval' && proposal.requires_manager_signoff && (isAdmin || isManagement) && (
              <ConfirmDialog
                title="Manager Sign-Off"
                description={`Provide manager sign-off for proposal #${proposal.id} (${formatCurrency(proposal.total_value)})?`}
                onConfirm={() => void handleManagerSignOff()}
                loading={signOffMutation.isPending}
              >
                <Button size="sm" variant="secondary">
                  <ShieldCheck className="mr-1.5 h-4 w-4" /> Manager Sign-Off
                </Button>
              </ConfirmDialog>
            )}

            {/* Revision requested */}
            {proposal.status === 'revision_requested' && (isAdmin || isSales) && (
              <ConfirmDialog
                title="Generate New Draft"
                description="Create a new version of this proposal?"
                onConfirm={() => void handleGenerateNewDraft()}
                loading={draftMutation.isPending}
              >
                <Button size="sm">
                  <RefreshCw className="mr-1.5 h-4 w-4" /> Generate New Draft
                </Button>
              </ConfirmDialog>
            )}

            {/* Approved: send to customer */}
            {proposal.status === 'approved' && (isAdmin || isSales) && (
              <ConfirmDialog
                title="Send to Customer"
                description={`Send this proposal to ${proposal.customer?.name ?? 'the customer'}?`}
                onConfirm={() => void handleSend()}
                loading={sendMutation.isPending}
              >
                <Button size="sm">
                  <Send className="mr-1.5 h-4 w-4" /> Send to Customer
                </Button>
              </ConfirmDialog>
            )}

            {/* Sent: download PDF */}
            {proposal.status === 'sent' && pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">
                  <Download className="mr-1.5 h-4 w-4" /> Download PDF
                </Button>
              </a>
            )}
          </div>
        )}
      </div>

      {/* PDF generating indicator */}
      {proposal.status === 'approved' && !pdfUrl && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-100 p-3 flex items-center gap-2 text-blue-700 font-utility text-sm">
          <Clock className="h-4 w-4 animate-spin" />
          PDF is being generated... This may take a moment.
        </div>
      )}

      {/* Accept-link status — visible once the proposal has been sent */}
      {proposal.status === 'sent' && (
        <div
          className={`mb-4 rounded-lg border p-4 ${
            proposal.accepted_at
              ? 'bg-green-50 border-green-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {proposal.accepted_at ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Clock className="h-4 w-4 text-amber-600" />
            )}
            <p className={`font-utility font-medium text-sm ${proposal.accepted_at ? 'text-green-800' : 'text-amber-800'}`}>
              {proposal.accepted_at
                ? `Accepted by customer on ${formatDatetime(proposal.accepted_at)}`
                : 'Sent to customer — not yet accepted'}
            </p>
          </div>
          {proposal.accept_url && (
            <a
              href={proposal.accept_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-utility text-xs text-[#0e2a63] hover:underline break-all"
            >
              {proposal.accept_url}
            </a>
          )}
        </div>
      )}

      {/* Revision reason notice */}
      {proposal.status === 'revision_requested' && proposal.revision_reason && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="font-utility font-medium text-amber-800 text-sm">Revision Reason</p>
          <p className="font-utility text-amber-700 text-sm mt-1">{proposal.revision_reason}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_260px] gap-6">
        {/* Main content */}
        <div>
          <ContentSection title="Project Overview" content={content.project_overview as string} />
          <ContentSection title="Scope of Work" content={content.scope_of_work as string} />
          <ContentSection title="Warranty & Support" content={content.warranty_support as string} />
          <ContentSection title="Terms & Conditions" content={content.terms_conditions as string} />

          {/* Any other content keys — excluding version_note: it's a static
              string baked in once at draft time ("Draft — not yet reviewed
              or approved") that never updates as the proposal progresses,
              so showing it verbatim goes stale/contradictory next to the
              real, live status badge above. */}
          {Object.entries(content)
            .filter(([k]) => !['project_overview', 'scope_of_work', 'warranty_support', 'terms_conditions', 'version_note'].includes(k))
            .map(([key, val]) => (
              <ContentSection
                key={key}
                title={key.replace(/_/g, ' ')}
                content={typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
              />
            ))}
        </div>

        {/* Version history sidebar */}
        {proposal.versions && proposal.versions.length > 0 && (
          <aside>
            <Card>
              <CardHeader><CardTitle className="text-sm">Version History</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {proposal.versions.map((v) => (
                  <div
                    key={v.id}
                    className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                      v.id === proposal.id
                        ? 'border-[#f7a800] bg-[#f7a800]/5'
                        : 'border-[#e4e8ee] hover:bg-[#f7f9fc]'
                    }`}
                    onClick={() => router.push(`/dashboard/proposals/${v.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-utility text-xs font-semibold text-[#091c3c]">v{v.version}</span>
                      {v.id === proposal.id && (
                        <span className="font-utility text-[10px] text-[#f7a800] font-medium">Current</span>
                      )}
                    </div>
                    <Badge variant={statusVariant(v.status)} className="mt-1 text-[10px]">
                      {v.status.replace(/_/g, ' ')}
                    </Badge>
                    {v.date_created && (
                      <p className="font-utility text-[10px] text-[#111827]/40 mt-1">{formatDate(v.date_created)}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        )}
      </div>
    </div>
  )
}
