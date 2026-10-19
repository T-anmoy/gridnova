'use client'

import { useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Link from '@/components/i18n/Link'
import { useMessages, useOptionalMessages } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/types'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { useOnboarding, useOnboardingOptions } from '@/lib/associate/onboarding-api-client'
import { useAssociateMe } from '@/lib/associate/api-client'
import { useRequestSurveyCorrection, useSurveyCorrections } from '@/lib/associate/survey-api-client'
import {
  STEP_FIELDS,
  surveyFieldErrorOf,
  surveyFormFromSiteAssessment,
  surveyPatch,
  surveyPayload,
  numberProblem,
  type SurveyForm,
} from '@/lib/associate/survey'
import { validateWizardStep, type ValidationCopy, type WizardDraft } from '@/lib/associate/wizard-validation'
import { correctionErrorText, displayValue, type ValueCopy } from '@/lib/associate/survey-review'
import type { SurveyOptions } from '@/lib/associate/survey-types'
import { ApiError } from '@/lib/dashboard/api-error'
import { BillsStep, ConnectionSurveyFields, LayoutStep, RoofSurveyFields } from '@/components/associate/survey/SurveyFieldSteps'
import { CorrectionHistory } from '@/components/associate/survey/SurveyCard'
import { FieldError, FormField, inputClass } from '@/components/associate/wizard-fields'
import type { Onboarding } from '@/lib/associate/onboarding-types'

const AREAS = ['connection', 'bills', 'house', 'layout'] as const
type Area = (typeof AREAS)[number]

// The consumer number is the customer's identity for attribution: never offered (422 field_not_correctable).
const FIELDS_OF: Record<Area, readonly string[]> = {
  connection: STEP_FIELDS.connection.filter((f) => f !== 'consumer_number'),
  bills: STEP_FIELDS.bills,
  house: STEP_FIELDS.house,
  layout: STEP_FIELDS.layout,
}

const btnPrimary =
  'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0e2a63] px-5 text-sm font-semibold text-white font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] disabled:opacity-50'

function useValueCopy(): ValueCopy {
  const t = useMessages('survey')
  return {
    yes: t.card.yes,
    no: t.card.no,
    fields: t.fields as Record<string, string>,
    maps: {
      roofMaterials: t.roofMaterials,
      orientations: t.roof.orientations,
      phases: t.phases,
      shading: t.shading,
      nocStatuses: t.nocStatuses,
      inverterLocations: t.layout.inverterLocations,
      methods: t.layout.methods,
      variants: t.connection.variants,
      obstacles: t.roof.obstacles,
    } as Record<string, Record<string, string>>,
  }
}

function CorrectionForm({ onboarding, options, back }: { onboarding: Onboarding; options: SurveyOptions; back: string }) {
  const t = useMessages('survey')
  const c = t.corrections
  const missingClaims = useOptionalMessages('portalErrors')?.missingClaims?.body
  const valueCopy = useValueCopy()
  const request = useRequestSurveyCorrection()
  const sa = onboarding.site_assessment as Record<string, unknown> | null
  const server = useMemo(() => surveyFormFromSiteAssessment(sa, options.discom_options), [sa, options.discom_options])
  const [form, setForm] = useState<SurveyForm>(server)
  const [areas, setAreas] = useState<Area[]>([])
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const common = { yes: valueCopy.yes, no: valueCopy.no, placeholder: '—' }

  const fields = areas.flatMap((a) => FIELDS_OF[a])
  const patch = surveyPatch(form, server, fields)
  delete patch.consumer_number
  const derivedShadowFree = server.roof_sections.length > 0 && typeof sa?.shadow_free_area_sqft === 'number' ? (sa.shadow_free_area_sqft as number) : null
  const sectionsDirty = Object.keys(surveyPatch(form, server, ['roof_sections'])).length > 0

  function toggle(a: Area) {
    setAreas((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]))
    setSent(false)
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    const draft = { survey: form } as WizardDraft
    const ctx = {
      isNew: false,
      survey: options,
      v: {} as ValidationCopy,
      s: { bills: t.bills.errors, roof: t.roof.errors, layout: t.layout.errors },
    }
    if (areas.includes('bills')) Object.assign(e, validateWizardStep('bills', draft, ctx))
    if (areas.includes('house')) Object.assign(e, validateWizardStep('house', draft, ctx))
    if (areas.includes('layout')) Object.assign(e, validateWizardStep('layout', draft, ctx))
    if (areas.includes('connection')) {
      const num = (f: 'sanctioned_load_kw' | 'contract_demand_kva' | 'society_flat_count', o: Parameters<typeof numberProblem>[1]) => {
        if (numberProblem(String(form[f] ?? ''), o)) e[f] = t.roof.errors.invalid_number
      }
      num('sanctioned_load_kw', { exclusiveMin: true, max: 1_000_000 })
      num('contract_demand_kva', { exclusiveMin: true, max: 1_000_000 })
      num('society_flat_count', { min: 1, integer: true, max: 100_000 })
    }
    return e
  }

  function focusInvalid() {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')?.focus())
  }

  function serverFieldErrors(err: unknown): boolean {
    const se = surveyFieldErrorOf(err)
    const changesField = err instanceof ApiError && typeof err.structuredDetail?.changes_field === 'string' ? (err.structuredDetail.changes_field as string) : null
    const field = se?.field ?? changesField
    if (!field) return false
    const b = t.bills.errors as Record<string, string>
    let key = field
    let msg = correctionErrorText(err, c.errors, missingClaims)
    if (se && field === 'consumption_history') {
      key = se.code === 'too_many_months' || se.index == null ? 'bills' : `bills.${se.index}`
      msg = se.code === 'too_many_months' ? fmt(b.too_many_months, { max: se.max_months ?? options.max_consumption_months }) : (b[se.code] ?? msg)
    } else if (se?.code === 'obstacle_exceeds_section') msg = t.roof.errors.obstacle_exceeds_section
    else if (se?.code === 'derived_field') msg = t.roof.errors.derived_field
    else if (se?.code === 'out_of_range') msg = fmt(t.layout.errors.out_of_range, { max: se.max_m ?? options.distance_max_m })
    else if (se?.code === 'roofs_considered_exceeds_available') msg = t.roof.errors.roofs_considered_exceeds_available
    setErrors({ [key]: msg })
    return true
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setFormError(null)
    setSent(false)
    const e = validate()
    if (!reason.trim()) e.reason = c.reasonRequired
    if (Object.keys(patch).length === 0) {
      setErrors(e)
      setFormError(c.noChanges)
      return
    }
    setErrors(e)
    if (Object.keys(e).length) {
      focusInvalid()
      return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setFormError(c.errors.offline)
      return
    }
    setBusy(true)
    try {
      await request.mutateAsync({ id: onboarding.onboarding_id, changes: patch, reason: reason.trim() })
      setSent(true)
      setAreas([])
      setReason('')
      setForm(server)
    } catch (err) {
      if (serverFieldErrors(err)) {
        setFormError(c.errors.invalid_value)
        focusInvalid()
      } else setFormError(correctionErrorText(err, c.errors, missingClaims))
    } finally {
      setBusy(false)
    }
  }

  const update = (p: Partial<SurveyForm>) => setForm((f) => ({ ...f, ...p }))
  const preview = Object.entries(patch)
  // "Now" is what the server holds, in the same shape as the new value.
  const serverPayload = useMemo(() => surveyPayload(server), [server])

  return (
    <form ref={formRef} onSubmit={(ev) => void onSubmit(ev)} noValidate className="space-y-6" data-testid="correction-form">
      <fieldset>
        <legend className="font-display text-base font-semibold text-[#0e2a63]">{c.pickAreas}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {AREAS.map((a) => (
            <label key={a} className="flex min-h-[44px] items-center gap-3 rounded-xl border border-[#e4e8ee] px-4 text-base font-utility text-[#111827]/85">
              <input type="checkbox" name="area" value={a} checked={areas.includes(a)} onChange={() => toggle(a)} className="h-5 w-5 rounded border-[#c9d2de] accent-[#0e2a63]" />
              {c.areas[a]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-[#111827]/65">{c.consumerLocked}</p>
      </fieldset>

      {areas.includes('connection') && (
        <div className="border-t border-[#e4e8ee] pt-5">
          <ConnectionSurveyFields form={form} onChange={update} options={options} errors={errors} common={common} lockConsumerNumber={c.consumerLocked} />
        </div>
      )}
      {areas.includes('bills') && (
        <div className="border-t border-[#e4e8ee] pt-5">
          <BillsStep form={form} onChange={update} options={options} errors={errors} />
        </div>
      )}
      {areas.includes('house') && (
        <div className="border-t border-[#e4e8ee] pt-5">
          <RoofSurveyFields form={form} onChange={update} options={options} errors={errors} common={common} derivedShadowFree={derivedShadowFree} sectionsDirty={sectionsDirty} />
        </div>
      )}
      {areas.includes('layout') && (
        <div className="border-t border-[#e4e8ee] pt-5">
          <LayoutStep form={form} onChange={update} options={options} errors={errors} common={common} />
        </div>
      )}

      {preview.length > 0 && (
        <div className="rounded-xl bg-[#f7f9fc] p-4" data-testid="correction-preview">
          <p className="font-utility text-sm font-semibold text-[#0e2a63]">{c.reviewChanges}</p>
          <ul className="mt-2 space-y-2">
            {preview.map(([field, value]) => (
              <li key={field} className="text-sm break-words">
                <span className="font-semibold">{valueCopy.fields[field] ?? field.replace(/_/g, ' ')}</span>
                <br />
                <span className="text-[#111827]/65">{c.now}: </span>
                {displayValue(field, serverPayload[field], valueCopy)}
                {' → '}
                <span className="text-[#111827]/65">{c.newValue}: </span>
                <span className="font-semibold text-[#0e2a63]">{displayValue(field, value, valueCopy)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {areas.length > 0 && (
        <>
          <FormField label={c.reasonLabel} error={errors.reason} required>
            {(p) => (
              <textarea {...p} name="reason" rows={3} maxLength={1000} className={`${inputClass(!!errors.reason)} min-h-[88px]`} value={reason} onChange={(e) => setReason(e.target.value)} />
            )}
          </FormField>
          <p className="text-sm text-amber-800">{c.resignWarning}</p>
        </>
      )}

      <div aria-live="polite">
        {formError && (
          <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5">
            <FieldError message={formError} />
          </div>
        )}
        {sent && <p className="rounded-lg bg-[#0e2a63]/10 px-3.5 py-2.5 text-sm text-[#0e2a63]" data-testid="correction-sent">{c.sent}</p>}
      </div>

      {areas.length > 0 && (
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {c.sending}
            </>
          ) : (
            c.submit
          )}
        </button>
      )}
      <Link href={back} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[#0e2a63] underline underline-offset-2 font-utility">
        {c.back}
      </Link>
    </form>
  )
}

/**
 * Request a correction for a verified customer's survey. The owner picks the
 * areas to correct, edits them with the same inputs and checks as the survey
 * steps, says why, and Grid Nova decides. One request at a time.
 */
export default function CorrectionRequest({ onboardingId, portalBase }: { onboardingId: number; portalBase: '/associates/portal' | '/preferred/portal' }) {
  const t = useMessages('survey')
  const c = t.corrections
  const onboarding = useOnboarding(onboardingId)
  const options = useOnboardingOptions()
  const me = useAssociateMe()
  const corrections = useSurveyCorrections(onboardingId)
  const back = `${portalBase}/customers/${onboardingId}`

  if (onboarding.error) return <DashboardError error={onboarding.error} onRetry={() => void onboarding.refetch()} />
  if (options.error) return <DashboardError error={options.error} onRetry={() => void options.refetch()} />
  if (onboarding.isLoading || !onboarding.data || options.isLoading || !options.data || me.isLoading) {
    return (
      <div className="flex items-center justify-center py-20" role="status">
        <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none text-[#111827]/65" aria-hidden="true" />
        <span className="sr-only">{c.loading}</span>
      </div>
    )
  }
  const ob = onboarding.data
  const isOwner = !!me.data && ob.owner.associate_id === me.data.associate_id
  const items = corrections.data?.items ?? []
  const pending = items.some((i) => i.status === 'pending')

  let body: React.ReactNode
  if (!isOwner) body = <p className="text-sm text-[#111827]/70" data-testid="correction-owner-only">{c.ownerOnly}</p>
  else if (ob.status !== 'verified') {
    body = (
      <p className="text-sm text-[#111827]/70" data-testid="correction-not-verified">
        {c.notVerified}
      </p>
    )
  } else if (pending) body = <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900" role="status" data-testid="correction-pending-block">{c.pendingBlock}</p>
  else body = <CorrectionForm onboarding={ob} options={options.data.survey} back={back} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">{c.pageTitle}</h1>
        <p className="mt-1 text-sm text-[#111827]/65">{ob.customer.name}</p>
        <p className="mt-2 text-sm text-[#111827]/70">{c.intro}</p>
      </div>
      {body}
      {(!isOwner || ob.status !== 'verified' || pending) && (
        <Link href={back} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[#0e2a63] underline underline-offset-2 font-utility">
          {c.back}
        </Link>
      )}
      {corrections.isLoading ? null : corrections.error ? <p className="text-sm text-red-700">{c.loadError}</p> : items.length === 0 ? <p className="text-sm text-[#111827]/65">{c.empty}</p> : <CorrectionHistory items={items} />}
    </div>
  )
}
