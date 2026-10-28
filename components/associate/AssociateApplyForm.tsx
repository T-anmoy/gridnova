'use client'

import { cloneElement, isValidElement, useId, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import {
  useKycConsent,
  useSeatAvailability,
  submitApplication,
} from '@/lib/associate/api-client'
import { clearAutosaveDraft, useAutosaveDraft } from '@/lib/associate/useAutosaveDraft'
import { applyDraftKey, useDraftUserId } from '@/lib/associate/portal-session'
import {
  isValidMobile,
  isValidEmail,
  isValidPinCode,
  isValidAadhaar,
  isValidPan,
  isValidBankAccount,
  isValidIfsc,
  isValidGstin,
  isAdult,
  MIN_APPLICANT_AGE,
} from '@/lib/associate/validation'
import { ApiError } from '@/lib/dashboard/api-error'
import { APPLY_FIELD_STEP, applyFieldErrors, stepsWithErrors } from '@/lib/associate/apply-errors'
import DateField from '@/components/forms/DateField'
import FileUploadSlot from '@/components/associate/FileUploadSlot'
import TerritorySelect from '@/components/associate/TerritorySelect'
import { useTerritoryCascade } from '@/lib/associate/territory'
import type { AssociateLevel } from '@/lib/associate/types'
import { fmt, type Messages } from '@/lib/i18n/types'

type Kind = 'associate' | 'preferred'
type Common = Messages['associates']['wizard']['common']
type Fields = Messages['associates']['wizard']['fields']
type Docs = Messages['associates']['wizard']['documents']

interface FormState {
  full_name: string
  date_of_birth: string
  mobile: string
  email: string
  address_line: string
  state_lgd_code: string
  district_lgd_code: string
  block_lgd_code: string
  pin_code: string
  aadhaar_number: string
  pan: string
  bank_account_number: string
  bank_ifsc: string
  capability: 'sales' | 'execution' | ''
  requested_level: AssociateLevel | ''
  requested_state_lgd_code: string
  requested_district_lgd_code: string
  requested_block_lgd_code: string
  business_type: string
  gstin: string
  office_address: string
  prior_experience: string
  team_size: string
  reference_1_name: string
  reference_1_mobile: string
  reference_2_name: string
  reference_2_mobile: string
}

const EMPTY: FormState = {
  full_name: '', date_of_birth: '', mobile: '', email: '', address_line: '',
  state_lgd_code: '', district_lgd_code: '', block_lgd_code: '', pin_code: '',
  aadhaar_number: '', pan: '', bank_account_number: '', bank_ifsc: '',
  capability: '', requested_level: '',
  requested_state_lgd_code: '', requested_district_lgd_code: '', requested_block_lgd_code: '',
  business_type: '', gstin: '', office_address: '', prior_experience: '', team_size: '',
  reference_1_name: '', reference_1_mobile: '', reference_2_name: '', reference_2_mobile: '',
}

// Identity, bank and contact numbers never touch the device's storage: a draft
// on a shared phone must not leak them. They are simply asked again after a reload.
export const APPLY_DRAFT_EXCLUDED: readonly (keyof FormState)[] = [
  'aadhaar_number',
  'pan',
  'bank_account_number',
  'bank_ifsc',
  'date_of_birth',
  'mobile',
  'reference_1_mobile',
  'reference_2_mobile',
]

type Files = { masked_aadhaar: File | null; pan_card: File | null; photo: File | null; cancelled_cheque: File | null }
const EMPTY_FILES: Files = { masked_aadhaar: null, pan_card: null, photo: null, cancelled_cheque: null }

// 16px text (iOS never zooms), ≥ 44px tall, a visible focus ring.
const inputClass = (hasError: boolean) =>
  `w-full min-h-[44px] rounded-xl border bg-white px-4 py-2.5 text-[#111827] text-base font-utility transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f5daa] ${
    hasError ? 'border-red-400' : 'border-[#e4e8ee] focus:border-[#2f5daa]'
  }`

function Field({
  label, htmlFor, why, whyLabel, example, exampleLabel, error, children,
}: {
  label: string
  htmlFor?: string
  why?: string
  whyLabel: string
  example?: string
  exampleLabel?: string
  error?: string
  children: React.ReactNode
}) {
  // Ties the label, hint and error to the single control inside (id / htmlFor,
  // aria-invalid, aria-describedby). A caller that already owns the id
  // (TerritorySelect) passes `htmlFor` and keeps it.
  const auto = useId()
  const id = htmlFor ?? auto
  const whyId = `${id}-why`
  const errorId = `${id}-error`
  const describedBy = [why ? whyId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  const control =
    !htmlFor && isValidElement<Record<string, unknown>>(children)
      ? cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })
      : children
  return (
    <div>
      <label htmlFor={id} className="font-utility text-xs text-[#111827]/60 uppercase tracking-[0.1em] mb-1.5 block">{label}</label>
      {control}
      {why && <p id={whyId} className="mt-1.5 text-xs text-[#111827]/65 leading-relaxed"><span className="font-semibold text-[#111827]/70">{whyLabel}:</span> {why}</p>}
      {example && <p className="mt-0.5 text-xs text-[#111827]/65 leading-relaxed">{exampleLabel}: {example}</p>}
      {error && <p id={errorId} className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600 font-utility"><AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{error}</p>}
    </div>
  )
}

/** Remounts the form per signed-in user so one person's draft never opens for another. */
export default function AssociateApplyForm({ kind, t }: { kind: Kind; t: Messages['associates'] }) {
  const { userId } = useDraftUserId()
  const draftKey = applyDraftKey(kind, userId)
  return <ApplyForm key={draftKey} kind={kind} t={t} draftKey={draftKey} />
}

function ApplyForm({ kind, t, draftKey }: { kind: Kind; t: Messages['associates']; draftKey: string }) {
  const common: Common = t.wizard.common
  const fields: Fields = t.wizard.fields
  const docs: Docs = t.wizard.documents
  const copy = kind === 'associate' ? t.wizard.associate : t.wizard.preferred

  const steps: string[] =
    kind === 'associate'
      ? ['personal', 'address', 'identityBank', 'capability', 'documents', 'consent', 'review']
      : ['personal', 'address', 'territory', 'business', 'references', 'identityBank', 'documents', 'consent', 'review']

  const [stepIndex, setStepIndex] = useState(0)
  const [values, setValues, restored] = useAutosaveDraft<FormState>(draftKey, EMPTY, { exclude: APPLY_DRAFT_EXCLUDED })
  const [files, setFiles] = useState<Files>(EMPTY_FILES)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<{ id: number } | null>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const addressTerritory = { state: values.state_lgd_code, district: values.district_lgd_code, block: values.block_lgd_code }
  const { districts, selectedDistrict } = useTerritoryCascade(addressTerritory)
  const requestedTerritory = {
    state: values.requested_state_lgd_code,
    district: values.requested_district_lgd_code,
    block: values.requested_block_lgd_code,
  }
  const requestedDepth =
    values.requested_level === 'state_head' ? 'state' : values.requested_level === 'district_head' ? 'district' : 'block'
  const { selectedDistrict: selectedReqDistrict } = useTerritoryCascade(requestedTerritory, requestedDepth)

  const seatParams =
    kind === 'preferred' && values.requested_level && values.requested_state_lgd_code
      ? {
          level: values.requested_level as AssociateLevel,
          state_lgd_code: Number(values.requested_state_lgd_code),
          district_lgd_code: values.requested_district_lgd_code ? Number(values.requested_district_lgd_code) : undefined,
          block_lgd_code: values.requested_block_lgd_code ? Number(values.requested_block_lgd_code) : undefined,
        }
      : null
  const { data: seatAvailability, isFetching: seatChecking } = useSeatAvailability(seatParams)

  const { data: kycConsent, isLoading: kycLoading, error: kycError, refetch: refetchConsent } = useKycConsent()

  function validateStep(step: string): boolean {
    const next: Record<string, string> = {}
    if (step === 'personal') {
      if (!values.full_name.trim()) next.full_name = common.required
      if (!isAdult(values.date_of_birth)) next.date_of_birth = fields.date_of_birth.label
      if (!isValidMobile(values.mobile)) next.mobile = fields.mobile.label
      if (!isValidEmail(values.email)) next.email = fields.email.label
    }
    if (step === 'address') {
      if (!values.address_line.trim()) next.address_line = common.required
      if (!values.state_lgd_code) next.state_lgd_code = common.required
      if (districts.data && districts.data.length > 0 && !values.district_lgd_code) next.district_lgd_code = common.required
      if (selectedDistrict?.has_blocks && !values.block_lgd_code) next.block_lgd_code = common.required
      if (!isValidPinCode(values.pin_code)) next.pin_code = fields.pin_code.label
    }
    if (step === 'territory') {
      if (!values.requested_level) next.requested_level = common.required
      if (!values.requested_state_lgd_code) next.requested_state_lgd_code = common.required
      if (values.requested_level !== 'state_head' && !values.requested_district_lgd_code) next.requested_district_lgd_code = common.required
      if (values.requested_level === 'block' && selectedReqDistrict?.has_blocks && !values.requested_block_lgd_code) next.requested_block_lgd_code = common.required
    }
    if (step === 'business') {
      if (!values.business_type.trim()) next.business_type = common.required
      if (!isValidGstin(values.gstin)) next.gstin = fields.gstin.label
      if (!values.office_address.trim()) next.office_address = common.required
      if (!values.prior_experience.trim()) next.prior_experience = common.required
      const team = Number(values.team_size)
      if (!Number.isFinite(team) || team < 0 || team > 100000) next.team_size = fields.team_size.label
    }
    if (step === 'references') {
      if (!values.reference_1_name.trim()) next.reference_1_name = common.required
      if (!isValidMobile(values.reference_1_mobile)) next.reference_1_mobile = fields.reference_mobile.label
      if (!values.reference_2_name.trim()) next.reference_2_name = common.required
      if (!isValidMobile(values.reference_2_mobile)) next.reference_2_mobile = fields.reference_mobile.label
      if (
        values.reference_1_name.trim() &&
        values.reference_2_name.trim() &&
        values.reference_1_name.trim().toLowerCase() === values.reference_2_name.trim().toLowerCase()
      ) {
        next.reference_2_name = common.errorGeneric
      }
    }
    if (step === 'identityBank') {
      if (!isValidAadhaar(values.aadhaar_number)) next.aadhaar_number = fields.aadhaar_number.label
      if (!isValidPan(values.pan)) next.pan = fields.pan.label
      if (!isValidBankAccount(values.bank_account_number)) next.bank_account_number = fields.bank_account_number.label
      if (!isValidIfsc(values.bank_ifsc)) next.bank_ifsc = fields.bank_ifsc.label
    }
    if (step === 'capability' && !values.capability) next.capability = common.required
    if (step === 'documents') {
      if (!files.masked_aadhaar) next.masked_aadhaar = common.required
      if (!files.pan_card) next.pan_card = common.required
      if (!files.photo) next.photo = common.required
      if (!files.cancelled_cheque) next.cancelled_cheque = common.required
    }
    if (step === 'consent' && !consentAccepted) next.consent = common.required

    // Errors the server reported for other steps stay until those fields are edited.
    setErrors((prev) => ({
      ...Object.fromEntries(Object.entries(prev).filter(([k, v]) => v && APPLY_FIELD_STEP[k] && APPLY_FIELD_STEP[k] !== step)),
      ...next,
    }))
    return Object.keys(next).length === 0
  }

  function goNext() {
    if (!validateStep(steps[stepIndex])) return
    setStepIndex((i) => Math.min(i + 1, steps.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    if (!kycConsent) return
    setSubmitting(true)
    setBannerError(null)
    try {
      const fd = new FormData()
      fd.set('full_name', values.full_name.trim())
      fd.set('date_of_birth', values.date_of_birth)
      fd.set('mobile', values.mobile.trim())
      fd.set('email', values.email.trim())
      fd.set('address_line', values.address_line.trim())
      fd.set('state_lgd_code', values.state_lgd_code)
      if (values.district_lgd_code) fd.set('district_lgd_code', values.district_lgd_code)
      if (values.block_lgd_code) fd.set('block_lgd_code', values.block_lgd_code)
      fd.set('pin_code', values.pin_code)
      fd.set('aadhaar_number', values.aadhaar_number.replace(/\s/g, ''))
      fd.set('pan', values.pan.toUpperCase())
      fd.set('bank_account_number', values.bank_account_number)
      fd.set('bank_ifsc', values.bank_ifsc.toUpperCase())
      fd.set('kyc_consent_version', kycConsent.version)
      fd.set('kyc_consent_accepted', 'true')
      if (files.masked_aadhaar) fd.set('masked_aadhaar', files.masked_aadhaar)
      if (files.pan_card) fd.set('pan_card', files.pan_card)
      if (files.photo) fd.set('photo', files.photo)
      if (files.cancelled_cheque) fd.set('cancelled_cheque', files.cancelled_cheque)

      if (kind === 'associate') {
        fd.set('capability', values.capability)
      } else {
        fd.set('requested_level', values.requested_level)
        fd.set('requested_state_lgd_code', values.requested_state_lgd_code)
        if (values.requested_district_lgd_code) fd.set('requested_district_lgd_code', values.requested_district_lgd_code)
        if (values.requested_block_lgd_code) fd.set('requested_block_lgd_code', values.requested_block_lgd_code)
        fd.set('business_type', values.business_type.trim())
        if (values.gstin.trim()) fd.set('gstin', values.gstin.trim())
        fd.set('office_address', values.office_address.trim())
        fd.set('prior_experience', values.prior_experience.trim())
        fd.set('team_size', values.team_size)
        fd.set('reference_1_name', values.reference_1_name.trim())
        fd.set('reference_1_mobile', values.reference_1_mobile.trim())
        fd.set('reference_2_name', values.reference_2_name.trim())
        fd.set('reference_2_mobile', values.reference_2_mobile.trim())
      }

      const result = await submitApplication(kind, fd)
      clearAutosaveDraft(draftKey)
      setSubmitted({ id: result.application_id })
    } catch (err) {
      const fieldErrors = applyFieldErrors(err, t.wizard.fieldErrors)
      if (fieldErrors) {
        if (fieldErrors.consentStale) {
          setConsentAccepted(false)
          void refetchConsent()
        }
        setErrors(fieldErrors.byField)
        const hit = stepsWithErrors(fieldErrors.byField, steps)
        if (hit.length) setStepIndex(steps.indexOf(hit[0]))
        const names = t.wizard.stepNames as Record<string, string>
        const elsewhere = hit.slice(1).map((s) => names[s] ?? s)
        setBannerError(
          [
            fieldErrors.consentStale ? common.consentUpdated : common.errorFields,
            elsewhere.length ? fmt(common.errorFieldsElsewhere, { steps: elsewhere.join(', ') }) : '',
            ...fieldErrors.general,
          ]
            .filter(Boolean)
            .join(' ')
        )
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setBannerError(describeError(err, common, fields))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-10">
        <CheckCircle2 className="h-14 w-14 mx-auto text-green-600" />
        <h1 className="mt-6 font-display text-3xl font-semibold text-[#0e2a63]">{copy.success.title}</h1>
        <p className="mt-3 text-[#111827]/65 leading-relaxed">{copy.success.body}</p>
        <p className="mt-1 font-utility text-sm text-[#111827]/65">#{submitted.id}</p>
        <div className="mt-10 rounded-2xl border border-[#e4e8ee] bg-[#f7f9fc] p-7 text-left">
          <h2 className="font-display text-lg font-semibold text-[#0e2a63]">{copy.success.nextStepsTitle}</h2>
          <ol className="mt-4 space-y-3">
            {copy.success.steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-[#111827]/70 leading-relaxed">
                <span className="font-display text-[#2f5daa] font-semibold shrink-0">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
    )
  }

  const step = steps[stepIndex]

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-semibold text-[#0e2a63]">{copy.title}</h1>
      <p className="mt-2 text-[#111827]/60 leading-relaxed">{copy.intro}</p>

      <div className="mt-6 flex items-center gap-3">
        <div className="h-1.5 flex-1 rounded-full bg-[#e4e8ee] overflow-hidden">
          <div
            className="h-full bg-[#f7a800] transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
        <span className="font-utility text-xs text-[#111827]/65 shrink-0">
          {fmtStep(common.stepOf, stepIndex + 1, steps.length)}
        </span>
      </div>

      {restored && stepIndex === 0 && (
        <p className="mt-4 rounded-xl bg-[#f7a800]/10 border border-[#f7a800]/30 px-4 py-2.5 text-xs font-utility text-[#6b4700]">
          {common.autosaveRestored}
        </p>
      )}

      {bannerError && (
        <p role="alert" data-testid="apply-error" className="mt-6 flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 font-utility">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" /> {bannerError}
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-[#e4e8ee] bg-white p-6 md:p-8">
        {step === 'personal' && (
          <div className="space-y-5">
            <Field label={fields.full_name.label} why={fields.full_name.why} whyLabel={common.whyWeAsk} example={fields.full_name.example} exampleLabel={common.example} error={errors.full_name}>
              <input className={inputClass(!!errors.full_name)} value={values.full_name} onChange={(e) => set('full_name', e.target.value)} />
            </Field>
            <Field label={fields.date_of_birth.label} why={fields.date_of_birth.why} whyLabel={common.whyWeAsk} example={fields.date_of_birth.example} exampleLabel={common.example} error={errors.date_of_birth}>
              <DateField mode="dob" minAge={MIN_APPLICANT_AGE} label={fields.date_of_birth.label} required value={values.date_of_birth} onChange={(v) => set('date_of_birth', v)} />
            </Field>
            <Field label={fields.mobile.label} why={fields.mobile.why} whyLabel={common.whyWeAsk} example={fields.mobile.example} exampleLabel={common.example} error={errors.mobile}>
              <input type="tel" inputMode="tel" autoComplete="tel" maxLength={14} className={inputClass(!!errors.mobile)} value={values.mobile} onChange={(e) => set('mobile', e.target.value)} />
            </Field>
            <Field label={fields.email.label} why={fields.email.why} whyLabel={common.whyWeAsk} example={fields.email.example} exampleLabel={common.example} error={errors.email}>
              <input type="email" inputMode="email" autoCapitalize="none" spellCheck={false} className={inputClass(!!errors.email)} value={values.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
          </div>
        )}

        {step === 'address' && (
          <div className="space-y-5">
            <Field label={fields.address_line.label} why={fields.address_line.why} whyLabel={common.whyWeAsk} example={fields.address_line.example} exampleLabel={common.example} error={errors.address_line}>
              <input className={inputClass(!!errors.address_line)} value={values.address_line} onChange={(e) => set('address_line', e.target.value)} />
            </Field>
            <TerritorySelect
              idPrefix="address"
              copy={t.territory}
              value={addressTerritory}
              onChange={(n) => setValues((v) => ({ ...v, state_lgd_code: n.state, district_lgd_code: n.district, block_lgd_code: n.block }))}
              labels={{ state: fields.state.label, district: fields.district.label, block: fields.block.label }}
              whys={{ state: fields.state.why, district: fields.district.why, block: fields.block.why }}
              errors={{ state: errors.state_lgd_code, district: errors.district_lgd_code, block: errors.block_lgd_code }}
              inputClass={inputClass}
              renderField={({ id, label, why, error, children }) => (
                <Field label={label} htmlFor={id} why={why} whyLabel={common.whyWeAsk} error={error}>{children}</Field>
              )}
            />
            <Field label={fields.pin_code.label} why={fields.pin_code.why} whyLabel={common.whyWeAsk} example={fields.pin_code.example} exampleLabel={common.example} error={errors.pin_code}>
              <input inputMode="numeric" autoComplete="postal-code" maxLength={6} className={inputClass(!!errors.pin_code)} value={values.pin_code} onChange={(e) => set('pin_code', e.target.value)} />
            </Field>
          </div>
        )}

        {step === 'territory' && (
          <div className="space-y-5">
            <Field label={fields.requested_level.label} why={fields.requested_level.why} whyLabel={common.whyWeAsk} error={errors.requested_level}>
              <select
                className={inputClass(!!errors.requested_level)}
                value={values.requested_level}
                onChange={(e) => setValues((v) => ({ ...v, requested_level: e.target.value as AssociateLevel, requested_district_lgd_code: '', requested_block_lgd_code: '' }))}
              >
                <option value="">{common.selectPlaceholder}</option>
                <option value="state_head">{t.wizard.preferred.levelStateHead}</option>
                <option value="district_head">{t.wizard.preferred.levelDistrictHead}</option>
                <option value="block">{t.wizard.preferred.levelBlock}</option>
              </select>
            </Field>
            {values.requested_level && (
              <TerritorySelect
                idPrefix="requested"
                copy={t.territory}
                value={requestedTerritory}
                depth={requestedDepth}
                onChange={(n) => setValues((v) => ({ ...v, requested_state_lgd_code: n.state, requested_district_lgd_code: n.district, requested_block_lgd_code: n.block }))}
                labels={{ state: common.stateLabel, district: common.districtLabel, block: common.blockLabel }}
                errors={{ state: errors.requested_state_lgd_code, district: errors.requested_district_lgd_code, block: errors.requested_block_lgd_code }}
                inputClass={inputClass}
                renderField={({ id, label, error, children }) => (
                  <Field label={label} htmlFor={id} whyLabel={common.whyWeAsk} error={error}>{children}</Field>
                )}
              />
            )}
            {seatParams && (
              <p className={`text-xs font-utility ${seatAvailability && !seatAvailability.available ? 'text-red-600' : 'text-[#111827]/65'}`}>
                {seatChecking ? common.seatCheckingLabel : seatAvailability?.available ? common.seatAvailableLabel : seatAvailability ? common.seatFullLabel : ''}
              </p>
            )}
          </div>
        )}

        {step === 'business' && (
          <div className="space-y-5">
            <Field label={fields.business_type.label} why={fields.business_type.why} whyLabel={common.whyWeAsk} example={fields.business_type.example} exampleLabel={common.example} error={errors.business_type}>
              <input className={inputClass(!!errors.business_type)} value={values.business_type} onChange={(e) => set('business_type', e.target.value)} />
            </Field>
            <Field label={fields.gstin.label} why={fields.gstin.why} whyLabel={common.whyWeAsk} example={fields.gstin.example} exampleLabel={common.example} error={errors.gstin}>
              <input className={inputClass(!!errors.gstin)} value={values.gstin} onChange={(e) => set('gstin', e.target.value)} />
            </Field>
            <Field label={fields.office_address.label} why={fields.office_address.why} whyLabel={common.whyWeAsk} example={fields.office_address.example} exampleLabel={common.example} error={errors.office_address}>
              <input className={inputClass(!!errors.office_address)} value={values.office_address} onChange={(e) => set('office_address', e.target.value)} />
            </Field>
            <Field label={fields.prior_experience.label} why={fields.prior_experience.why} whyLabel={common.whyWeAsk} example={fields.prior_experience.example} exampleLabel={common.example} error={errors.prior_experience}>
              <textarea rows={3} className={inputClass(!!errors.prior_experience)} value={values.prior_experience} onChange={(e) => set('prior_experience', e.target.value)} />
            </Field>
            <Field label={fields.team_size.label} why={fields.team_size.why} whyLabel={common.whyWeAsk} example={fields.team_size.example} exampleLabel={common.example} error={errors.team_size}>
              <input type="number" inputMode="numeric" min={0} max={100000} className={inputClass(!!errors.team_size)} value={values.team_size} onChange={(e) => set('team_size', e.target.value)} />
            </Field>
          </div>
        )}

        {step === 'references' && (
          <div className="space-y-5">
            <Field label={`${fields.reference_name.label} 1`} why={fields.reference_name.why} whyLabel={common.whyWeAsk} example={fields.reference_name.example} exampleLabel={common.example} error={errors.reference_1_name}>
              <input className={inputClass(!!errors.reference_1_name)} value={values.reference_1_name} onChange={(e) => set('reference_1_name', e.target.value)} />
            </Field>
            <Field label={`${fields.reference_mobile.label} 1`} why={fields.reference_mobile.why} whyLabel={common.whyWeAsk} example={fields.reference_mobile.example} exampleLabel={common.example} error={errors.reference_1_mobile}>
              <input type="tel" inputMode="tel" autoComplete="off" maxLength={14} className={inputClass(!!errors.reference_1_mobile)} value={values.reference_1_mobile} onChange={(e) => set('reference_1_mobile', e.target.value)} />
            </Field>
            <Field label={`${fields.reference_name.label} 2`} why={fields.reference_name.why} whyLabel={common.whyWeAsk} example={fields.reference_name.example} exampleLabel={common.example} error={errors.reference_2_name}>
              <input className={inputClass(!!errors.reference_2_name)} value={values.reference_2_name} onChange={(e) => set('reference_2_name', e.target.value)} />
            </Field>
            <Field label={`${fields.reference_mobile.label} 2`} why={fields.reference_mobile.why} whyLabel={common.whyWeAsk} example={fields.reference_mobile.example} exampleLabel={common.example} error={errors.reference_2_mobile}>
              <input type="tel" inputMode="tel" autoComplete="off" maxLength={14} className={inputClass(!!errors.reference_2_mobile)} value={values.reference_2_mobile} onChange={(e) => set('reference_2_mobile', e.target.value)} />
            </Field>
          </div>
        )}

        {step === 'identityBank' && (
          <div className="space-y-5">
            <Field label={fields.aadhaar_number.label} why={fields.aadhaar_number.why} whyLabel={common.whyWeAsk} example={fields.aadhaar_number.example} exampleLabel={common.example} error={errors.aadhaar_number}>
              <input inputMode="numeric" autoComplete="off" maxLength={14} className={inputClass(!!errors.aadhaar_number)} value={values.aadhaar_number} onChange={(e) => set('aadhaar_number', e.target.value)} />
            </Field>
            <Field label={fields.pan.label} why={fields.pan.why} whyLabel={common.whyWeAsk} example={fields.pan.example} exampleLabel={common.example} error={errors.pan}>
              <input autoCapitalize="characters" spellCheck={false} autoComplete="off" maxLength={10} className={inputClass(!!errors.pan)} value={values.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} />
            </Field>
            <Field label={fields.bank_account_number.label} why={fields.bank_account_number.why} whyLabel={common.whyWeAsk} example={fields.bank_account_number.example} exampleLabel={common.example} error={errors.bank_account_number}>
              <input inputMode="numeric" autoComplete="off" maxLength={18} className={inputClass(!!errors.bank_account_number)} value={values.bank_account_number} onChange={(e) => set('bank_account_number', e.target.value)} />
            </Field>
            <Field label={fields.bank_ifsc.label} why={fields.bank_ifsc.why} whyLabel={common.whyWeAsk} example={fields.bank_ifsc.example} exampleLabel={common.example} error={errors.bank_ifsc}>
              <input autoCapitalize="characters" spellCheck={false} autoComplete="off" maxLength={11} className={inputClass(!!errors.bank_ifsc)} value={values.bank_ifsc} onChange={(e) => set('bank_ifsc', e.target.value.toUpperCase())} />
            </Field>
          </div>
        )}

        {step === 'capability' && (
          <div className="space-y-3">
            <p className="font-utility text-xs text-[#111827]/65 uppercase tracking-[0.1em] mb-1">{fields.capability.label}</p>
            <p className="text-xs text-[#111827]/65 mb-3"><span className="font-semibold text-[#111827]/65">{common.whyWeAsk}:</span> {fields.capability.why}</p>
            {(['sales', 'execution'] as const).map((c) => (
              <label key={c} className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition-colors ${values.capability === c ? 'border-[#f7a800] bg-[#f7a800]/5' : 'border-[#e4e8ee]'}`}>
                <input type="radio" name="capability" checked={values.capability === c} onChange={() => set('capability', c)} className="h-5 w-5 accent-[#0e2a63]" />
                <span className="font-utility text-sm text-[#091c3c]">{c === 'sales' ? t.wizard.associate.capabilitySales : t.wizard.associate.capabilityExecution}</span>
              </label>
            ))}
            {errors.capability && <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-red-500 font-utility"><AlertCircle className="h-3 w-3 shrink-0" />{errors.capability}</p>}
          </div>
        )}

        {step === 'documents' && (
          <div className="space-y-7">
            <FileUploadSlot
              label={docs.masked_aadhaar.label} why={docs.masked_aadhaar.why} sample={docs.masked_aadhaar.sample}
              accept=".jpg,.jpeg,.png,.pdf" acceptedTypesLabel={common.uploadHint}
              file={files.masked_aadhaar} onChange={(f) => setFiles((v) => ({ ...v, masked_aadhaar: f }))}
              chooseLabel={common.chooseFile} replaceLabel={common.replaceFile} whyLabel={common.whyWeAsk} sampleLabel={common.sampleLabel}
              error={errors.masked_aadhaar}
            />
            <FileUploadSlot
              label={docs.pan_card.label} why={docs.pan_card.why} sample={docs.pan_card.sample}
              accept=".jpg,.jpeg,.png,.pdf" acceptedTypesLabel={common.uploadHint}
              file={files.pan_card} onChange={(f) => setFiles((v) => ({ ...v, pan_card: f }))}
              chooseLabel={common.chooseFile} replaceLabel={common.replaceFile} whyLabel={common.whyWeAsk} sampleLabel={common.sampleLabel}
              error={errors.pan_card}
            />
            <FileUploadSlot
              label={docs.photo.label} why={docs.photo.why} sample={docs.photo.sample}
              accept=".jpg,.jpeg,.png,.webp" acceptedTypesLabel={common.photoUploadHint}
              file={files.photo} onChange={(f) => setFiles((v) => ({ ...v, photo: f }))}
              chooseLabel={common.chooseFile} replaceLabel={common.replaceFile} whyLabel={common.whyWeAsk} sampleLabel={common.sampleLabel}
              error={errors.photo}
            />
            <FileUploadSlot
              label={docs.cancelled_cheque.label} why={docs.cancelled_cheque.why} sample={docs.cancelled_cheque.sample}
              accept=".jpg,.jpeg,.png,.pdf" acceptedTypesLabel={common.uploadHint}
              file={files.cancelled_cheque} onChange={(f) => setFiles((v) => ({ ...v, cancelled_cheque: f }))}
              chooseLabel={common.chooseFile} replaceLabel={common.replaceFile} whyLabel={common.whyWeAsk} sampleLabel={common.sampleLabel}
              error={errors.cancelled_cheque}
            />
          </div>
        )}

        {step === 'consent' && (
          <div>
            <span className="ref-tag text-[#2f5daa]">{t.consent.eyebrow}</span>
            <h2 className="mt-3 font-display text-xl font-semibold text-[#0e2a63]">{t.consent.title}</h2>
            {kycLoading ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-[#111827]/65 font-utility"><Loader2 className="h-4 w-4 animate-spin" /> {t.consent.loading}</p>
            ) : kycError ? (
              <p className="mt-4 text-sm text-red-600 font-utility">{t.consent.error}</p>
            ) : (
              <>
                <p className="mt-1 font-utility text-xs text-[#111827]/65">{t.consent.versionLabel}: {kycConsent?.version}</p>
                <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-5 text-sm text-[#111827]/70 leading-relaxed whitespace-pre-wrap">
                  {kycConsent?.text}
                </div>
                <label className="mt-5 flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#0e2a63]" />
                  <span className="font-utility text-sm text-[#091c3c]">{t.consent.acceptLabel}</span>
                </label>
                {errors.consent && <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-red-500 font-utility"><AlertCircle className="h-3 w-3 shrink-0" />{errors.consent}</p>}
              </>
            )}
          </div>
        )}

        {step === 'review' && (
          <div>
            <h2 className="font-display text-xl font-semibold text-[#0e2a63]">{common.reviewTitle}</h2>
            <p className="mt-1 text-sm text-[#111827]/65">{common.reviewNote}</p>
            <dl className="mt-5 divide-y divide-[#e4e8ee]">
              {reviewRows(kind, values, fields, t).map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-[#111827]/65 font-utility">{label}</dt>
                  <dd className="text-[#091c3c] font-utility text-right">{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs font-utility text-[#111827]/65">{common.autosaveNote}</p>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0}
          className="btn btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {common.back}
        </button>
        {step === 'review' ? (
          <button type="button" onClick={() => void handleSubmit()} disabled={submitting} className="btn btn-primary">
            {submitting ? common.submitting : common.submit}
          </button>
        ) : (
          <button type="button" onClick={goNext} className="btn btn-primary">
            {common.next}
          </button>
        )}
      </div>
    </div>
  )
}

function fmtStep(template: string, current: number, total: number): string {
  return template.replace('{current}', String(current)).replace('{total}', String(total))
}

function reviewRows(kind: Kind, v: FormState, fields: Fields, t: Messages['associates']) {
  const rows = [
    { label: fields.full_name.label, value: v.full_name },
    { label: fields.date_of_birth.label, value: v.date_of_birth },
    { label: fields.mobile.label, value: v.mobile },
    { label: fields.email.label, value: v.email },
    { label: fields.address_line.label, value: v.address_line },
    { label: fields.pin_code.label, value: v.pin_code },
    { label: fields.pan.label, value: v.pan },
    { label: fields.bank_account_number.label, value: v.bank_account_number },
  ]
  if (kind === 'associate') {
    rows.push({ label: fields.capability.label, value: v.capability === 'sales' ? t.wizard.associate.capabilitySales : v.capability === 'execution' ? t.wizard.associate.capabilityExecution : '' })
  } else {
    rows.push({ label: fields.requested_level.label, value: v.requested_level })
    rows.push({ label: fields.business_type.label, value: v.business_type })
    rows.push({ label: fields.reference_name.label + ' 1', value: v.reference_1_name })
    rows.push({ label: fields.reference_name.label + ' 2', value: v.reference_2_name })
  }
  return rows
}

function describeError(err: unknown, common: Common, fields: Fields): string {
  if (!(err instanceof ApiError) || err.status === 0) return common.errorNetwork
  if (err.status === 429) return common.errorRateLimited
  if (err.structuredDetail?.code === 'seat_full') return common.errorSeatFull
  if (err.status === 409) {
    const field = err.structuredDetail?.field
    // Name the field the way the form does ("PAN"), not by its API name ("pan").
    const label = typeof field === 'string' ? (fields as Record<string, { label?: string }>)[field]?.label ?? field : null
    if (label) return common.errorDuplicate.replace('{field}', label)
  }
  return common.errorGeneric
}
