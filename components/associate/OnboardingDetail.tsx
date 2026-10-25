'use client'

import { useState } from 'react'
import { Download, Loader2, Pencil } from 'lucide-react'
import Link from '@/components/i18n/Link'
import {
  useOnboarding,
  useOnboardingProgress,
  useRequestFormalProposal,
  useOnboardingFormalProposal,
  useInPersonAcceptance,
  useOnboardingAgreement,
  useUploadSignedAgreement,
} from '@/lib/associate/onboarding-api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import OnboardingProgressPortal from '@/components/associate/OnboardingProgressPortal'
import { isExecutionStage } from '@/lib/onboarding/progress'
import { useAssociateMe } from '@/lib/associate/api-client'
import LocationDetailCard from '@/components/associate/LocationDetailCard'
import SurveyCard from '@/components/associate/survey/SurveyCard'
import EstimateSection from '@/components/associate/EstimateSection'
import FileUploadSlot from '@/components/associate/FileUploadSlot'
import EstimatedCommissionNote from '@/components/associate/EstimatedCommissionNote'
import { ApiError } from '@/lib/dashboard/api-error'
import { useMessages, useOptionalMessages } from '@/lib/i18n/client'
import { useSurveyStatus } from '@/lib/associate/survey-api-client'
import { isNeedsReverification, proposalGateCode, proposalGateRefuses } from '@/lib/associate/survey-review'
import { formatCurrency, formatDatetime } from '@/lib/dashboard/utils'
import type { Messages } from '@/lib/i18n/types'
import DateField from '@/components/forms/DateField'
import { todayIso } from '@/lib/date-field'

type SharedCopy = Messages['associates']['portal']['shared']
type ProposalCopy = Messages['associates']['portal']['proposal']
type AgreementCopy = Messages['associates']['portal']['agreement']
type ChecklistCopy = Messages['associates']['portal']['checklist']
type ExecutionCopy = Messages['associates']['portal']['execution']
type PaymentsCopy = Messages['associates']['portal']['payments']

