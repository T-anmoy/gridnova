'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'
import {
  useStaffOnboarding,
  useStaffOnboardingProgress,
  useVerificationCall,
  useStaffOnboardingEstimates,
  usePrepareFormalProposal,
  useStaffOnboardingFormalProposal,
  useStaffInPersonAcceptance,
  useStaffOnboardingAgreement,
  useGenerateAgreement,
  useUploadStaffSignedAgreement,
} from '@/lib/dashboard/onboarding-api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import OnboardingProgressStaff from '@/components/dashboard/OnboardingProgressStaff'
import { ConfirmLocationPrompt, SiteLocationCard } from '@/components/dashboard/SiteLocationStaff'
import PhotoFlagBadges from '@/components/dashboard/PhotoFlagBadges'
import ExecutionDetailPanel from '@/components/dashboard/ExecutionDetailPanel'
import SurveyPanel from '@/components/dashboard/SurveyPanel'
import StaffPaymentsSection from '@/components/dashboard/StaffPaymentsSection'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'
import { ApiError, wrongAccountOf } from '@/lib/dashboard/api-error'
import { surveyReviewError } from '@/lib/dashboard/survey-review-ui'
import { FormalProposalBlockedBanner } from '@/components/dashboard/FormalProposalBlocked'
import { formatCurrency, formatDatetime } from '@/lib/dashboard/utils'
import type { SiteLocation } from '@/lib/associate/onboarding-types'

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.detail || err.message
  if (err instanceof Error) return err.message
  return fallback
}

