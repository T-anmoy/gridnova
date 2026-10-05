'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { AlertTriangle, Check, Circle, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import PhotoFlagBadges from '@/components/dashboard/PhotoFlagBadges'
import RegisterPanel from '@/components/dashboard/RegisterPanel'
import ReasonDialog from '@/components/dashboard/ReasonDialog'
import ExecutionEvidenceForm from '@/components/execution/ExecutionEvidenceForm'
import { labelFor } from '@/lib/associate/execution-labels'
import {
  fetchStaffExecutionFileLink,
  useDcrOverride,
  useRecordStage,
  useRejectSubmission,
  useStaffExecution,
  useSwitchExecutionMode,
  useUploadStaffExecutionFile,
  useVerifySubmission,
} from '@/lib/dashboard/execution-api-client'
import { staffExecutionError } from '@/lib/dashboard/execution-errors'
import { STAFF_EXECUTION_COPY, STAFF_PHOTOS_COPY } from '@/lib/dashboard/staff-copy'
import { ApiError } from '@/lib/dashboard/api-error'
import { formatDate, formatDatetime } from '@/lib/dashboard/utils'
import type { ExecutionFile, ExecutionStageStatus, StageSubmission } from '@/lib/associate/execution-types'
import type { StaffExecutionDetail } from '@/lib/dashboard/execution-types'
import type { Role } from '@/lib/dashboard/types'

const copy = STAFF_EXECUTION_COPY
const stageName = (s: { stage: string; label?: string; stage_label?: string }) =>
  copy.stages[s.stage as keyof typeof copy.stages] ?? s.label ?? s.stage_label ?? s.stage

const VIA_LABEL: Record<string, string> = {
  associate_submission: 'Associate submission',
  direct: 'Recorded directly',
  admin_override: 'Admin override',
}

// Evidence maps (slot → file) come either as a map or as a bare list of keys.
function entriesOf(group: Record<string, ExecutionFile> | string[] | undefined, files: Record<string, ExecutionFile>): [string, ExecutionFile | undefined][] {
  if (!group) return []
  return Array.isArray(group) ? group.map((k) => [k, files[k]] as [string, ExecutionFile | undefined]) : Object.entries(group)
}

// Signed links are fetched on click and never cached.
function ViewFile({ onboardingId, file }: { onboardingId: number; file: ExecutionFile }) {
  const { getToken } = useAuth()
  const [error, setError] = useState<string | null>(null)
  async function open() {
    setError(null)
    try {
      const token = await getToken()
      if (!token) return
      const link = await fetchStaffExecutionFileLink(onboardingId, file.file_ref, token)
      window.open(link.url, '_blank', 'noopener')
    } catch (err) {
      setError(staffExecutionError(err))
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => void open()}>
        <ExternalLink className="mr-1 h-3 w-3" /> View
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  )
}

