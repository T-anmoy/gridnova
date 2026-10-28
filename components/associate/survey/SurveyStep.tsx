'use client'

import { useId, useRef, useState, useSyncExternalStore } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, WifiOff } from 'lucide-react'
import { useMessages, useOptionalMessages } from '@/lib/i18n/client'
import { fmt, type Messages } from '@/lib/i18n/types'
import { formatInr } from '@/lib/money'
import { useDates } from '@/lib/i18n/dates'
import { ApiError, isMissingClaimsError } from '@/lib/dashboard/api-error'
import { useSignSurvey, useSurveyResults, useSurveyStatus } from '@/lib/associate/survey-api-client'
import { formatKw, stepOfSection, surveyWarningText, type SurveyStepKey } from '@/lib/associate/survey'
import type { SignatureErrorCode, SignatureParty, SurveyOptions, SurveyResults, SurveyStatus } from '@/lib/associate/survey-types'
import SignaturePad, { type SignaturePadHandle } from '@/components/associate/SignaturePad'
import { FieldError, FormField, inputClass } from '@/components/associate/wizard-fields'
import { MissingClaimsNotice } from '@/components/dashboard/DashboardError'
import { SolarEstimateWithCatalogue } from '@/components/pricing/SolarEstimateResult'
import { fromSurveyEstimate } from '@/lib/pricing/solar-estimate'

type SurveyCopy = Messages['survey']

const btnPrimary =
  'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0e2a63] px-5 text-sm font-semibold text-white font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] disabled:opacity-50'
const btnLink =
  'inline-flex min-h-[44px] items-center rounded-lg px-1 text-sm font-semibold text-[#0e2a63] underline underline-offset-2 font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]'

const SIGNATURE_CODES: readonly SignatureErrorCode[] = [
  'file_too_large',
  'declaration_name_required',
  'confirmation_required',
  'signature_not_png',
  'not_editable',
  'storage_not_configured',
]

/** A plain, translated sentence for a failed signature upload (§5). */
export function signatureErrorText(err: unknown, t: SurveyCopy, maxKb: number, missingClaims?: string, offline?: string): string {
  const e = t.signatures.errors
  if (isMissingClaimsError(err)) return missingClaims ?? e.generic
  if (!(err instanceof ApiError)) return e.generic
  if (err.status === 0) return offline ?? e.generic
  const code = typeof err.structuredDetail?.code === 'string' ? (err.structuredDetail.code as string) : null
  // The upload middleware refuses an oversize body with a plain 413 before the route runs.
  if (err.status === 413 || code === 'file_too_large') {
    const kb = typeof err.structuredDetail?.max_kb === 'number' ? (err.structuredDetail.max_kb as number) : maxKb
    return fmt(e.file_too_large, { max_kb: kb })
  }
  if (code && (SIGNATURE_CODES as readonly string[]).includes(code)) return e[code as SignatureErrorCode] as string
  return e.generic
}

// ── Checklist (§3) ────────────────────────────────────────────────────────