function ProposalSection({
  onboardingId,
  copy,
  blocked,
  isOwner,
}: {
  onboardingId: number
  copy: ProposalCopy
  blocked: boolean
  // Requesting a proposal and recording an in-person acceptance are owner-only
  // on the backend: a territory Preferred Associate would only ever get a 403.
  isOwner: boolean
}) {
  const survey = useMessages('survey')
  const surveyStatus = useSurveyStatus(onboardingId)
  const [gate, setGate] = useState<'review_required' | 'survey_not_feasible' | null>(null)
  const { data: formalProposal, isLoading } = useOnboardingFormalProposal(onboardingId)
  const requestMutation = useRequestFormalProposal()
  const acceptMutation = useInPersonAcceptance()
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [deliveredOn, setDeliveredOn] = useState('')
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (isLoading || !formalProposal) return <Loader2 className="h-5 w-5 animate-spin text-[#111827]/65" />

  async function handleAccept() {
    if (!formalProposal || !formalProposal.prepared) return
    setError(null)
    try {
      await acceptMutation.mutateAsync({
        id: onboardingId,
        input: { proposal_id: formalProposal.proposal_id, delivered_on: deliveredOn, note, reference },
      })
      setAcceptOpen(false)
    } catch (err) {
      if (isNeedsReverification(err)) {
        // The associate never sees internal field names — just the plain reason.
        setError(survey.gate.needsReverification)
      } else if (err instanceof ApiError && err.structuredDetail?.code) {
        const code = err.structuredDetail.code as keyof ProposalCopy['acceptance']['errors']
        setError(copy.acceptance.errors[code] ?? err.detail ?? err.message)
      } else {
        setError(err instanceof ApiError ? err.detail || err.message : copy.genericError)
      }
    }
  }

  // not_feasible always blocks. Whether a missing review blocks is a Grid Nova setting the app cannot see,
  // so that case is only shown after the server has refused (below).
  const gateCode = gate ?? (proposalGateRefuses(surveyStatus.data) ? 'survey_not_feasible' : null)
  const gateBlocked = gateCode !== null

  async function requestFormal() {
    setGate(null)
    setError(null)
    try {
      await requestMutation.mutateAsync(onboardingId)
    } catch (err) {
      const g = proposalGateCode(err)
      if (g) setGate(g)
      else setError(err instanceof ApiError ? (typeof err.detail === 'string' && err.detail) || copy.genericError : copy.genericError)
    }
  }

  if (!formalProposal.prepared) {
    return (
      <div>
        <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.detail.notPreparedTitle}</p>
        {formalProposal.missing_fields.length > 0 && (
          <p className="mt-1 text-xs text-[#111827]/65 font-utility">
            {copy.readyMissingFields} {formalProposal.missing_fields.join(', ')}
          </p>
        )}
        {isOwner && (
          <button
            type="button"
            disabled={blocked || requestMutation.isPending || gateBlocked}
            onClick={() => void requestFormal()}
            className="mt-3 min-h-[44px] rounded-lg bg-[#0e2a63] px-4 py-2 text-sm font-semibold text-white font-utility disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]"
          >
            {requestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : copy.requestButton}
          </button>
        )}
        {gateBlocked && (
          <p role="alert" className="mt-2 text-sm text-amber-900 font-utility" data-testid="proposal-gate">
            {survey.gate[gateCode === 'survey_not_feasible' ? 'survey_not_feasible' : 'review_required']}{' '}
            <span className="text-xs">{survey.gate.seeReview}</span>
          </p>
        )}
        {requestMutation.isSuccess && <p className="mt-2 text-xs text-[#111827]/65 font-utility">{copy.requestedNote}</p>}
      </div>
    )
  }

  return (
    <div>
      <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.detail.preparedTitle}</p>
      <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-[#111827]/65">{copy.detail.statusLabel}</dt>
          <dd className="font-utility text-[#111827]/80">{formalProposal.status}</dd>
        </div>
        {formalProposal.total_value != null && (
          <div>
            <dt className="text-xs text-[#111827]/65">{copy.detail.totalValueLabel}</dt>
            <dd className="font-utility text-[#111827]/80">{formatCurrency(formalProposal.total_value)}</dd>
          </div>
        )}
        {formalProposal.date_sent && (
          <div>
            <dt className="text-xs text-[#111827]/65">{copy.detail.dateSentLabel}</dt>
            <dd className="font-utility text-[#111827]/80">{formatDatetime(formalProposal.date_sent)}</dd>
          </div>
        )}
        {formalProposal.accepted_at && (
          <div>
            <dt className="text-xs text-[#111827]/65">{copy.detail.acceptedAtLabel}</dt>
            <dd className="font-utility text-[#111827]/80">{formatDatetime(formalProposal.accepted_at)}</dd>
          </div>
        )}
      </dl>
      {formalProposal.pdf && (
        <div className="mt-2">
          <a
            href={formalProposal.pdf.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#e4e8ee] px-3 text-sm font-semibold text-[#0e2a63] font-utility"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> {copy.detail.pdfLink}
          </a>
          {/* The signed link to the approved PDF the customer receives — read-only. */}
          <p className="mt-1 text-xs text-[#111827]/65 font-utility">{copy.detail.pdfNote}</p>
        </div>
      )}

      {!formalProposal.accepted_at && isOwner && (
        <div className="mt-4">
          <button type="button" onClick={() => setAcceptOpen((o) => !o)} className="rounded-lg border border-[#0e2a63] px-4 py-2 text-sm font-semibold text-[#0e2a63] font-utility">
            {copy.acceptance.title}
          </button>
          {acceptOpen && (
            <div className="mt-3 space-y-3 rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-4">
              <div>
                <label htmlFor="accept-delivered-on" className="mb-1 block text-xs font-utility text-[#111827]/65">{copy.acceptance.deliveredOnLabel}</label>
                <DateField id="accept-delivered-on" label={copy.acceptance.deliveredOnLabel} max={todayIso()} value={deliveredOn} onChange={setDeliveredOn} />
              </div>
              <textarea
                className="w-full rounded-lg border border-[#e4e8ee] px-3 py-2 text-sm font-utility"
                placeholder={copy.acceptance.noteLabel}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-[#e4e8ee] px-3 py-2 text-sm font-utility"
                placeholder={copy.acceptance.referenceLabel}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              {error && <p className="text-xs text-red-600 font-utility">{error}</p>}
              <button
                type="button"
                onClick={() => void handleAccept()}
                disabled={acceptMutation.isPending}
                className="w-full rounded-lg bg-[#0e2a63] px-4 py-2 text-sm font-semibold text-white font-utility disabled:opacity-50"
              >
                {copy.acceptance.submitButton}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AgreementSection({ onboardingId, copy }: { onboardingId: number; copy: AgreementCopy }) {
  const { data: agreement, isLoading } = useOnboardingAgreement(onboardingId)
  const uploadMutation = useUploadSignedAgreement()
  const [file, setFile] = useState<File | null>(null)
  const [stampPaperNumber, setStampPaperNumber] = useState('')
  const [stampPaperDate, setStampPaperDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (isLoading || !agreement) return <Loader2 className="h-5 w-5 animate-spin text-[#111827]/65" />

  async function handleUpload() {
    if (!file) return
    setError(null)
    try {
      await uploadMutation.mutateAsync({ id: onboardingId, input: { file, stamp_paper_number: stampPaperNumber, stamp_paper_date: stampPaperDate } })
      setFile(null)
    } catch (err) {
      if (err instanceof ApiError && err.structuredDetail?.code) {
        const code = err.structuredDetail.code as keyof AgreementCopy['uploadSigned']['errors']
        setError(copy.uploadSigned.errors[code] ?? err.detail ?? err.message)
      } else {
        setError(err instanceof ApiError ? err.detail || err.message : copy.genericError)
      }
    }
  }

  return (
    <div>
      <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.title}</p>
      {!agreement.links.agreement_pdf ? (
        <p className="mt-2 text-sm text-[#111827]/65 font-utility">{copy.notGeneratedNote}</p>
      ) : (
        <>
          <a href={agreement.links.agreement_pdf.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-[#2f5daa] underline">
            {copy.downloadLink}
          </a>
          {!agreement.links.signed_scan && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-[#0e2a63]">{copy.uploadSigned.title}</p>
              <FileUploadSlot
                label={copy.uploadSigned.title}
                why=""
                accept="image/*,application/pdf"
                acceptedTypesLabel="JPG, PNG or PDF"
                file={file}
                onChange={setFile}
                chooseLabel={copy.uploadSigned.submitButton}
                replaceLabel={copy.uploadSigned.submitButton}
                whyLabel=""
              />
              <input
                className="w-full rounded-lg border border-[#e4e8ee] px-3 py-2 text-sm font-utility"
                placeholder={copy.uploadSigned.stampPaperNumberLabel}
                value={stampPaperNumber}
                onChange={(e) => setStampPaperNumber(e.target.value)}
              />
              <div>
                <label htmlFor="stamp-paper-date" className="mb-1 block text-xs font-utility text-[#111827]/65">{copy.uploadSigned.stampPaperDateLabel}</label>
                <DateField id="stamp-paper-date" label={copy.uploadSigned.stampPaperDateLabel} max={todayIso()} value={stampPaperDate} onChange={setStampPaperDate} />
              </div>
              {error && <p className="text-xs text-red-600 font-utility">{error}</p>}
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={!file || uploadMutation.isPending}
                className="w-full rounded-lg bg-[#0e2a63] px-4 py-2 text-sm font-semibold text-white font-utility disabled:opacity-50"
              >
                {copy.uploadSigned.submitButton}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function OnboardingDetail({
  onboardingId,
  portalBase,
  sharedCopy,
  proposalCopy,
  agreementCopy,
  checklistCopy,
  estimateCopy,
  executionCopy,
  paymentsCopy,
  handoverOpen,
}: {
  onboardingId: number
  portalBase: '/associates/portal' | '/preferred/portal'
  sharedCopy: SharedCopy
  proposalCopy: ProposalCopy
  agreementCopy: AgreementCopy
  checklistCopy: ChecklistCopy
  estimateCopy: Messages['associates']['portal']['estimate']
  executionCopy: ExecutionCopy
  paymentsCopy: PaymentsCopy
  // Label of the link to the handover & warranty page (shown once installation has started).
  handoverOpen?: string
}) {
  const { data: onboarding, isLoading, error, refetch } = useOnboarding(onboardingId)
  const { data: progress } = useOnboardingProgress(onboardingId)
  const { data: me } = useAssociateMe()
  // Payments are owner-only (a Preferred Associate gets 403 on a downline customer's), so only the owner is offered them.
  const isOwner = !!me && !!onboarding && onboarding.owner.associate_id === me.associate_id
  const acceptedRecorded = !!progress?.stages.some((st) => st.stage === 'accepted' && st.recorded)
  const ease = useOptionalMessages('portalEase')

  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (isLoading || !onboarding) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#111827]/65" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">{onboarding.customer.name}</h1>
          <p className="mt-1 text-sm text-[#111827]/65 font-utility">{onboarding.customer.mobile}</p>
          {/* BE-11: locked from Grid Nova's verification until the project is completed or closed. */}
          {onboarding.attribution.locked && ease && (
            <p data-testid="attribution-locked" className="mt-1 text-sm text-[#0e2a63] font-utility">{ease.attribution.locked}</p>
          )}
        </div>
        {onboarding.can_edit && (
          <Link
            href={`${portalBase}/customers/${onboardingId}/edit`}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#e4e8ee] px-3 py-2 text-sm font-semibold text-[#0e2a63] font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> {sharedCopy.editLink}
          </Link>
        )}
      </div>

      {progress && (
        <div className="rounded-2xl border border-[#e4e8ee] bg-white p-5">
          <OnboardingProgressPortal progress={progress} copy={sharedCopy.progress} />
        </div>
      )}

      {progress && progress.stages.some((st) => isExecutionStage(st.stage)) && (
        <Link
          href={`${portalBase}/customers/${onboardingId}/execution`}
          className="flex min-h-[48px] items-center justify-between rounded-2xl border border-[#e4e8ee] bg-white px-5 py-4 font-display text-base font-semibold text-[#0e2a63]"
        >
          {executionCopy.open}
        </Link>
      )}

      {handoverOpen && progress && progress.stages.some((st) => isExecutionStage(st.stage)) && (
        <Link
          href={`${portalBase}/customers/${onboardingId}/handover`}
          className="flex min-h-[48px] items-center justify-between rounded-2xl border border-[#e4e8ee] bg-white px-5 py-4 font-display text-base font-semibold text-[#0e2a63]"
        >
          {handoverOpen}
        </Link>
      )}

      {isOwner && acceptedRecorded && (
        <Link
          href={`${portalBase}/customers/${onboardingId}/payments`}
          className="flex min-h-[48px] items-center justify-between rounded-2xl border border-[#e4e8ee] bg-white px-5 py-4 font-display text-base font-semibold text-[#0e2a63]"
        >
          {paymentsCopy.open}
        </Link>
      )}

      {onboarding.site_location && (
        <LocationDetailCard
          location={onboarding.site_location}
          isOwner={isOwner}
          editHref={isOwner && onboarding.can_edit ? `${portalBase}/customers/${onboardingId}/edit?step=house` : undefined}
        />
      )}

      <SurveyCard
        onboardingId={onboardingId}
        isOwner={isOwner}
        portalBase={portalBase}
        onboardingStatus={onboarding.status}
        canEdit={!!onboarding.can_edit}
        editHref={isOwner && onboarding.can_edit ? `${portalBase}/customers/${onboardingId}/edit?step=survey` : undefined}
      />

      <div className="rounded-2xl border border-[#e4e8ee] bg-white p-5">
        <p className="font-display text-base font-semibold text-[#0e2a63]">{checklistCopy.title}</p>
        <p className="mt-2 text-xs text-[#111827]/65 font-utility">
          {onboarding.checklist.present.length}/{onboarding.checklist.required.length} {checklistCopy.requiredLabel.toLowerCase()}
        </p>
        {onboarding.checklist.missing.length > 0 && (
          <ul className="mt-2 list-disc list-inside text-xs text-amber-700 font-utility">
            {onboarding.checklist.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </div>

      <EstimatedCommissionNote value={onboarding.estimated_commission} />

      <div className="rounded-2xl border border-[#e4e8ee] bg-white p-5">
        <EstimateSection onboardingId={onboardingId} copy={estimateCopy} />
      </div>

      <div className="rounded-2xl border border-[#e4e8ee] bg-white p-5">
        <ProposalSection onboardingId={onboardingId} copy={proposalCopy} blocked={!!onboarding.formal_proposal_blocked} isOwner={isOwner} />
      </div>

      {/* BE-1 §8: agreement links are owner-only while territory_viewers_see_documents is off
          (its unconfirmed default) — a territory Preferred Associate would only ever get 403. */}
      {isOwner && (
        <div className="rounded-2xl border border-[#e4e8ee] bg-white p-5">
          <AgreementSection onboardingId={onboardingId} copy={agreementCopy} />
        </div>
      )}
    </div>
  )
}