function EvidenceViewer({ onboardingId, detail, submission }: { onboardingId: number; detail: StaffExecutionDetail; submission: StageSubmission }) {
  const docs = entriesOf(submission.evidence.documents, detail.files.documents)
  const photos = entriesOf(submission.evidence.photos, detail.files.photos)
  const text = Object.entries(submission.evidence.text ?? {})
  return (
    <div className="space-y-3 text-sm" data-testid="evidence-viewer">
      {text.length > 0 && (
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {text.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-gray-500">{labelFor(copy.text, k)}</dt>
              <dd className="font-medium text-gray-900">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {docs.length > 0 && (
        <ul className="space-y-1" aria-label="Documents">
          {docs.map(([k, f]) => (
            <li key={k} className="flex flex-wrap items-center gap-2">
              <span className="text-gray-700">{labelFor(copy.documents, k)}</span>
              {f ? <ViewFile onboardingId={onboardingId} file={f} /> : <span className="text-xs text-gray-400">not on file</span>}
            </li>
          ))}
        </ul>
      )}
      {photos.length > 0 && (
        <ul className="space-y-1" aria-label="Photos">
          {photos.map(([k, f]) => (
            <li key={k} className="flex flex-wrap items-center gap-2">
              <span className="text-gray-700">{labelFor(copy.photoSlots, k)}</span>
              {f ? (
                <>
                  <ViewFile onboardingId={onboardingId} file={f} />
                  <PhotoFlagBadges captureMethod={f.capture_method} locationVerified={f.location_verified} flags={f.flags} />
                </>
              ) : (
                <span className="text-xs text-gray-400">not on file</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {submission.evidence.note && <p className="italic text-gray-500">“{submission.evidence.note}”</p>}
    </div>
  )
}

function StageRow({
  stage,
  detail,
  isAdmin,
  onDcrOverride,
}: {
  stage: ExecutionStageStatus
  detail: StaffExecutionDetail
  isAdmin: boolean
  onDcrOverride: () => void
}) {
  const isCurrent = stage.stage === detail.current_stage && !stage.recorded
  const sub = stage.submission
  return (
    <li className="flex gap-3" data-testid={`stage-${stage.stage}`}>
      <div className="mt-0.5 shrink-0">
        {stage.recorded ? <Check className="h-4 w-4 text-green-600" /> : <Circle className={`h-4 w-4 ${isCurrent ? 'text-amber-500' : 'text-gray-300'}`} />}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${stage.recorded ? 'text-gray-900' : isCurrent ? 'text-amber-700' : 'text-gray-400'}`}>
          {stageName(stage)}
          {sub && !stage.recorded && (
            <Badge className="ml-2" variant={sub.status === 'pending' ? 'amber' : 'red'}>
              {sub.status === 'pending' ? 'Awaiting verification' : 'Rejected'}
            </Badge>
          )}
        </p>
        {stage.recorded && (
          <p className="mt-0.5 text-xs text-gray-500">
            {stage.recorded_at && formatDatetime(stage.recorded_at)}
            {stage.recorded_by && ` · by ${stage.recorded_by}`}
            {stage.via && (
              <Badge className="ml-2" variant={stage.via === 'admin_override' ? 'orange' : 'secondary'}>
                {VIA_LABEL[stage.via] ?? stage.via}
              </Badge>
            )}
          </p>
        )}
        {sub?.status === 'rejected' && sub.review_note && <p className="mt-0.5 text-xs text-red-600">Rejected: {sub.review_note}</p>}
        {stage.blockers.map((b) => (
          <p key={b.code} className="mt-1 flex flex-wrap items-center gap-2 text-xs text-amber-700" data-testid={`blocker-${b.code}`}>
            <AlertTriangle className="h-3 w-3" />
            {b.code === 'payment_gate' ? 'On hold: earlier customer payments are not fully verified.' : b.message}
            {b.code === 'dcr_mismatch' && isAdmin && (
              <Button size="sm" variant="outline" onClick={onDcrOverride}>
                Record DCR override
              </Button>
            )}
          </p>
        ))}
      </div>
    </li>
  )
}

export default function ExecutionDetailPanel({ onboardingId, role }: { onboardingId: number; role: Role | undefined }) {
  const { data: d, isLoading, error, refetch } = useStaffExecution(onboardingId)
  const verify = useVerifySubmission(onboardingId)
  const reject = useRejectSubmission(onboardingId)
  const record = useRecordStage(onboardingId)
  const switchMode = useSwitchExecutionMode(onboardingId)
  const dcr = useDcrOverride(onboardingId)
  const upload = useUploadStaffExecutionFile(onboardingId)
  const [dialog, setDialog] = useState<'verify' | 'reject' | 'mode' | 'dcr' | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const isAdmin = role === 'admin'

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    if (error instanceof ApiError && (error.structuredDetail?.code === 'execution_not_started' || error.status === 404)) {
      return (
        <Card>
          <CardContent className="p-6 text-sm text-gray-600" data-testid="execution-unavailable">
            {error.status === 404
              ? 'Installation tracking is not available for this customer.'
              : 'Installation has not started for this customer yet — it begins once the signed agreement is recorded.'}
          </CardContent>
        </Card>
      )
    }
    return <DashboardError error={error} onRetry={() => void refetch()} />
  }
  if (!d) return null

  const pending = d.pending_submission
  const nextStage = d.next_stage_is_execution ? d.stages.find((s) => s.stage === d.next_stage) : undefined
  const stuck = d.aging?.is_stuck
  const attentionFlags = [...d.flags]
  const overrideMode = d.execution_mode === 'associate' && d.can_record && isAdmin
  const directMode = d.execution_mode === 'grid_nova' && d.can_record
  const reviewStage = pending ? d.stages.find((s) => s.stage === pending.stage) : undefined

  return (
    <div className="space-y-4" data-testid="execution-panel">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Installation — {d.customer.name}</CardTitle>
            {d.customer.project_reference_id && <Badge variant="outline">{d.customer.project_reference_id}</Badge>}
            <Badge variant="secondary" data-testid="mode-badge">
              {d.execution_mode === 'grid_nova' ? 'Grid Nova executes' : 'Associate executes'}
            </Badge>
            {stuck && (
              <Badge variant="red" data-testid="stuck-badge">
                Stuck{d.aging ? ` · ${d.aging.days_in_stage} days` : ''}
              </Badge>
            )}
            {attentionFlags.map((f) => (
              <Badge key={f} variant="orange" data-testid={`flag-${f}`}>
                {f === 'dcr_mismatch' ? 'DCR mismatch' : f === 'capacity_mismatch' ? 'Capacity mismatch' : f === 'catalogue_unmatched' ? 'Model not matched' : f.replace(/_/g, ' ')}
              </Badge>
            ))}
            {d.execution_mode === 'associate' && isAdmin && (
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => setDialog('mode')}>
                Switch to Grid Nova mode
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-gray-600">
          {d.customer.site.address && (
            <p>
              {d.customer.site.address}
              {d.customer.site.pin_code ? ` — ${d.customer.site.pin_code}` : ''}
              {d.customer.site.territory ? ` · ${d.customer.site.territory}` : ''}
            </p>
          )}
          {(role === 'operations' || role === 'engineer') && d.customer.site.latitude != null && d.customer.site.longitude != null && (
            // Site-work roles only. A link, never the numbers as text.
            <p data-testid="house-location">
              <span className="text-gray-500">House location (as confirmed by the associate): </span>
              <a
                href={`https://www.google.com/maps?q=${d.customer.site.latitude},${d.customer.site.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 underline"
              >
                <ExternalLink className="h-3 w-3" /> Open in Google Maps
              </a>
            </p>
          )}
          {d.customer.mobile && <p>Customer: {d.customer.mobile}</p>}
          {d.customer.associate && (
            <p>
              Associate: {d.customer.associate.full_name} ({d.customer.associate.associate_type})
              {d.customer.associate.mobile ? ` · ${d.customer.associate.mobile}` : ''}
            </p>
          )}
          {d.started_at && <p className="text-xs text-gray-400">Started {formatDate(d.started_at)}</p>}
        </CardContent>
      </Card>

      {pending && reviewStage?.submission && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Review: {stageName(reviewStage)} <span className="text-xs font-normal text-gray-400">submitted {formatDatetime(pending.submitted_at)} by {pending.submitted_by}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EvidenceViewer onboardingId={onboardingId} detail={d} submission={pending} />
            {d.can_verify && (
              <div className="flex gap-2">
                <Button onClick={() => setDialog('verify')}>Verify</Button>
                <Button variant="outline" onClick={() => setDialog('reject')}>
                  Reject with note
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stages</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {d.stages.map((s) => (
              <StageRow key={s.stage} stage={s} detail={d} isAdmin={isAdmin} onDcrOverride={() => setDialog('dcr')} />
            ))}
          </ol>
        </CardContent>
      </Card>

      {d.register && (
        <RegisterPanel onboardingId={onboardingId} register={d.register} canWrite={role === 'admin' || role === 'operations'} isAdmin={isAdmin} />
      )}

      {!pending && nextStage && (directMode || overrideMode) && (
        <Card>
          <CardContent className="p-6">
            <ExecutionEvidenceForm
              key={nextStage.stage}
              scope={`staff-execution-${onboardingId}`}
              status={d}
              stage={nextStage}
              copy={copy}
              photosCopy={STAFF_PHOTOS_COPY}
              showBlockers={false}
              uploadFile={(input) => upload.mutateAsync(input)}
              mapError={(err) =>
                overrideMode && err instanceof ApiError && err.structuredDetail?.code === 'evidence_missing'
                  ? 'The associate’s evidence for this stage is missing, so it can’t be recorded as it stands. These items are missing:'
                  : staffExecutionError(err)
              }
              renderErrorExtra={(err) =>
                overrideMode && err instanceof ApiError && err.structuredDetail?.code === 'evidence_missing' ? (
                  <div className="mt-3">
                    <p className="mb-2 text-sm">
                      To upload the evidence yourself, switch this project to Grid Nova mode — then Operations or an Admin can upload and record it.
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setDialog('mode')}>
                      Switch this project to Grid Nova mode
                    </Button>
                  </div>
                ) : null
              }
              onSubmit={({ text, note }) =>
                record.mutateAsync({
                  stage: nextStage.stage,
                  text,
                  ...(note ? { note } : {}),
                  ...(overrideMode ? { admin_override_reason: overrideReason.trim() } : {}),
                })
              }
              submitLabel={overrideMode ? 'Record with admin override' : 'Record stage'}
              submittingLabel="Recording…"
              doneMessage="Recorded."
              extraReady={!overrideMode || overrideReason.trim() !== ''}
              extra={
                overrideMode ? (
                  <div>
                    <label htmlFor="override-reason" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Override reason (required — this project is in Associate mode) *
                    </label>
                    <textarea
                      id="override-reason"
                      rows={2}
                      className="w-full rounded-xl border border-[#e4e8ee] px-4 py-3 text-sm"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                    />
                  </div>
                ) : null
              }
            />
          </CardContent>
        </Card>
      )}
      {!pending && nextStage && d.execution_mode === 'associate' && !overrideMode && (
        <p className="text-sm text-gray-500" data-testid="associate-doing-it">
          The associate is doing this step. Operations verifies it once it is submitted; only an Admin can record it directly, with a reason.
        </p>
      )}

      <ReasonDialog
        open={dialog === 'verify'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={pending ? `Verify ${stageName(pending)}` : 'Verify'}
        label="Note (optional)"
        confirmLabel="Verify"
        describeError={staffExecutionError}
        onConfirm={(note) => verify.mutateAsync({ submissionId: pending!.submission_id, note: note || undefined })}
      />
      <ReasonDialog
        open={dialog === 'reject'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={pending ? `Reject ${stageName(pending)}` : 'Reject'}
        description="The associate sees this note and can resubmit."
        label="Note for the associate"
        required
        destructive
        confirmLabel="Reject"
        describeError={staffExecutionError}
        onConfirm={(note) => reject.mutateAsync({ submissionId: pending!.submission_id, note })}
      />
      <ReasonDialog
        open={dialog === 'mode'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Switch to Grid Nova mode"
        description="Grid Nova's team will record every remaining stage directly and the associate can no longer submit. This cannot be switched back."
        label="Reason"
        required
        confirmLabel="Switch mode"
        describeError={staffExecutionError}
        onConfirm={(reason) => switchMode.mutateAsync({ reason })}
      />
      <ReasonDialog
        open={dialog === 'dcr'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Record DCR override"
        description="Some modules are not DCR-compliant. Recording an override lets the subsidy claim go ahead."
        label="Reason"
        required
        confirmLabel="Record override"
        describeError={staffExecutionError}
        onConfirm={(reason) => dcr.mutateAsync({ reason })}
      />
    </div>
  )
}
