'use client'

import { ArrowLeft, Check, Circle, Clock } from 'lucide-react'
import Link from '@/components/i18n/Link'
import { DashboardError } from '@/components/dashboard/DashboardError'
import ExecutionEvidenceForm, { Panel } from '@/components/execution/ExecutionEvidenceForm'
import RegisterReadOnly from '@/components/execution/RegisterReadOnly'
import RegisterEntry from '@/components/associate/RegisterEntry'
import RegisterUnitActions from '@/components/associate/RegisterUnitActions'
import { useExecution, useSubmitExecutionStage, useUploadExecutionFile } from '@/lib/associate/execution-api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { formatDatetime } from '@/lib/dashboard/utils'
import type { ExecutionStageStatus, ExecutionStatus } from '@/lib/associate/execution-types'
import type { Messages } from '@/lib/i18n/types'

type Copy = Messages['associates']['portal']['execution']
type PhotosCopy = Messages['associates']['portal']['wizard']['photos']

function StageOverview({ stages, current, copy }: { stages: ExecutionStageStatus[]; current: string | null; copy: Copy }) {
  return (
    <ol className="space-y-2" aria-label={copy.title}>
      {stages.map((s) => (
        <li key={s.stage} className="flex items-center gap-2 text-sm font-utility">
          {s.recorded ? <Check className="h-4 w-4 text-emerald-600" /> : <Circle className={`h-4 w-4 ${s.stage === current ? 'text-[#f7a800]' : 'text-[#111827]/65'}`} />}
          <span className={s.recorded ? 'text-[#111827]' : s.stage === current ? 'font-semibold text-[#0e2a63]' : 'text-[#111827]/65'}>
            {copy.stages[s.stage as keyof Copy['stages']] ?? s.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

function StageForm({
  onboardingId,
  status,
  stage,
  copy,
  photosCopy,
}: {
  onboardingId: number
  status: ExecutionStatus
  stage: ExecutionStageStatus
  copy: Copy
  photosCopy: PhotosCopy
}) {
  const upload = useUploadExecutionFile(onboardingId)
  const submit = useSubmitExecutionStage(onboardingId)
  return (
    <ExecutionEvidenceForm
      scope={`execution-${onboardingId}`}
      status={status}
      stage={stage}
      copy={copy}
      photosCopy={photosCopy}
      uploadFile={(input) => upload.mutateAsync(input)}
      onSubmit={({ text, note }) => submit.mutateAsync({ stage: stage.stage, text, ...(note ? { note } : {}) })}
    />
  )
}

export default function ExecutionChecklist({
  onboardingId,
  portalBase,
  copy,
  photosCopy,
}: {
  onboardingId: number
  portalBase: '/associates/portal' | '/preferred/portal'
  copy: Copy
  photosCopy: PhotosCopy
}) {
  const { data: status, isLoading, error, refetch } = useExecution(onboardingId)

  const back = (
    <Link href={`${portalBase}/customers/${onboardingId}`} className="inline-flex min-h-[44px] items-center gap-1.5 font-utility text-sm font-semibold text-[#0e2a63]">
      <ArrowLeft className="h-4 w-4" /> {copy.backToCustomer}
    </Link>
  )

  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-busy="true">
        {back}
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[#eef1f6]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[#eef1f6]" />
        <span className="sr-only">…</span>
      </div>
    )
  }

  if (error) {
    const notStarted = error instanceof ApiError && error.structuredDetail?.code === 'execution_not_started'
    return (
      <div className="space-y-4">
        {back}
        {notStarted ? (
          <Panel>
            <p className="font-utility text-sm text-[#111827]/70">{copy.notStarted}</p>
          </Panel>
        ) : (
          <DashboardError error={error} onRetry={() => void refetch()} />
        )}
      </div>
    )
  }
  if (!status) return null

  const workStage = status.next_stage_is_execution ? status.stages.find((s) => s.stage === status.next_stage) : undefined
  const pending = status.pending_submission
  const readOnlyReason = status.execution_mode === 'grid_nova' ? copy.gridNova : status.can_submit ? null : copy.readOnly

  // The owner may enter and change serial numbers until Grid Nova verifies the register; a
  // territory reader (can_submit false) and everyone after verification sees it read-only.
  const editable = !!status.can_submit && !!status.register && !status.register.verified_at

  return (
    <div className="space-y-5">
      {back}
      <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>

      {readOnlyReason ? (
        <Panel>
          <p className="font-utility text-sm text-[#111827]/70" data-testid="read-only">{readOnlyReason}</p>
        </Panel>
      ) : pending ? (
        <Panel tone="warn">
          <p className="flex items-center gap-2 font-display text-base font-semibold text-amber-900">
            <Clock className="h-4 w-4" /> {copy.pendingTitle}
          </p>
          <p className="mt-2 text-sm text-amber-900/80">
            {copy.pendingBody.replace('{stage}', copy.stages[pending.stage as keyof Copy['stages']] ?? pending.stage_label)}
          </p>
          <p className="mt-1 text-xs text-amber-900/60">{copy.submittedOn.replace('{date}', formatDatetime(pending.submitted_at))}</p>
        </Panel>
      ) : workStage ? (
        <StageForm key={workStage.stage} onboardingId={onboardingId} status={status} stage={workStage} copy={copy} photosCopy={photosCopy} />
      ) : (
        <Panel tone="ok">
          <p className="font-utility text-sm text-emerald-800">{copy.complete}</p>
        </Panel>
      )}

      <Panel>
        <StageOverview stages={status.stages} current={status.current_stage} copy={copy} />
      </Panel>

      {status.register && (
        <Panel>
          <RegisterReadOnly
            register={status.register}
            copy={copy.register}
            renderUnitActions={editable ? (unit) => <RegisterUnitActions onboardingId={onboardingId} unit={unit} copy={copy.register} /> : undefined}
          />
          {status.register.verified_at && status.can_submit && <p className="mt-3 text-xs text-[#111827]/60" data-testid="register-locked-note">{copy.register.entry.lockedNote}</p>}
        </Panel>
      )}
      {status.register && editable && (
        <Panel>
          <RegisterEntry onboardingId={onboardingId} portalBase={portalBase} copy={copy.register} />
        </Panel>
      )}
    </div>
  )
}