function VerificationCallSection({ onboardingId, verification, siteLocation }: { onboardingId: number; siteLocation?: SiteLocation; verification: { completed: boolean; verified_at: string | null; note?: string; verified_by_employee_id?: string } }) {
  const [note, setNote] = useState('')
  const mutation = useVerificationCall()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verification call</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {verification.completed ? (
          <div className="flex items-start gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 mt-0.5" />
            <div>
              <p>Completed {formatDatetime(verification.verified_at)}</p>
              {verification.verified_by_employee_id && <p className="text-xs text-gray-500">by {verification.verified_by_employee_id}</p>}
              {verification.note && <p className="mt-1 text-gray-600 italic">&quot;{verification.note}&quot;</p>}
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">Not yet completed.</p>
            <ConfirmLocationPrompt location={siteLocation} />
            <Textarea placeholder="Call note" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button
              size="sm"
              disabled={mutation.isPending}
              onClick={async () => {
                try {
                  await mutation.mutateAsync({ id: onboardingId, input: { verification_call_completed: true, note } })
                  toast.success('Verification call recorded')
                } catch (err) {
                  toast.error(errorMessage(err, 'Failed to record verification call'))
                }
              }}
            >
              Mark call completed
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ScoreSection({ score }: { score: NonNullable<ReturnType<typeof useStaffOnboarding>['data']>['score'] }) {
  if (!score) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Score: {score.score} — {score.band}</span>
          {score.escalation_level != null && score.escalation_level > 0 && <Badge variant="red">Escalation level {score.escalation_level}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {score.factors.map((f) => (
          <div key={f.code} className="flex items-center justify-between text-sm">
            <span className="text-gray-700">{f.label}</span>
            <span className="text-gray-500">
              {(f.earned_fraction * 100).toFixed(0)}% of {(f.weight * 100).toFixed(0)}%
            </span>
          </div>
        ))}
        {score.response_due_at && <p className="text-xs text-gray-500 mt-2">Response due {formatDatetime(score.response_due_at)}</p>}
      </CardContent>
    </Card>
  )
}

function FormalProposalSection({ onboardingId, blocked }: { onboardingId: number; blocked: boolean }) {
  const { data: fp, isLoading } = useStaffOnboardingFormalProposal(onboardingId)
  const prepareMutation = usePrepareFormalProposal()
  const acceptMutation = useStaffInPersonAcceptance()
  const [email, setEmail] = useState('')
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [deliveredOn, setDeliveredOn] = useState('')
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')

  async function handlePrepare() {
    try {
      await prepareMutation.mutateAsync({ id: onboardingId, input: email ? { customer_email: email } : undefined })
      toast.success('Formal proposal prepared')
    } catch (err) {
      toast.error(err instanceof ApiError && err.structuredDetail ? surveyReviewError(err, 'Failed to prepare formal proposal') : errorMessage(err, 'Failed to prepare formal proposal'))
    }
  }

  async function handleAccept() {
    if (!fp?.prepared) return
    try {
      await acceptMutation.mutateAsync({ id: onboardingId, input: { proposal_id: fp.proposal_id, delivered_on: deliveredOn, note, reference } })
      toast.success('In-person acceptance recorded')
      setAcceptOpen(false)
    } catch (err) {
      toast.error(err instanceof ApiError && err.structuredDetail ? surveyReviewError(err, 'Failed to record acceptance') : errorMessage(err, 'Failed to record acceptance'))
    }
  }

  if (isLoading || !fp) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Formal proposal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!fp.prepared ? (
          <>
            <p className="text-sm text-gray-500">Not prepared yet.</p>
            {fp.missing_fields.length > 0 && <p className="text-xs text-amber-700">Missing: {fp.missing_fields.join(', ')}</p>}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Customer email (optional — fixes missing email and retries in one step)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" />
              </div>
              <Button disabled={blocked === false && prepareMutation.isPending} onClick={() => void handlePrepare()}>
                {prepareMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Prepare formal proposal'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Status</dt>
                <dd>{fp.status}</dd>
              </div>
              {fp.total_value != null && (
                <div>
                  <dt className="text-xs text-gray-500">Total value</dt>
                  <dd>{formatCurrency(fp.total_value)}</dd>
                </div>
              )}
              {fp.date_sent && (
                <div>
                  <dt className="text-xs text-gray-500">Sent</dt>
                  <dd>{formatDatetime(fp.date_sent)}</dd>
                </div>
              )}
              {fp.accepted_at && (
                <div>
                  <dt className="text-xs text-gray-500">Accepted</dt>
                  <dd>{formatDatetime(fp.accepted_at)}</dd>
                </div>
              )}
            </dl>
            {fp.pdf && (
              <a href={fp.pdf.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
                View PDF
              </a>
            )}
            {!fp.accepted_at && (
              <div>
                <Button size="sm" variant="outline" onClick={() => setAcceptOpen((o) => !o)}>
                  Record in-person acceptance
                </Button>
                {acceptOpen && (
                  <div className="mt-3 space-y-2 rounded-lg border border-gray-200 p-3">
                    <Input type="date" value={deliveredOn} onChange={(e) => setDeliveredOn(e.target.value)} placeholder="Delivered on" />
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required)" />
                    <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference (required)" />
                    <Button size="sm" disabled={acceptMutation.isPending} onClick={() => void handleAccept()}>
                      Confirm acceptance
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AgreementSection({ onboardingId }: { onboardingId: number }) {
  const { data: agreement, isLoading } = useStaffOnboardingAgreement(onboardingId)
  const generateMutation = useGenerateAgreement()
  const uploadMutation = useUploadStaffSignedAgreement()
  const [file, setFile] = useState<File | null>(null)
  const [stampPaperNumber, setStampPaperNumber] = useState('')
  const [stampPaperDate, setStampPaperDate] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)

  if (isLoading || !agreement) return null
  const links = agreement.links

  async function handleUpload() {
    if (!file) return
    setUploadError(null)
    try {
      await uploadMutation.mutateAsync({
        id: onboardingId,
        input: { file, stamp_paper_number: stampPaperNumber, stamp_paper_date: stampPaperDate },
      })
      setFile(null)
      setStampPaperNumber('')
      setStampPaperDate('')
      toast.success('Signed agreement uploaded')
    } catch (err) {
      setUploadError(errorMessage(err, 'Failed to upload the signed agreement'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agreement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!links?.agreement_pdf ? (
          <Button size="sm" disabled={generateMutation.isPending} onClick={() => generateMutation.mutate(onboardingId)}>
            Generate agreement
          </Button>
        ) : (
          <>
            <a href={links.agreement_pdf.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
              View agreement
            </a>
            {links.signed_scan ? (
              <a href={links.signed_scan.url} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 underline">
                View signed scan
              </a>
            ) : (
              <>
                <div>
                  <Button size="sm" variant="outline" disabled={generateMutation.isPending} onClick={() => generateMutation.mutate(onboardingId)}>
                    Regenerate
                  </Button>
                </div>
                <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                  <Label className="text-xs">Signed scan</Label>
                  <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <Input placeholder="Stamp paper number" value={stampPaperNumber} onChange={(e) => setStampPaperNumber(e.target.value)} />
                  <Input type="date" value={stampPaperDate} onChange={(e) => setStampPaperDate(e.target.value)} />
                  {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
                  <Button size="sm" disabled={!file || uploadMutation.isPending} onClick={() => void handleUpload()}>
                    {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload signed scan'}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function StaffOnboardingDetailPage() {
  const params = useParams<{ id: string }>()
  const onboardingId = Number(params.id)
  const { data: onboarding, isLoading, error, refetch } = useStaffOnboarding(onboardingId)
  const { data: progress } = useStaffOnboardingProgress(onboardingId)
  const { data: estimates } = useStaffOnboardingEstimates(onboardingId)
  const { role } = useStaffRole()
  const stageRecorded = (stage: string) => !!progress?.stages.some((st) => st.stage === stage && st.recorded)

  // Operations, engineers and Accounts follow email links here but may not read the
  // sales-side customer record: show them just the part of the project they own.
  if (error) {
    const forbidden = error instanceof ApiError && error.status === 403 && !wrongAccountOf(error)
    if (forbidden && (role === 'operations' || role === 'engineer' || role === 'accounts')) {
      return (
        <div className="p-6 md:p-8 space-y-6 max-w-4xl" data-testid="reduced-project-view">
          <h1 className="text-2xl font-bold text-[#091c3c]">Project #{onboardingId}</h1>
          {role === 'engineer' && <SurveyPanel onboardingId={onboardingId} role={role} />}
          {role === 'accounts' ? (
            <StaffPaymentsSection onboardingId={onboardingId} role={role} />
          ) : (
            <ExecutionDetailPanel onboardingId={onboardingId} role={role} />
          )}
        </div>
      )
    }
    return <div className="p-8"><DashboardError error={error} onRetry={() => void refetch()} /></div>
  }
  if (isLoading || !onboarding) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-[#091c3c]">{onboarding.customer.name}</h1>
          <Badge variant="gray">{onboarding.status}</Badge>
        </div>
        <p className="text-sm text-gray-500 mt-1">{onboarding.customer.mobile}{onboarding.customer.email && ` · ${onboarding.customer.email}`}</p>
        <p className="text-sm text-gray-500 mt-1">
          {onboarding.territory.state.name}
          {onboarding.territory.district && `, ${onboarding.territory.district.name}`}
          {onboarding.territory.block && `, ${onboarding.territory.block.name}`}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Owning associate: <span className="font-medium text-gray-700">{onboarding.owner.full_name}</span> ({onboarding.owner.associate_type})
        </p>
      </div>

      {onboarding.formal_proposal_blocked && <FormalProposalBlockedBanner blocked={onboarding.formal_proposal_blocked} />}

      {onboarding.attribution.under_review && (
        <div className="rounded-lg border border-purple-300 bg-purple-50 p-3 text-sm text-purple-800">
          Under attribution review — see the{' '}
          <Link href="/dashboard/attribution-flags" className="underline">
            attribution flags
          </Link>{' '}
          view.
        </div>
      )}

      <VerificationCallSection onboardingId={onboardingId} verification={onboarding.verification} siteLocation={onboarding.site_location} />

      <SiteLocationCard onboardingId={onboardingId} location={onboarding.site_location} role={role} />

      <SurveyPanel onboardingId={onboardingId} role={role} />

      <ScoreSection score={onboarding.score} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents & photos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            {onboarding.checklist.present.length}/{onboarding.checklist.required.length} required items on file.
          </p>
          {onboarding.checklist.missing.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-sm text-amber-700">
              {onboarding.checklist.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {onboarding.photos.length > 0 && (
            <ul className="mt-3 space-y-2" aria-label="Photos">
              {onboarding.photos.map((p) => (
                <li key={p.file_ref} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-gray-700">{p.photo_slot ?? p.filename}</span>
                  <PhotoFlagBadges captureMethod={p.capture_method} locationVerified={p.location_verified} flags={p.flags} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {stageRecorded('agreement_signed') && role && role !== 'accounts' && <ExecutionDetailPanel onboardingId={onboardingId} role={role} />}

      {stageRecorded('accepted') && <StaffPaymentsSection onboardingId={onboardingId} role={role} />}

      {estimates && estimates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estimates (read-only)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {estimates.map((e) => (
              <div key={e.estimate_id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
                <span>{e.result.recommended_size_kw} kW</span>
                <span className="text-gray-500">
                  {e.result.is_indicative_range
                    ? `${formatCurrency(e.result.net_cost_range_min)} – ${formatCurrency(e.result.net_cost_range_max)}`
                    : formatCurrency(e.result.net_cost)}
                </span>
                <span className="text-xs text-gray-500">{formatDatetime(e.created_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <FormalProposalSection onboardingId={onboardingId} blocked={!!onboarding.formal_proposal_blocked} />

      <AgreementSection onboardingId={onboardingId} />

      {progress && <OnboardingProgressStaff progress={progress} />}
    </div>
  )
}
