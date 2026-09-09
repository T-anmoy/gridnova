'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { AlertCircle, ArrowLeft, FileText, MessageSquare, Clock } from 'lucide-react'
import { useLead, useDraftProposal } from '@/lib/dashboard/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDatetime } from '@/lib/dashboard/utils'
import type { Role } from '@/lib/dashboard/types'

const REQUIRED_FIELDS = ['name', 'email', 'project_type', 'location', 'capacity_kw']

function stageBadgeVariant(stage: string) {
  const map: Record<string, string> = {
    new: 'blue', qualifying: 'amber', qualified: 'green',
    proposal_draft: 'navy', proposal_sent: 'navy', negotiation: 'orange', won: 'green', lost: 'gray',
  }
  return (map[stage] ?? 'gray') as 'blue' | 'amber' | 'green' | 'navy' | 'orange' | 'gray'
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined
  const [confirmOpen, setConfirmOpen] = useState(false)

  const leadId = parseInt(id, 10)
  const { data: lead, isLoading, error, refetch } = useLead(leadId)
  const draftMutation = useDraftProposal()

  const canGenerateDraft = role === 'admin' || role === 'sales'

  const collectedFields = (lead?.collected_fields ?? {}) as Record<string, unknown>
  const missingRequired = REQUIRED_FIELDS.filter((f) => !collectedFields[f])
  const isFullyQualified = missingRequired.length === 0 && lead?.pipeline_stage === 'qualified'

  async function handleGenerateDraft() {
    if (!lead?.lead_id || !lead?.customer?.id) {
      toast.error('Missing lead or customer data')
      return
    }
    try {
      const result = await draftMutation.mutateAsync({
        lead_id: lead.lead_id,
        customer_id: lead.customer.id,
      })
      toast.success('Proposal draft created')
      setConfirmOpen(false)
      router.push(`/dashboard/proposals/${result.proposal_id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create draft')
    }
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-6 w-32 mb-6" />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-60 w-full rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-utility font-medium text-red-700">
              {error ? 'Failed to load lead' : 'Lead not found'}
            </p>
            {error && <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>Retry</Button>}
          </div>
        </div>
      </div>
    )
  }

  const isEngineer = role === 'engineer'

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#091c3c]">Lead #{lead.lead_id}</h1>
            <Badge variant={stageBadgeVariant(lead.pipeline_stage)} className="mt-1">
              {lead.pipeline_stage.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
        {canGenerateDraft && !isEngineer && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    disabled={!isFullyQualified}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Proposal Draft
                  </Button>
                </span>
              </TooltipTrigger>
              {!isFullyQualified && (
                <TooltipContent>
                  <p>
                    {lead.pipeline_stage !== 'qualified'
                      ? 'Lead must be in Qualified stage'
                      : `Missing fields: ${missingRequired.join(', ')}`}
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Customer info */}
          {!isEngineer && lead.customer && (
            <Card>
              <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="font-utility font-semibold text-[#091c3c]">{lead.customer.name}</p>
                <p className="font-utility text-sm text-[#111827]/60">{lead.customer.email}</p>
                {lead.customer.company && (
                  <p className="font-utility text-sm text-[#111827]/60">{lead.customer.company}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Collected fields */}
          <Card>
            <CardHeader><CardTitle className="text-base">Collected Fields</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(collectedFields).length === 0 ? (
                <p className="font-utility text-sm text-[#111827]/40">No fields collected yet</p>
              ) : (
                <dl className="space-y-2">
                  {Object.entries(collectedFields).map(([key, value]) => (
                    <div key={key} className="flex gap-2 text-sm">
                      <dt className="font-utility font-medium text-[#111827]/60 min-w-[120px] capitalize">
                        {key.replace(/_/g, ' ')}
                      </dt>
                      <dd className="font-utility text-[#111827]">{String(value ?? '—')}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Proposals */}
          {!isEngineer && lead.proposals && lead.proposals.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Proposals</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {lead.proposals.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-[#e4e8ee] p-3 cursor-pointer hover:bg-[#f7f9fc] transition-colors"
                    onClick={() => router.push(`/dashboard/proposals/${p.id}`)}
                  >
                    <span className="font-utility text-sm font-medium">Proposal #{p.id} v{p.version}</span>
                    <Badge variant="gray">{p.status.replace(/_/g, ' ')}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Messages / Conversation */}
          {!isEngineer && lead.messages && lead.messages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Conversation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto" data-lenis-prevent>
                  {lead.messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col gap-1 ${msg.role === 'customer' ? 'items-start' : 'items-end'}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-utility text-[10px] uppercase tracking-wider text-[#111827]/40">
                          {msg.role}
                        </span>
                        <span className="font-utility text-[10px] text-[#111827]/30">
                          {formatDatetime(msg.created_at)}
                        </span>
                      </div>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm font-utility ${
                        msg.role === 'customer'
                          ? 'bg-[#f7f9fc] text-[#111827]'
                          : msg.role === 'agent'
                          ? 'bg-[#091c3c] text-white'
                          : 'bg-[#f7a800]/10 text-[#111827]'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          {!isEngineer && lead.timeline && lead.timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {lead.timeline.map((event, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <div className="mt-1 h-2 w-2 rounded-full bg-[#f7a800] shrink-0" />
                      <div>
                        <p className="font-utility font-medium text-[#111827] capitalize">
                          {event.event_type.replace(/_/g, ' ')}
                        </p>
                        <p className="font-utility text-xs text-[#111827]/60">{event.description}</p>
                        <p className="font-utility text-xs text-[#111827]/30">{formatDatetime(event.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Proposal Draft</DialogTitle>
            <DialogDescription>
              This will trigger the AI to generate a proposal draft for lead #{lead.lead_id}. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleGenerateDraft()} disabled={draftMutation.isPending}>
              {draftMutation.isPending ? 'Generating...' : 'Generate Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
