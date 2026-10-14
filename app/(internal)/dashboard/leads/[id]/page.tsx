'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { AlertCircle, ArrowLeft, ClipboardEdit, FileText, MessageSquare, Clock, Repeat, ClipboardCheck } from 'lucide-react'
import {
  useLead, useDraftProposal, useChangeLeadStage, useReassignLead, useUpdateLeadFields, useAssignableEmployees,
} from '@/lib/dashboard/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency, formatDatetime } from '@/lib/dashboard/utils'
import type { PipelineStage, Role } from '@/lib/dashboard/types'
import { AskMemoryPanel } from '@/components/dashboard/AskMemoryPanel'
import { CustomerMemoryPanel } from '@/components/dashboard/CustomerMemoryPanel'
import { ReflectButton } from '@/components/dashboard/ReflectButton'
import { ScheduleMeetingDialog } from '@/components/dashboard/ScheduleMeetingDialog'
import { useStaffLeadsCopy } from '@/lib/dashboard/staff-leads-copy'
import { canScheduleMeeting, canUseMemory, isEngineerLeadDetail, isLeadNotAssigned } from '@/lib/dashboard/staff-leads-logic'
import { ApiError as LeadApiError } from '@/lib/dashboard/api-error'

const REQUIRED_FIELDS = ['name', 'email', 'project_type', 'location', 'capacity_kw']

const PIPELINE_STAGES: PipelineStage[] = [
  'new', 'qualifying', 'qualified', 'proposal_draft', 'proposal_sent', 'negotiation', 'won', 'lost',
]

function stageBadgeVariant(stage: string) {
  const map: Record<string, string> = {
    new: 'blue', qualifying: 'amber', qualified: 'green',
    proposal_draft: 'navy', proposal_sent: 'navy', negotiation: 'orange', won: 'green', lost: 'gray',
  }
  return (map[stage] ?? 'gray') as 'blue' | 'amber' | 'green' | 'navy' | 'orange' | 'gray'
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.detail || err.message
  if (err instanceof Error) return err.message
  return fallback
}

// `lost`, and leaving `won`/`lost` for any other stage, both require a
// non-blank reason — matches the backend's own 422 rule exactly.
function reasonRequired(current: PipelineStage, next: PipelineStage): boolean {
  if (next === 'lost') return true
  if ((current === 'won' || current === 'lost') && next !== current) return true
  return false
}

