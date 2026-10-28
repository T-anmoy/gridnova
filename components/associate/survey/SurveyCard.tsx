'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { CheckCircle2, CircleDashed, Download, Loader2 } from 'lucide-react'
import Link from '@/components/i18n/Link'
import { useMessages } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/types'
import { notAuthenticatedError } from '@/lib/api/http'
import { isMissingClaimsError } from '@/lib/dashboard/api-error'
import { useDates } from '@/lib/i18n/dates'
import { fetchSurveyReportLink, useSurveyCorrections, useSurveyResults, useSurveyStatus } from '@/lib/associate/survey-api-client'
import { useOnboardingOptions } from '@/lib/associate/onboarding-api-client'
import { formatKw } from '@/lib/associate/survey'
import { canResignVerified, correctionHref, displayValue, editStepHref, reportErrorText, revisitStep, type ValueCopy } from '@/lib/associate/survey-review'
import type { SurveyCorrection, SurveyReview } from '@/lib/associate/survey-types'
import { MissingClaimsNotice } from '@/components/dashboard/DashboardError'
import { ResignSignatures } from '@/components/associate/survey/SurveyStep'

const linkClass =
  'inline-flex min-h-[44px] items-center rounded-lg px-1 text-sm font-semibold text-[#0e2a63] underline underline-offset-2 font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]'
const outlineLink =
  'mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-[#0e2a63] px-4 text-sm font-semibold text-[#0e2a63] font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]'

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-utility ${ok ? 'bg-[#0e2a63]/10 text-[#0e2a63]' : 'bg-amber-100 text-amber-900'}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </li>
  )
}

const OUTCOME_STYLE: Record<string, string> = {
  feasible: 'bg-green-100 text-green-800',
  feasible_with_conditions: 'bg-blue-100 text-blue-800',
  revisit_needed: 'bg-amber-100 text-amber-900',
  not_feasible: 'bg-red-100 text-red-800',
}

