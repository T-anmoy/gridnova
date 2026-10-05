'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import {
  AlertCircle, AlertTriangle, ArrowLeft, CheckCircle, Clock, Copy, Download,
  IndianRupee, RefreshCw, Send, ShieldCheck, XCircle,
} from 'lucide-react'
import {
  useProposal, useProposalPdf, useApproveProposal, useManagerSignOff,
  useRequestRevision, useSendProposal, useDraftProposal, useAdjustPricing, fetchProposalPdf,
} from '@/lib/dashboard/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ProposalPricing from '@/components/dashboard/ProposalPricing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { formatCurrency, formatDate, formatDatetime } from '@/lib/dashboard/utils'
import type { CustomerEmailSkippedReason, PlaceholderContentDetail, ProposalStatus, Role } from '@/lib/dashboard/types'

function statusVariant(status: ProposalStatus) {
  const map: Record<ProposalStatus, string> = {
    draft: 'gray', pending_pricing_validation: 'blue', pending_approval: 'amber',
    revision_requested: 'orange', approved: 'green', sent: 'navy',
  }
  return map[status] as 'gray' | 'blue' | 'amber' | 'orange' | 'green' | 'navy'
}

// Section ids have no titles of their own (they're internal keys) — derive a
// readable label rather than inventing a title.
function sectionLabel(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const EMAIL_SKIP_MESSAGES: Record<CustomerEmailSkippedReason, string> = {
  email_not_configured: 'Outbound email isn’t configured for this environment.',
  no_customer: 'No customer record is linked to this proposal.',
  no_customer_email: 'The customer has no email address on file.',
  placeholder_customer_email: 'The customer’s email address looks like a placeholder.',
  no_accept_link: 'No accept link could be generated for this proposal.',
  send_failed: 'Sending the confirmation email failed unexpectedly.',
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.detail || err.message
  if (err instanceof Error) return err.message
  return fallback
}

function PlaceholderBanner({ sections }: { sections: string[] }) {
  return (
    <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <p className="font-utility font-medium text-amber-800 text-sm">This proposal still has placeholder content</p>
      </div>
      {sections.length > 0 && (
        <p className="font-utility text-amber-700 text-xs mt-1">
          Sections: {sections.map(sectionLabel).join(', ')}
        </p>
      )}
      <p className="font-utility text-amber-700 text-xs mt-1">Sending is disabled until this is resolved.</p>
    </div>
  )
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

interface SendResult {
  customerEmailSent: boolean
  skippedReason: CustomerEmailSkippedReason | null
}

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUser()
  const { getToken } = useAuth()
  const role = user?.publicMetadata?.role as Role | undefined

  const proposalId = parseInt(id, 10)
  const { data: proposal, isLoading, error, refetch } = useProposal(proposalId)

  // pdf_url is the raw storage address and never resolves — only ever trust
  // a signed URL fetched from the dedicated /pdf endpoint.
  const needsPdfPolling = !!proposal && proposal.status === 'approved' && proposal.pdf_available !== true
  const { data: pdfData } = useProposalPdf(proposalId, needsPdfPolling)

  const approveMutation = useApproveProposal()
  const signOffMutation = useManagerSignOff()
  const revisionMutation = useRequestRevision()
  const sendMutation = useSendProposal()
  const draftMutation = useDraftProposal()
  const adjustPricingMutation = useAdjustPricing()

  const [revisionReason, setRevisionReason] = useState('')
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [adjustPricingOpen, setAdjustPricingOpen] = useState(false)
  const [newTotalValue, setNewTotalValue] = useState('')
  const [pricingReason, setPricingReason] = useState('')
  const [send409, setSend409] = useState<PlaceholderContentDetail | null>(null)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  // Fetched fresh on click for an already-sent proposal — never on page load.
  const [sentPdfState, setSentPdfState] = useState<
    { status: 'idle' } | { status: 'loading' } | { status: 'ready'; url: string } | { status: 'pending' } | { status: 'error'; message: string }
  >({ status: 'idle' })

  const isSales = role === 'sales'
  const isAdmin = role === 'admin'
  const isManagement = role === 'management'
  const canAct = isAdmin || isSales || isManagement
  // can_adjust_pricing (verified from backend source, Prompt 03b): admin and
  // sales only — never management. Sales is further scoped by the Sales
  // rule (own/unassigned), enforced server-side.
  const canAdjustPricing = isAdmin || isSales

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
    setSend409(null)
    try {
      const result = await sendMutation.mutateAsync(proposalId)
      setSendResult({ customerEmailSent: result.customer_email_sent, skippedReason: result.customer_email_skipped_reason })
      toast.success('Proposal sent to customer')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.structuredDetail?.code === 'placeholder_content') {
        setSend409(err.structuredDetail as unknown as PlaceholderContentDetail)
        toast.error('This proposal still has placeholder content')
        return
      }
      toast.error(errorMessage(err, 'Failed to send'))
    }
  }

  async function handleAdjustPricing() {
    const value = Number(newTotalValue)
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Enter a valid total value')
      return
    }
    if (!pricingReason.trim()) {
      toast.error('A reason is required')
      return
    }
    try {
      const result = await adjustPricingMutation.mutateAsync({ proposalId, newValue: value, reason: pricingReason.trim() })
      toast.success(
        result.requires_manager_signoff
          ? 'Pricing updated — manager sign-off is now required'
          : 'Pricing updated'
      )
      setAdjustPricingOpen(false)
      setNewTotalValue('')
      setPricingReason('')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to adjust pricing'))
    }
  }

  async function handleDownloadSentPdf() {
    setSentPdfState({ status: 'loading' })
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const result = await fetchProposalPdf(proposalId, token)
      if (result.pdf_url) {
        setSentPdfState({ status: 'ready', url: result.pdf_url })
        window.open(result.pdf_url, '_blank', 'noopener,noreferrer')
      } else {
        setSentPdfState({ status: 'pending' })
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 503)) {
        setSentPdfState({ status: 'error', message: err.detail || 'PDF is not available right now' })
        return
      }
      setSentPdfState({ status: 'error', message: errorMessage(err, 'Failed to get the PDF') })
    }
  }

  async function handleCopyAcceptLink() {
    if (!proposal?.accept_url) return
    try {
      await navigator.clipboard.writeText(proposal.accept_url)
      toast.success('Accept link copied')
    } catch {
      toast.error('Could not copy the link — copy it manually below')
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
  const approvedPdfUrl = pdfData?.pdf_url
  const placeholderSections = proposal.has_placeholder_content
    ? proposal.placeholder_sections ?? []
    : send409?.placeholder_sections ?? []
  const showPlaceholderBanner = proposal.has_placeholder_content || !!send409

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

            {/* Adjust price — draft/pending_pricing_validation only */}
            {canAdjustPricing && (proposal.status === 'draft' || proposal.status === 'pending_pricing_validation') && (
              <Dialog open={adjustPricingOpen} onOpenChange={setAdjustPricingOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <IndianRupee className="mr-1.5 h-4 w-4" /> Adjust Price
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adjust Price</DialogTitle>
                    <DialogDescription>Set a new total value for this proposal. The pricing section is rewritten to match.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-total-value">New total value (₹) *</Label>
                      <Input
                        id="new-total-value"
                        type="number"
                        min="0"
                        value={newTotalValue}
                        onChange={(e) => setNewTotalValue(e.target.value)}
                        placeholder={proposal.total_value != null ? String(proposal.total_value) : undefined}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pricing-reason">Reason *</Label>
                      <Textarea
                        id="pricing-reason"
                        value={pricingReason}
                        onChange={(e) => setPricingReason(e.target.value)}
                        rows={3}
                        placeholder="Why is the price changing?"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAdjustPricingOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => void handleAdjustPricing()}
                      disabled={adjustPricingMutation.isPending || !newTotalValue.trim() || !pricingReason.trim()}
                    >
                      {adjustPricingMutation.isPending ? 'Saving…' : 'Save'}
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

            {/* Approved: send to customer — disabled while placeholder content remains */}
            {proposal.status === 'approved' && (isAdmin || isSales) && (
              proposal.has_placeholder_content ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button size="sm" disabled>
                          <Send className="mr-1.5 h-4 w-4" /> Send to Customer
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Still has placeholder content: {placeholderSections.map(sectionLabel).join(', ') || 'unspecified sections'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
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
              )
            )}

            {/* Sent: download PDF — fetched fresh on click, never on page load */}
            {proposal.status === 'sent' && proposal.pdf_available !== false && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleDownloadSentPdf()}
                disabled={sentPdfState.status === 'loading'}
              >
                <Download className="mr-1.5 h-4 w-4" />
                {sentPdfState.status === 'loading' ? 'Loading…' : 'Download PDF'}
              </Button>
            )}
          </div>
        )}
      </div>

      {sentPdfState.status === 'pending' && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-100 p-3 flex items-center gap-2 text-blue-700 font-utility text-sm">
          <Clock className="h-4 w-4 animate-spin" /> The PDF is still being prepared — try again shortly.
        </div>
      )}
      {sentPdfState.status === 'error' && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-100 p-3 flex items-center gap-2 text-red-700 font-utility text-sm">
          <AlertCircle className="h-4 w-4" /> {sentPdfState.message}
        </div>
      )}

      {showPlaceholderBanner && proposal.status !== 'sent' && <PlaceholderBanner sections={placeholderSections} />}

      <div className="mb-4">
        <ProposalPricing content={proposal.content} totalValue={proposal.total_value} />
      </div>

      {/* PDF generating indicator */}
      {proposal.status === 'approved' && !approvedPdfUrl && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-100 p-3 flex items-center gap-2 text-blue-700 font-utility text-sm">
          <Clock className="h-4 w-4 animate-spin" />
          PDF is being generated... This may take a moment.
        </div>
      )}

      {/* Send result — persistent notice when the customer confirmation email didn't go out */}
      {sendResult && !sendResult.customerEmailSent && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="font-utility font-medium text-amber-800 text-sm">
            The proposal was sent, but the customer confirmation email was not.
          </p>
          <p className="font-utility text-amber-700 text-xs mt-1">
            {sendResult.skippedReason ? EMAIL_SKIP_MESSAGES[sendResult.skippedReason] : 'Reason unknown.'}
          </p>
          {proposal.accept_url && (
            <div className="mt-2 flex items-center gap-2">
              <code className="font-utility text-xs text-amber-800 bg-amber-100 rounded px-2 py-1 break-all">{proposal.accept_url}</code>
              <Button variant="outline" size="sm" onClick={() => void handleCopyAcceptLink()}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
              </Button>
            </div>
          )}
          <p className="font-utility text-amber-700 text-xs mt-2">Share this link with the customer manually.</p>
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