export function SurveyChecklist({
  status,
  onGoToStep,
}: {
  status: SurveyStatus
  onGoToStep?: (step: SurveyStepKey) => void
}) {
  const t = useMessages('survey')
  const s = t.status
  const exempt = status.grandfathered || !status.required_to_submit
  return (
    <div data-testid="survey-checklist">
      <p className="font-display text-base font-semibold text-[#0e2a63]">{s.title}</p>
      {exempt && <p className="mt-1 text-sm text-[#111827]/65" data-testid="survey-not-required">{s.notRequired}</p>}
      {!exempt && status.complete && <p className="mt-1 text-sm text-[#0e2a63]">{s.allComplete}</p>}
      <ul className="mt-3 space-y-2">
        {status.sections.map((sec) => {
          const step = stepOfSection(sec.key, sec.missing)
          const name = (s.sections as Record<string, string>)[sec.key] ?? sec.key
          return (
            <li key={sec.key} className="rounded-xl border border-[#e4e8ee] px-3 py-2.5" data-testid={`survey-section-${sec.key}`} data-complete={sec.complete}>
              <div className="flex items-start gap-2.5">
                {sec.complete ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0e2a63]" aria-hidden="true" />
                ) : (
                  <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-utility text-sm font-semibold text-[#111827]/85">
                    {name} <span className="sr-only">— </span>
                    <span className={`ml-1 text-xs font-normal ${sec.complete ? 'text-[#0e2a63]' : 'text-amber-700'}`}>{sec.complete ? s.complete : s.missing}</span>
                  </p>
                  {sec.key === 'bills' && typeof sec.months_required === 'number' && (
                    <p className="text-xs text-[#111827]/60">{fmt(s.monthsRecorded, { recorded: sec.months_recorded ?? 0, required: sec.months_required })}</p>
                  )}
                  {!sec.complete && sec.missing.length > 0 && (
                    <p className="mt-0.5 text-xs text-[#111827]/60 break-words">
                      {fmt(s.missingFields, { fields: sec.missing.map((f) => (t.fields as Record<string, string>)[f] ?? f).join(', ') })}
                    </p>
                  )}
                  {!sec.complete && step && onGoToStep && (
                    <button type="button" className={btnLink} onClick={() => onGoToStep(step)}>
                      {fmt(s.goTo, { section: name })}
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Live results (§4) ─────────────────────────────────────────────────────

export function SurveyResultsPanel({ results }: { results: SurveyResults }) {
  const t = useMessages('survey')
  const pricing = useMessages('pricing')
  const r = t.results
  const warningCopy = {
    warnings: t.warnings as Record<string, string>,
    limiting: r.limiting as Record<string, string>,
    fields: t.fields as Record<string, string>,
    roofMaterials: t.roofMaterials as Record<string, string>,
    nocStatuses: t.nocStatuses as Record<string, string>,
    areaReasons: t.areaReasons as Record<string, string>,
  }
  const est = results.estimate
  // BE-14: the same result the website and the associate estimate show.
  const solar = est ? fromSurveyEstimate(est as unknown as Record<string, unknown>) : null
  return (
    <div className="space-y-4" data-testid="survey-results" aria-live="polite">
      <div>
        <p className="font-display text-base font-semibold text-[#0e2a63]">{r.title}</p>
        {results.suggested_kw == null ? (
          <p className="mt-1 text-sm text-[#111827]/65" data-testid="survey-not-enough">{r.notEnough}</p>
        ) : (
          <div className="mt-2 rounded-xl bg-[#f7f9fc] p-4">
            <p className="text-xs text-[#111827]/65 font-utility">{r.suggestedLabel}</p>
            <p className="font-display text-2xl font-bold text-[#0e2a63]" data-testid="suggested-kw">{fmt(r.kw, { kw: formatKw(results.suggested_kw) })}</p>
            {results.limiting_factor && (
              <p className="mt-0.5 text-sm text-[#111827]/70">
                {r.limitingLabel}: {r.limiting[results.limiting_factor]}
              </p>
            )}
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              {([
                [r.byArea, results.max_by_area_kw],
                [r.byLoad, results.max_by_load_kw],
                [r.byUsage, results.recommended_by_usage_kw],
              ] as const).map(([label, v]) => (
                <div key={label}>
                  <dt className="text-xs text-[#111827]/65">{label}</dt>
                  <dd className="font-utility text-[#111827]/85">{v == null ? '—' : fmt(r.kw, { kw: formatKw(v) })}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {results.warnings.length > 0 && (
        <div>
          <p className="font-utility text-sm font-semibold text-[#0e2a63]">{r.warningsTitle}</p>
          <ul className="mt-2 space-y-2">
            {results.warnings.map((w, i) => (
              <li key={`${w.code}-${i}`} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5" data-testid={`survey-warning-${w.code}`}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <p className="text-sm text-amber-900 leading-relaxed">{surveyWarningText(w, warningCopy)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {solar ? (
        <div className="rounded-xl border border-[#e4e8ee] p-4" data-testid="survey-estimate" data-status={solar.price_status}>
          <p className="font-utility text-sm font-semibold text-[#0e2a63]">{r.estimateTitle}</p>
          <p className="mt-0.5 mb-3 text-xs font-semibold uppercase tracking-wide text-[#7a5200]">{r.indicativeNote}</p>
          <SolarEstimateWithCatalogue estimate={solar} />
        </div>
      ) : est && (
        <div className="rounded-xl border border-[#e4e8ee] p-4" data-testid="survey-estimate" data-status={est.price_status}>
          <p className="font-utility text-sm font-semibold text-[#0e2a63]">{r.estimateTitle}</p>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-[#7a5200]">{r.indicativeNote}</p>
          {est.price_status === 'list_price' && (
            <>
              {est.size_kw != null && <p className="mt-2 text-sm text-[#111827]/70">{fmt(r.forSize, { kw: formatKw(est.size_kw) })}</p>}
              <ul className="mt-2 space-y-2">
                {Object.entries(est.packages).map(([key, pkg]) => (
                  <li key={key} className="rounded-lg bg-[#f7f9fc] px-3 py-2.5">
                    <p className="font-utility text-sm font-semibold text-[#0e2a63]">{pkg.display_name}</p>
                    <p className="text-sm text-[#111827]/80">
                      {pricing.price.final}: <span className="font-semibold">{formatInr(pkg.final)}</span>
                    </p>
                    {pkg.net_after_subsidy && (
                      <p className="text-sm text-[#111827]/70">
                        {pricing.subsidy.net}: {formatInr(pkg.net_after_subsidy)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {est.subsidy_inr && <p className="mt-2 text-sm text-[#111827]/75">{fmt(pricing.subsidy.amount, { amount: formatInr(est.subsidy_inr) })}</p>}
              {est.subsidy_conditions && est.subsidy_conditions.length > 0 && (
                <div className="mt-1">
                  <p className="text-xs text-[#111827]/60">{pricing.subsidy.conditionsLead}</p>
                  <ul className="list-disc pl-5 text-xs text-[#111827]/60">
                    {est.subsidy_conditions.map((c) => (
                      <li key={c}>{(pricing.subsidy.conditions as Record<string, string>)[c] ?? t.warnings.unknown}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {est.price_status === 'custom_quote' && (
            <div className="mt-2">
              <p className="text-sm text-[#111827]/80">{r.customQuote}</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-[#111827]/60">
                {est.custom_quote_reasons.map((c) => (
                  <li key={c}>{(pricing.customQuote.reasons as Record<string, string>)[c] ?? pricing.customQuote.reasons.other}</li>
                ))}
              </ul>
            </div>
          )}
          {est.price_status === 'not_enough_to_size' && <p className="mt-2 text-sm text-[#111827]/70">{r.notEnoughToPrice}</p>}
        </div>
      )}
    </div>
  )
}

// ── Signatures (§5) ───────────────────────────────────────────────────────

export function SignatureBlock({
  party,
  onboardingId,
  status,
  maxKb,
  online,
}: {
  party: SignatureParty
  onboardingId: number
  status: SurveyStatus
  maxKb: number
  online: boolean
}) {
  const { formatDatetime } = useDates()
  const t = useMessages('survey')
  const sig = t.signatures
  const missingClaims = useOptionalMessages('portalErrors')?.missingClaims?.body
  const sign = useSignSurvey()
  const padRef = useRef<SignaturePadHandle>(null)
  const [name, setName] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; confirm?: string; pad?: string; form?: string }>({})
  const [resigning, setResigning] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const baseId = useId()
  const padId = `${party}-signature`
  const padErrorId = `${baseId}-pad-error`
  const state = status.signatures[party]
  const showPad = !state.signed || resigning

  async function save() {
    setSavedNote(false)
    const next: typeof errors = {}
    if (party === 'customer') {
      if (!name.trim()) next.name = sig.errors.declaration_name_required
      if (!confirmed) next.confirm = sig.errors.confirmation_required
    }
    if (padRef.current?.isEmpty() !== false) next.pad = sig.emptyPad
    setErrors(next)
    if (Object.keys(next).length) return
    if (!online) {
      setErrors({ form: sig.offline })
      return
    }
    const png = await padRef.current!.toPng(maxKb * 1024)
    if (!png) {
      setErrors({ pad: sig.tooLargeLocal })
      return
    }
    try {
      await sign.mutateAsync({
        id: onboardingId,
        input: party === 'customer' ? { party, file: png, declaration_name: name.trim(), customer_confirms_data: true } : { party, file: png },
      })
      setResigning(false)
      setSavedNote(true)
      padRef.current?.clear()
    } catch (err) {
      const code = err instanceof ApiError ? err.structuredDetail?.code : undefined
      const text = signatureErrorText(err, t, maxKb, missingClaims, sig.offline)
      if (code === 'declaration_name_required') setErrors({ name: text })
      else if (code === 'confirmation_required') setErrors({ confirm: text })
      else setErrors({ form: text })
    }
  }

  return (
    <div className="rounded-xl border border-[#e4e8ee] p-4 space-y-3" data-testid={`signature-${party}`} data-signed={state.signed}>
      <p className="font-utility text-sm font-semibold text-[#0e2a63]">{party === 'customer' ? sig.customerTitle : sig.associateTitle}</p>
      {state.signed && (
        <p className="flex items-center gap-1.5 text-sm text-[#0e2a63]" data-testid={`signed-${party}`}>
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {party === 'customer' && status.declaration.name
            ? fmt(sig.signedByAt, { name: status.declaration.name, when: formatDatetime(state.signed_at) })
            : fmt(sig.signedAt, { when: formatDatetime(state.signed_at) })}
        </p>
      )}
      {state.signed && !resigning && (
        <button type="button" className={btnLink} onClick={() => setResigning(true)}>
          {sig.signAgain}
        </button>
      )}
      {showPad && (
        <>
          {party === 'customer' && (
            <>
              <FormField label={sig.declarationNameLabel} error={errors.name} required>
                {(p) => <input {...p} name="declaration_name" maxLength={200} autoComplete="off" className={inputClass(!!errors.name)} value={name} onChange={(e) => setName(e.target.value)} />}
              </FormField>
              <div>
                <label className="flex min-h-[44px] items-start gap-3 py-2 font-utility text-base text-[#111827]/85">
                  <input
                    type="checkbox"
                    name="customer_confirms_data"
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#c9d2de] accent-[#0e2a63]"
                    checked={confirmed}
                    aria-invalid={errors.confirm ? true : undefined}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  {sig.confirmLabel}
                </label>
                {errors.confirm && <FieldError message={errors.confirm} />}
              </div>
            </>
          )}
          <SignaturePad
            ref={padRef}
            id={padId}
            label={sig.padLabel}
            hint={sig.padHint}
            clearLabel={sig.clear}
            invalid={!!errors.pad}
            describedBy={errors.pad ? padErrorId : undefined}
            onInkChange={(ink) => ink && setErrors((e) => ({ ...e, pad: undefined }))}
          />
          {errors.pad && <FieldError id={padErrorId} message={errors.pad} />}
          {errors.form && (
            <p role="alert" className="text-sm text-red-700 font-utility">
              {errors.form}
            </p>
          )}
          <button type="button" className={btnPrimary} onClick={() => void save()} disabled={sign.isPending}>
            {sign.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {sig.saving}
              </>
            ) : party === 'customer' ? (
              sig.signCustomer
            ) : (
              sig.signAssociate
            )}
          </button>
        </>
      )}
      <p className="sr-only" aria-live="polite">
        {savedNote ? sig.saved : ''}
      </p>
      {savedNote && <p className="text-sm text-[#0e2a63]">{sig.saved}</p>}
    </div>
  )
}

/**
 * The wizard's survey step: checklist with deep links, live sizing and the
 * indicative price, then both signatures. Signatures need a connection and are
 * never queued on the phone.
 */
export default function SurveyStep({
  onboardingId,
  options,
  onGoToStep,
  online,
}: {
  onboardingId: number | undefined
  options: SurveyOptions
  onGoToStep: (step: SurveyStepKey) => void
  online: boolean
}) {
  const t = useMessages('survey')
  const statusQ = useSurveyStatus(onboardingId)
  const resultsQ = useSurveyResults(onboardingId)

  if (!onboardingId) return <p className="text-sm text-[#111827]/65">{t.status.notCreated}</p>

  return (
    <div className="space-y-6" data-testid="survey-step">
      {statusQ.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-[#111827]/60" role="status">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t.status.loading}
        </p>
      ) : isMissingClaimsError(statusQ.error) ? (
        <MissingClaimsNotice />
      ) : statusQ.error || !statusQ.data ? (
        <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm text-red-700">{t.status.loadError}</p>
          <button type="button" className={btnLink} onClick={() => void statusQ.refetch()}>
            {t.status.retry}
          </button>
        </div>
      ) : (
        <SurveyChecklist status={statusQ.data} onGoToStep={onGoToStep} />
      )}

      <div className="border-t border-[#e4e8ee] pt-5">
        {resultsQ.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-[#111827]/60" role="status">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t.results.loading}
          </p>
        ) : resultsQ.error || !resultsQ.data ? (
          <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm text-red-700">{t.results.loadError}</p>
            <button type="button" className={btnLink} onClick={() => void resultsQ.refetch()}>
              {t.status.retry}
            </button>
          </div>
        ) : (
          <SurveyResultsPanel results={resultsQ.data} />
        )}
      </div>

      {statusQ.data && (
        <div className="space-y-4 border-t border-[#e4e8ee] pt-5" id="survey-signatures">
          <div>
            <p className="font-display text-base font-semibold text-[#0e2a63]">{t.signatures.title}</p>
            <p className="mt-1 text-sm text-[#111827]/65">{t.signatures.intro}</p>
          </div>
          {!online && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900" role="status" data-testid="signatures-offline">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {t.signatures.offline}
            </p>
          )}
          <SignatureBlock party="customer" onboardingId={onboardingId} status={statusQ.data} maxKb={options.signature_max_kb} online={online} />
          <SignatureBlock party="associate" onboardingId={onboardingId} status={statusQ.data} maxKb={options.signature_max_kb} online={online} />
        </div>
      )}
    </div>
  )
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/**
 * The signature pads outside the wizard: a verified customer whose signature a
 * correction cleared signs again here (owner only; the card decides who sees it).
 */
export function ResignSignatures({ onboardingId, status, maxKb }: { onboardingId: number; status: SurveyStatus; maxKb: number }) {
  const t = useMessages('survey')
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
  const missing = (['customer', 'associate'] as const).filter((p) => !status.signatures[p].signed)
  return (
    <div className="space-y-3" data-testid="resign-signatures">
      <div>
        <p className="font-display text-base font-semibold text-[#0e2a63]">{t.resign.title}</p>
        <p className="mt-1 text-sm text-[#111827]/65">{t.resign.body}</p>
      </div>
      {!online && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900" role="status">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {t.signatures.offline}
        </p>
      )}
      {missing.map((party) => (
        <SignatureBlock key={party} party={party} onboardingId={onboardingId} status={status} maxKb={maxKb} online={online} />
      ))}
    </div>
  )
}