/** The engineer's outcome, conditions and — for a revisit — each item with a link to the step that holds it. */
function ReviewSection({
  review,
  complete,
  onboardingId,
  portalBase,
  isOwner,
  canEdit,
  verified,
}: {
  review: SurveyReview | undefined
  complete: boolean
  onboardingId: number
  portalBase?: string
  isOwner: boolean
  canEdit: boolean
  verified: boolean
}) {
  const { formatDatetime } = useDates()
  const t = useMessages('survey')
  const r = t.review
  const sections = t.status.sections as Record<string, string>
  const fields = t.fields as Record<string, string>
  if (!review || !review.outcome) {
    return complete ? <p className="mt-3 text-sm text-[#111827]/65" data-testid="review-pending">{r.pending}</p> : null
  }
  const outcome = review.outcome
  return (
    <div className="mt-4 space-y-2 rounded-xl border border-[#e4e8ee] p-4" data-testid="survey-review" data-outcome={outcome}>
      <p className="font-utility text-sm font-semibold text-[#0e2a63]">{r.title}</p>
      <p className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold font-utility ${OUTCOME_STYLE[outcome]}`} data-testid="review-outcome">{r.outcomes[outcome]}</span>
        {review.reviewed_at && <span className="text-xs text-[#111827]/65">{fmt(r.reviewedAt, { when: formatDatetime(review.reviewed_at) })}</span>}
      </p>
      {review.revised_after_review && <p className="text-sm text-amber-800" data-testid="review-revised">{r.revisedNote}</p>}
      {outcome === 'not_feasible' && <p className="text-sm text-red-700">{r.notFeasibleNote}</p>}
      {review.notes && (
        <div>
          <p className="text-xs text-[#111827]/65">{r.notesLabel}</p>
          <p className="whitespace-pre-wrap text-sm text-[#111827]/85">{review.notes}</p>
        </div>
      )}
      {review.conditions.length > 0 && (
        <div>
          <p className="text-xs text-[#111827]/65">{r.conditionsTitle}</p>
          <ul className="list-disc pl-5 text-sm text-[#111827]/85">{review.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
      {outcome === 'revisit_needed' && review.revisit_items.length > 0 && !review.revised_after_review && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" role="note" data-testid="revisit-banner">
          <p className="text-sm font-semibold text-amber-900">{r.revisitTitle}</p>
          <p className="text-xs text-amber-900/80">{r.revisitIntro}</p>
          <ul className="mt-2 space-y-2">
            {review.revisit_items.map((it, i) => {
              const step = revisitStep(it.section)
              const name = sections[it.section] ?? it.section.replace(/_/g, ' ')
              const label = it.field ? `${name} › ${fields[it.field] ?? it.field.replace(/_/g, ' ')}` : name
              return (
                <li key={i} className="text-sm text-amber-950" data-testid={`revisit-item-${i}`}>
                  <span className="font-semibold">{label}</span>: {it.note}
                  {isOwner && canEdit && portalBase && (
                    <Link href={editStepHref(portalBase, onboardingId, step)} className={`${linkClass} ml-1`} data-step={step}>
                      {fmt(r.goToStep, { section: name })}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
          {isOwner && verified && portalBase && (
            <div className="mt-2">
              <p className="text-xs text-amber-900/80">{r.correctionVia}</p>
              <Link href={correctionHref(portalBase, onboardingId)} className={linkClass}>
                {r.requestCorrection}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReportButton({ onboardingId, generatedAt }: { onboardingId: number; generatedAt: string }) {
  const { formatDatetime } = useDates()
  const t = useMessages('survey')
  const { getToken } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function open() {
    setBusy(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      // A signed link expires: fetch a fresh one on every click, never keep it.
      const link = await fetchSurveyReportLink(onboardingId, token)
      window.open(link.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(reportErrorText(err, t.report.errors as Record<string, string>))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-3" data-testid="survey-report">
      <button
        type="button"
        onClick={() => void open()}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#0e2a63] px-4 text-sm font-semibold text-[#0e2a63] font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] disabled:opacity-50"
      >
        <Download className="h-4 w-4" aria-hidden="true" /> {busy ? t.report.opening : t.report.download}
      </button>
      <p className="mt-1 text-xs text-[#111827]/65">{fmt(t.report.readyAt, { when: formatDatetime(generatedAt) })}</p>
      <div aria-live="polite">{error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}</div>
    </div>
  )
}

export function CorrectionHistory({ items }: { items: SurveyCorrection[] }) {
  const { formatDatetime } = useDates()
  const t = useMessages('survey')
  const c = t.corrections
  const roof = t.roof
  const copy: ValueCopy = {
    yes: t.card.yes,
    no: t.card.no,
    fields: t.fields as Record<string, string>,
    maps: {
      roofMaterials: t.roofMaterials,
      orientations: roof.orientations,
      phases: t.phases,
      shading: t.shading,
      nocStatuses: t.nocStatuses,
      inverterLocations: t.layout.inverterLocations,
      methods: t.layout.methods,
      variants: t.connection.variants,
      obstacles: roof.obstacles,
    } as Record<string, Record<string, string>>,
  }
  if (items.length === 0) return null
  return (
    <div className="mt-4" data-testid="correction-history">
      <p className="font-utility text-sm font-semibold text-[#0e2a63]">{c.title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((it) => (
          <li key={it.correction_id} className="rounded-xl border border-[#e4e8ee] p-3" data-testid={`correction-${it.correction_id}`} data-status={it.status}>
            <p className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${it.status === 'applied' ? 'bg-green-100 text-green-800' : it.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>{c.statuses[it.status]}</span>
              <span className="text-xs text-[#111827]/65">{fmt(c.requestedAt, { when: formatDatetime(it.requested_at) })}</span>
            </p>
            <ul className="mt-1.5 text-sm text-[#111827]/85">
              {Object.entries(it.changes).map(([field, value]) => (
                <li key={field} className="break-words">
                  <span className="font-semibold">{copy.fields[field] ?? field.replace(/_/g, ' ')}</span>: {displayValue(field, value, copy)}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-[#111827]/65">{c.reasonLabel}</p>
            <p className="whitespace-pre-wrap text-sm text-[#111827]/80">{it.reason}</p>
            {it.review_note && (
              <p className="mt-1 text-sm text-[#111827]/80">
                <span className="text-xs text-[#111827]/65">{c.reviewerNote}: </span>
                {it.review_note}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ResignBlock({ onboardingId, status }: { onboardingId: number; status: NonNullable<ReturnType<typeof useSurveyStatus>['data']> }) {
  const options = useOnboardingOptions()
  return <ResignSignatures onboardingId={onboardingId} status={status} maxKb={options.data?.survey.signature_max_kb ?? 500} />
}

/**
 * Survey summary on a customer's detail page: status, signatures, the
 * engineer's review, the report, corrections and the suggested size — never a
 * price. The owner gets the actions (continue, revisit links, request a
 * correction, re-sign, download); a territory Preferred Associate only reads.
 */
export default function SurveyCard({
  onboardingId,
  isOwner,
  editHref,
  portalBase,
  onboardingStatus,
  canEdit,
}: {
  onboardingId: number
  isOwner: boolean
  editHref?: string
  portalBase?: string
  onboardingStatus?: string
  canEdit?: boolean
}) {
  const t = useMessages('survey')
  const c = t.card
  const status = useSurveyStatus(onboardingId)
  const results = useSurveyResults(onboardingId, !!status.data)
  const corrections = useSurveyCorrections(onboardingId)
  const verified = onboardingStatus === 'verified'
  const items = corrections.data?.items ?? []
  const hasPending = items.some((i) => i.status === 'pending')

  return (
    <div className="rounded-2xl border border-[#e4e8ee] bg-white p-5" data-testid="survey-card">
      <p className="font-display text-base font-semibold text-[#0e2a63]">{c.title}</p>
      {status.isLoading ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-[#111827]/60" role="status">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t.status.loading}
        </p>
      ) : isMissingClaimsError(status.error) ? (
        <div className="mt-2">
          <MissingClaimsNotice />
        </div>
      ) : status.error || !status.data ? (
        <div className="mt-2" role="alert">
          <p className="text-sm text-red-700">{t.status.loadError}</p>
          <button type="button" onClick={() => void status.refetch()} className="min-h-[44px] text-sm font-semibold text-[#0e2a63] underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]">
            {t.status.retry}
          </button>
        </div>
      ) : (
        <>
          {(status.data.grandfathered || !status.data.required_to_submit) && (
            <p className="mt-1 text-sm text-[#111827]/65" data-testid="survey-card-not-required">
              {c.notRequired}
            </p>
          )}
          <ul className="mt-3 flex flex-wrap gap-2">
            <Pill ok={status.data.complete}>{status.data.complete ? c.complete : c.incomplete}</Pill>
            <Pill ok={status.data.signatures.customer.signed}>{status.data.signatures.customer.signed ? c.customerSigned : c.customerUnsigned}</Pill>
            <Pill ok={status.data.signatures.associate.signed}>{status.data.signatures.associate.signed ? c.associateSigned : c.associateUnsigned}</Pill>
          </ul>
          {results.data && (
            <p className="mt-3 text-sm text-[#111827]/80" data-testid="survey-card-kw">
              {c.suggestedLabel}:{' '}
              <span className="font-semibold text-[#0e2a63]">{results.data.suggested_kw == null ? '—' : fmt(t.results.kw, { kw: formatKw(results.data.suggested_kw) })}</span>
            </p>
          )}

          {!status.data.grandfathered && status.data.required_to_submit && (
            <ReviewSection
              review={status.data.review}
              complete={status.data.complete}
              onboardingId={onboardingId}
              portalBase={portalBase}
              isOwner={isOwner}
              canEdit={!!canEdit}
              verified={verified}
            />
          )}

          {isOwner && status.data.report?.generated_at && <ReportButton onboardingId={onboardingId} generatedAt={status.data.report.generated_at} />}

          {isOwner && canResignVerified(status.data, onboardingStatus ?? '') && (
            <div className="mt-4 border-t border-[#e4e8ee] pt-4">
              <ResignBlock onboardingId={onboardingId} status={status.data} />
            </div>
          )}

          <CorrectionHistory items={items} />

          {isOwner && verified && portalBase && !status.data.grandfathered && status.data.required_to_submit && (
            hasPending ? (
              <p className="mt-3 text-xs text-[#111827]/60">{t.corrections.pendingBlock}</p>
            ) : (
              <Link href={correctionHref(portalBase, onboardingId)} className={outlineLink} data-testid="request-correction-link">
                {t.review.requestCorrection}
              </Link>
            )
          )}

          {isOwner && editHref ? (
            <Link href={editHref} className={outlineLink}>
              {c.continue}
            </Link>
          ) : !isOwner ? (
            <p className="mt-3 text-xs text-[#111827]/60">{c.readOnlyNote}</p>
          ) : null}
        </>
      )}
    </div>
  )
}