function StageChangeDialog({
  leadId,
  currentStage,
  open,
  onOpenChange,
}: {
  leadId: number
  currentStage: PipelineStage
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [nextStage, setNextStage] = useState<PipelineStage>(currentStage)
  const [reason, setReason] = useState('')
  const mutation = useChangeLeadStage()

  const needsReason = reasonRequired(currentStage, nextStage)
  const reasonOk = !needsReason || reason.trim().length > 0
  const reasonTooLong = reason.length > 1000

  async function handleConfirm() {
    if (!reasonOk || reasonTooLong || nextStage === currentStage) return
    try {
      await mutation.mutateAsync({ leadId, stage: nextStage, reason: reason.trim() || null })
      toast.success(`Stage changed to ${nextStage.replace(/_/g, ' ')}`)
      onOpenChange(false)
      setReason('')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to change stage'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setNextStage(currentStage); setReason('') } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Pipeline Stage</DialogTitle>
          <DialogDescription>Move lead #{leadId} to a new stage.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>New stage</Label>
            <Select value={nextStage} onValueChange={(v) => setNextStage(v as PipelineStage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsReason && (
            <div className="space-y-1.5">
              <Label htmlFor="stage-reason">Reason *</Label>
              <Textarea
                id="stage-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={nextStage === 'lost' ? 'Why was this lead lost?' : 'Why is this stage reopening?'}
              />
              {reasonTooLong && <p className="font-utility text-xs text-red-600">Reason must be 1000 characters or fewer</p>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={mutation.isPending || nextStage === currentStage || !reasonOk || reasonTooLong}
          >
            {mutation.isPending ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReassignDialog({
  leadId,
  currentAssignee,
  role,
  open,
  onOpenChange,
}: {
  leadId: number
  currentAssignee: string | null | undefined
  role: Role | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // GET /employees/assignable (admin + management — Prompt 02c) is the real
  // data source for this picker, unlike GET /employees (admin-only).
  const canPickFromDirectory = role === 'admin' || role === 'management'
  const { data: employees } = useAssignableEmployees({ enabled: canPickFromDirectory && open })
  const [employeeId, setEmployeeId] = useState('')
  const mutation = useReassignLead()

  async function handleConfirm() {
    if (!employeeId.trim()) return
    try {
      await mutation.mutateAsync({ leadId, employeeId: employeeId.trim() })
      toast.success('Lead reassigned')
      onOpenChange(false)
      setEmployeeId('')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to reassign lead'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setEmployeeId('') }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign Lead</DialogTitle>
          <DialogDescription>
            Currently {currentAssignee ? `assigned to ${currentAssignee}` : 'unassigned'}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>New assignee</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger><SelectValue placeholder="Select employee…" /></SelectTrigger>
            <SelectContent>
              {(employees ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name} ({e.role})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void handleConfirm()} disabled={mutation.isPending || !employeeId.trim()}>
            {mutation.isPending ? 'Saving…' : 'Reassign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Numeric qualification fields validated client-side before submit — the
// backend still validates for real (422 on an unknown field), this just
// avoids an obviously-wrong request round-trip.
const NUMERIC_FIELDS = new Set(['capacity_kw', 'monthly_electricity_bill', 'budget'])

function EditFieldsDialog({
  leadId,
  collectedFields,
  open,
  onOpenChange,
  onMissingFields,
}: {
  leadId: number
  collectedFields: Record<string, unknown>
  open: boolean
  onOpenChange: (open: boolean) => void
  onMissingFields: (fields: string[]) => void
}) {
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [fieldError, setFieldError] = useState<string | null>(null)
  const mutation = useUpdateLeadFields()

  const editableFields = REQUIRED_FIELDS

  function valueFor(field: string): string {
    if (field in edits) return edits[field]
    const v = collectedFields[field]
    return v == null ? '' : String(v)
  }

  async function handleSave() {
    setFieldError(null)
    const payload: Record<string, unknown> = {}
    for (const field of Object.keys(edits)) {
      const raw = edits[field]
      if (NUMERIC_FIELDS.has(field)) {
        if (raw.trim() === '') continue
        const n = Number(raw)
        if (!Number.isFinite(n)) {
          setFieldError(`${field.replace(/_/g, ' ')} must be a number`)
          return
        }
        payload[field] = n
      } else {
        payload[field] = raw
      }
    }
    if (Object.keys(payload).length === 0) {
      onOpenChange(false)
      return
    }
    try {
      const result = await mutation.mutateAsync({ leadId, fields: payload })
      toast.success('Lead details updated')
      onMissingFields(result.missing_fields)
      onOpenChange(false)
      setEdits({})
    } catch (err) {
      setFieldError(errorMessage(err, 'Failed to update lead details'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setEdits({}); setFieldError(null) } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Qualification Details</DialogTitle>
          <DialogDescription>Update the fields collected for this lead.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {editableFields.map((field) => (
            <div key={field} className="space-y-1.5">
              <Label htmlFor={`field-${field}`} className="capitalize">{field.replace(/_/g, ' ')}</Label>
              <Input
                id={`field-${field}`}
                type={NUMERIC_FIELDS.has(field) ? 'number' : 'text'}
                value={valueFor(field)}
                onChange={(e) => setEdits((prev) => ({ ...prev, [field]: e.target.value }))}
              />
            </div>
          ))}
          {fieldError && <p className="font-utility text-sm text-red-600">{fieldError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [stageDialogOpen, setStageDialogOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [editFieldsOpen, setEditFieldsOpen] = useState(false)
  // Authoritative missing-fields, populated only once the backend has told us
  // (via the fields-editor PATCH response) — never fabricated up front.
  const [confirmedMissingFields, setConfirmedMissingFields] = useState<string[] | null>(null)

  const leadId = parseInt(id, 10)
  const { data: lead, isLoading, error, refetch } = useLead(leadId)
  const copy = useStaffLeadsCopy()
  // The Engineer response has no `customer` key; every other role gets the full shape.
  const full = lead && !isEngineerLeadDetail(lead) ? lead : undefined
  const draftMutation = useDraftProposal()

  const isAdmin = role === 'admin'
  const isSales = role === 'sales'
  const isManagement = role === 'management'
  const canGenerateDraft = isAdmin || isSales
  const canReassign = isAdmin || isManagement
  const ownsOrUnassigned = !full?.assigned_employee_id || full.assigned_employee_id === user?.id
  const canChangeStage = isAdmin || isManagement || (isSales && ownsOrUnassigned)
  const canEditFields = canGenerateDraft || isManagement
  const canStartAssessment = isAdmin || isSales

  const collectedFields = (lead?.collected_fields ?? {}) as Record<string, unknown>
  const heuristicMissing = REQUIRED_FIELDS.filter((f) => !collectedFields[f])
  const missingRequired = confirmedMissingFields ?? heuristicMissing
  const isFullyQualified = missingRequired.length === 0 && lead?.pipeline_stage === 'qualified'

  async function handleGenerateDraft() {
    if (!full?.lead_id || !full?.customer?.id) {
      toast.error('Missing lead or customer data')
      return
    }
    try {
      const result = await draftMutation.mutateAsync({
        lead_id: full.lead_id,
        customer_id: full.customer.id,
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

  if (isLeadNotAssigned(error)) {
    // A Sales user opened a lead that belongs to someone else: say so, not a generic failure.
    return (
      <div>
        <Button variant="ghost" className="mb-4 min-h-11" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {copy.detail.back}
        </Button>
        <div role="alert" data-testid="lead-not-assigned" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-6">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-utility font-medium text-amber-800">{copy.detail.notAssignedTitle}</p>
            <p className="mt-1 font-utility text-sm text-amber-700">{copy.detail.notAssignedBody}</p>
          </div>
        </div>
      </div>
    )
  }

  const is404 = error instanceof LeadApiError && error.status === 404

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
              {error ? (is404 ? copy.detail.notFound : copy.detail.loadFailed) : copy.detail.notFound}
            </p>
            {error && !is404 && <Button variant="outline" className="mt-3 min-h-11" onClick={() => void refetch()}>{copy.common.retry}</Button>}
          </div>
        </div>
      </div>
    )
  }

  if (isEngineerLeadDetail(lead)) {
    // Technical view only: no customer, proposals, timeline, messages or actions.
    const fields = (lead.collected_fields ?? {}) as Record<string, unknown>
    return (
      <div data-testid="engineer-lead-view">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" className="min-h-11" onClick={() => router.back()}>
            <ArrowLeft className="mr-1 h-4 w-4" /> {copy.detail.back}
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#091c3c]">Lead #{lead.lead_id}</h1>
            <Badge variant={stageBadgeVariant(lead.pipeline_stage)} className="mt-1">
              {lead.pipeline_stage.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">{copy.detail.technicalTitle}</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 font-utility text-xs text-[#111827]/65">{copy.detail.technicalNote}</p>
            {Object.keys(fields).length === 0 ? (
              <p className="font-utility text-sm text-[#111827]/65">No fields collected yet</p>
            ) : (
              <dl className="space-y-2">
                {Object.entries(fields).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-sm">
                    <dt className="min-w-[120px] font-utility font-medium capitalize text-[#111827]/60">{key.replace(/_/g, ' ')}</dt>
                    <dd className="font-utility text-[#111827] [overflow-wrap:anywhere]">{String(value ?? '—')}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
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
            <h1 className="font-display text-2xl font-bold text-[#091c3c]">Lead #{lead.lead_id}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={stageBadgeVariant(lead.pipeline_stage)}>
                {lead.pipeline_stage.replace(/_/g, ' ')}
              </Badge>
              <span className="font-utility text-xs text-[#111827]/65">
                {lead.assigned_employee_id ? `Assigned to ${lead.assigned_employee_id}` : 'Unassigned'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-start">
          {canScheduleMeeting(role) && <ScheduleMeetingDialog leadId={lead.lead_id} copy={copy} />}
          {canUseMemory(role) && <ReflectButton leadId={lead.lead_id} copy={copy} />}
          {canChangeStage && (
            <Button variant="outline" size="sm" onClick={() => setStageDialogOpen(true)}>
              <Repeat className="mr-1.5 h-4 w-4" /> Change Stage
            </Button>
          )}
          {canReassign && (
            <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)}>
              Reassign
            </Button>
          )}
          {canEditFields && (
            <Button variant="outline" size="sm" onClick={() => setEditFieldsOpen(true)}>
              <ClipboardEdit className="mr-1.5 h-4 w-4" /> Edit Details
            </Button>
          )}
          {canStartAssessment && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/proposal/new?leadId=${lead.lead_id}`)}>
              <ClipboardCheck className="mr-1.5 h-4 w-4" /> Start Site Assessment
            </Button>
          )}
          {canGenerateDraft && (
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
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Customer info */}
          {lead.customer && (
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

          {/* Project record */}
          {lead.project && (
            <Card>
              <CardHeader><CardTitle className="text-base">Project</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  <div className="flex gap-2 text-sm">
                    <dt className="font-utility font-medium text-[#111827]/60 min-w-[140px]">Reference ID</dt>
                    <dd className="font-utility text-[#111827] font-semibold">{lead.project.reference_id}</dd>
                  </div>
                  {[
                    ['Project type', lead.project.project_type],
                    ['Family', lead.project.project_family],
                    ['State', lead.project.state],
                    ['Location', lead.project.location],
                    ['Roof type', lead.project.roof_type],
                    ['Timeline', lead.project.timeline],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="flex gap-2 text-sm">
                      <dt className="font-utility font-medium text-[#111827]/60 min-w-[140px]">{label}</dt>
                      <dd className="font-utility text-[#111827]">{value}</dd>
                    </div>
                  ))}
                  {lead.project.capacity_kw != null && (
                    <div className="flex gap-2 text-sm">
                      <dt className="font-utility font-medium text-[#111827]/60 min-w-[140px]">Capacity</dt>
                      <dd className="font-utility text-[#111827]">{lead.project.capacity_kw} kW</dd>
                    </div>
                  )}
                  {lead.project.monthly_electricity_bill != null && (
                    <div className="flex gap-2 text-sm">
                      <dt className="font-utility font-medium text-[#111827]/60 min-w-[140px]">Monthly bill</dt>
                      <dd className="font-utility text-[#111827]">{formatCurrency(lead.project.monthly_electricity_bill)}</dd>
                    </div>
                  )}
                  {lead.project.budget != null && (
                    <div className="flex gap-2 text-sm">
                      <dt className="font-utility font-medium text-[#111827]/60 min-w-[140px]">Budget</dt>
                      <dd className="font-utility text-[#111827]">{formatCurrency(lead.project.budget)}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Collected fields */}
          <Card>
            <CardHeader><CardTitle className="text-base">Collected Fields</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(collectedFields).length === 0 ? (
                <p className="font-utility text-sm text-[#111827]/65">No fields collected yet</p>
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
              {confirmedMissingFields && confirmedMissingFields.length > 0 && (
                <p className="mt-3 font-utility text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Still missing: {confirmedMissingFields.join(', ')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Proposals */}
          {lead.proposals && lead.proposals.length > 0 && (
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
          {canUseMemory(role) && lead.customer && (
            <>
              <AskMemoryPanel customerId={lead.customer.id} copy={copy} />
              <CustomerMemoryPanel customerId={lead.customer.id} copy={copy} />
            </>
          )}
          {/* Messages / Conversation */}
          {lead.messages && lead.messages.length > 0 && (
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
                        <span className="font-utility text-[10px] uppercase tracking-wider text-[#111827]/65">
                          {msg.role}
                        </span>
                        <span className="font-utility text-[10px] text-[#111827]/65">
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
          {lead.timeline && lead.timeline.length > 0 && (
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
                        <p className="font-utility text-xs text-[#111827]/65">{formatDatetime(event.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Confirm generate-draft dialog */}
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

      <StageChangeDialog
        leadId={lead.lead_id}
        currentStage={lead.pipeline_stage}
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
      />
      <ReassignDialog
        leadId={lead.lead_id}
        currentAssignee={lead.assigned_employee_id}
        role={role}
        open={reassignOpen}
        onOpenChange={setReassignOpen}
      />
      <EditFieldsDialog
        leadId={lead.lead_id}
        collectedFields={collectedFields}
        open={editFieldsOpen}
        onOpenChange={setEditFieldsOpen}
        onMissingFields={setConfirmedMissingFields}
      />
    </div>
  )
}
