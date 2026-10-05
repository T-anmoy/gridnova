'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft, ArrowRight } from 'lucide-react'
import TerritorySelect, { type TerritoryCopy } from '@/components/associate/TerritorySelect'
import { clearAutosaveDraft, useAutosaveDraft } from '@/lib/associate/useAutosaveDraft'
import {
  useOnboardingOptions,
  useCreateOnboarding,
  useUpdateOnboarding,
  useUploadOnboardingFile,
  useSubmitOnboarding,
} from '@/lib/associate/onboarding-api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import FileUploadSlot from '@/components/associate/FileUploadSlot'
import PhotoCaptureSlot from '@/components/associate/PhotoCaptureSlot'
import { usePhotoUploads } from '@/lib/associate/usePhotoUploads'
import type { Onboarding, OnboardingWarning } from '@/lib/associate/onboarding-types'
import type { Messages } from '@/lib/i18n/types'

type WizardCopy = Messages['associates']['portal']['wizard']

interface DraftState {
  customer_name: string
  customer_mobile: string
  customer_email: string
  state_lgd_code: string
  district_lgd_code: string
  block_lgd_code: string
  connection_in_customer_name: '' | 'yes' | 'no'
  property_in_customer_name: '' | 'yes' | 'no'
  customer_timeline: string
  equipment_package: string
  notice_acknowledged: boolean
  // Remembered so a reload mid-wizard reuses the same onboarding (and finds its pending photos).
  onboarding_id?: number
}

const LAST_TERRITORY_KEY = 'gna-last-territory'

// A new customer usually lives in the same area as the previous one: pre-fill
// state / district from earlier in this browser session.
function rememberedTerritory(): Pick<DraftState, 'state_lgd_code' | 'district_lgd_code'> | null {
  try {
    const raw = window.sessionStorage.getItem(LAST_TERRITORY_KEY)
    return raw ? (JSON.parse(raw) as Pick<DraftState, 'state_lgd_code' | 'district_lgd_code'>) : null
  } catch {
    return null
  }
}

const EMPTY_DRAFT: DraftState = {
  customer_name: '',
  customer_mobile: '',
  customer_email: '',
  state_lgd_code: '',
  district_lgd_code: '',
  block_lgd_code: '',
  connection_in_customer_name: '',
  property_in_customer_name: '',
  customer_timeline: '',
  equipment_package: '',
  notice_acknowledged: false,
}

const inputClass =
  'w-full rounded-xl border border-[#e4e8ee] bg-white px-4 py-3 text-[#111827] text-sm font-utility outline-none transition-all duration-200 focus:border-[#2f5daa] focus:ring-2 focus:ring-[#2f5daa]/10'

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="font-utility text-xs text-[#111827]/55 uppercase tracking-[0.1em] mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

function WarningNotice({ warning, copy }: { warning: OnboardingWarning; copy: WizardCopy['warnings'] }) {
  // attribution_review deliberately withholds who — the backend never sends
  // a name for it, and this notice must never imply one exists to guess.
  const text = copy[warning.code] ?? warning.message
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
      <p className="text-xs text-amber-800 leading-relaxed">{text}</p>
    </div>
  )
}

export default function OnboardingWizard({
  copy,
  territory,
  portalBase,
  existing,
}: {
  copy: WizardCopy
  territory: TerritoryCopy
  portalBase: '/associates/portal' | '/preferred/portal'
  existing?: Onboarding
}) {
  const router = useRouter()
  const draftKey = `gna-onboarding-${existing?.onboarding_id ?? 'new'}`
  const initialDraft: DraftState = existing
    ? {
        customer_name: existing.customer.name,
        customer_mobile: existing.customer.mobile,
        customer_email: existing.customer.email ?? '',
        state_lgd_code: String(existing.territory.state.lgd_code),
        district_lgd_code: existing.territory.district ? String(existing.territory.district.lgd_code) : '',
        block_lgd_code: existing.territory.block ? String(existing.territory.block.lgd_code) : '',
        connection_in_customer_name: existing.connection_in_customer_name ? 'yes' : 'no',
        property_in_customer_name: existing.property_in_customer_name ? 'yes' : 'no',
        customer_timeline: existing.customer_timeline ?? '',
        equipment_package: '',
        notice_acknowledged: true,
      }
    : { ...EMPTY_DRAFT, ...(typeof window === 'undefined' ? null : rememberedTerritory()) }
  const [draft, setDraft, restored] = useAutosaveDraft<DraftState>(draftKey, initialDraft)
  // A slot only counts as attached once its upload has actually succeeded —
  // `status` tracks that separately from the picked file so an in-flight or
  // failed upload is never shown the same way as a confirmed one.
  const [documents, setDocuments] = useState<Record<string, File | null>>({})
  const [documentStatus, setDocumentStatus] = useState<Record<string, 'uploading' | 'success' | 'error' | undefined>>({})
  const [documentErrors, setDocumentErrors] = useState<Record<string, string | undefined>>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [warnings, setWarnings] = useState<OnboardingWarning[]>(existing?.warnings ?? [])
  const [onboardingId, setOnboardingId] = useState<number | undefined>(existing?.onboarding_id)
  const [submitError, setSubmitError] = useState<{ message: string; missing?: string[] } | null>(null)

  // A reload loses component state but not the autosaved draft: pick the
  // onboarding id back up from it rather than creating a duplicate customer.
  useEffect(() => {
    if (!onboardingId && draft.onboarding_id) setOnboardingId(draft.onboarding_id)
  }, [onboardingId, draft.onboarding_id])

  const photoUploads = usePhotoUploads({
    scope: `onboarding-${onboardingId ?? 'pending'}`,
    upload: (slot, photo, onProgress) => {
      if (!onboardingId) return Promise.reject(new Error('onboarding not created yet'))
      const camera = photo.capture_method === 'camera'
      return uploadMutation.mutateAsync({
        id: onboardingId,
        input: {
          file: photo.file,
          kind: 'photo',
          photo_slot: slot,
          capture_method: photo.capture_method,
          // Gallery photos carry no location or capture time: it would not be verified anyway.
          ...(camera
            ? { latitude: photo.latitude, longitude: photo.longitude, captured_at: photo.captured_at, accuracy_m: photo.accuracy_m }
            : { exif_taken_at_client: photo.exif_taken_at_client }),
          onProgress,
        },
      })
    },
    describeError: (err) => (err instanceof ApiError ? err.detail || err.message : copy.photos.uploadFailed),
  })

  const { data: options, isLoading: optionsLoading } = useOnboardingOptions()

  const createMutation = useCreateOnboarding()
  const updateMutation = useUpdateOnboarding()
  const uploadMutation = useUploadOnboardingFile()
  const submitMutation = useSubmitOnboarding()

  const steps: (keyof WizardCopy['steps'])[] = ['notice', 'customer', 'connection', 'property', 'requirement', 'documents', 'photos', 'review']
  const stepKey = steps[stepIndex]

  function update<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function ensureOnboarding(): Promise<number> {
    // Editing an already-created onboarding: PATCH the current draft fields
    // rather than re-creating — this is also the path that returns a
    // submitted customer to draft (see copy.editing.returnedToDraftNotice).
    if (onboardingId) {
      if (existing) {
        await updateMutation.mutateAsync({
          id: onboardingId,
          patch: {
            customer: { name: draft.customer_name, mobile: draft.customer_mobile, email: draft.customer_email || null },
            connection_in_customer_name: draft.connection_in_customer_name === 'yes',
            property_in_customer_name: draft.property_in_customer_name === 'yes',
            customer_timeline: draft.customer_timeline,
          },
        })
      }
      return onboardingId
    }
    const res = await createMutation.mutateAsync({
      notice_version: options!.notice.version,
      notice_acknowledged: true,
      customer: { name: draft.customer_name, mobile: draft.customer_mobile, email: draft.customer_email || null },
      territory: {
        state_lgd_code: Number(draft.state_lgd_code),
        district_lgd_code: draft.district_lgd_code ? Number(draft.district_lgd_code) : undefined,
        block_lgd_code: draft.block_lgd_code ? Number(draft.block_lgd_code) : undefined,
      },
      connection_in_customer_name: draft.connection_in_customer_name === 'yes',
      property_in_customer_name: draft.property_in_customer_name === 'yes',
      customer_timeline: draft.customer_timeline,
      equipment_package: draft.equipment_package,
    })
    setOnboardingId(res.onboarding.onboarding_id)
    setDraft((d) => ({ ...d, onboarding_id: res.onboarding.onboarding_id }))
    setWarnings(res.warnings)
    return res.onboarding.onboarding_id
  }

  async function handleContinue() {
    setSubmitError(null)
    if (stepKey === 'notice' && !draft.notice_acknowledged) return
    if (stepKey === 'requirement') {
      try {
        await ensureOnboarding()
      } catch (err) {
        setSubmitError({ message: err instanceof ApiError ? err.detail || err.message : 'Failed to save' })
        return
      }
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  }

  function handleBack() {
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  async function handleUploadDocument(documentType: string, file: File | null) {
    if (!file) {
      setDocuments((d) => ({ ...d, [documentType]: null }))
      setDocumentStatus((s) => ({ ...s, [documentType]: undefined }))
      setDocumentErrors((e) => ({ ...e, [documentType]: undefined }))
      return
    }
    if (!onboardingId) return
    setDocuments((d) => ({ ...d, [documentType]: file }))
    setDocumentStatus((s) => ({ ...s, [documentType]: 'uploading' }))
    setDocumentErrors((e) => ({ ...e, [documentType]: undefined }))
    try {
      await uploadMutation.mutateAsync({ id: onboardingId, input: { file, kind: 'document', document_type: documentType } })
      setDocumentStatus((s) => ({ ...s, [documentType]: 'success' }))
    } catch (err) {
      setDocumentStatus((s) => ({ ...s, [documentType]: 'error' }))
      setDocumentErrors((e) => ({
        ...e,
        [documentType]: err instanceof ApiError ? err.detail || err.message : copy.documents.uploadFailed,
      }))
    }
  }

  function retryDocumentUpload(documentType: string) {
    const file = documents[documentType]
    if (file) void handleUploadDocument(documentType, file)
  }

  async function handleSubmit() {
    if (!onboardingId) return
    setSubmitError(null)
    try {
      await submitMutation.mutateAsync(onboardingId)
      clearAutosaveDraft(draftKey)
      router.push(`${portalBase}/customers/${onboardingId}`)
    } catch (err) {
      if (err instanceof ApiError && err.structuredDetail?.code === 'incomplete') {
        const missing = (err.structuredDetail.missing_documents as string[]) ?? []
        setSubmitError({ message: err.structuredDetail.message as string, missing })
      } else {
        setSubmitError({ message: err instanceof ApiError ? err.detail || err.message : 'Failed to submit' })
      }
    }
  }

  if (optionsLoading || !options) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#111827]/30" />
      </div>
    )
  }

  // The submit-time `missing_documents` list is a list of document type
  // keys, not labels — look each one up against the same options the
  // documents step already renders labels from, so review never shows a
  // raw backend key like "electricity_bill".
  const documentLabelByKey = new Map(options.documents.map((d) => [d.key, d.label]))

  // A 409 not_editable customer (no longer draft/submitted) can't be
  // changed from here — a clear, distinct state, not a generic error.
  if (existing && existing.can_edit === false) {
    return (
      <div className="rounded-2xl border border-[#e4e8ee] bg-white p-8 text-center">
        <p className="font-utility text-sm text-[#111827]/70">{copy.editing.notEditableNotice}</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>

      {restored && (
        <p className="mt-3 rounded-lg bg-[#2f5daa]/10 px-3.5 py-2.5 text-xs text-[#0e2a63] font-utility">{copy.restoredNotice}</p>
      )}

      {existing && existing.status === 'submitted' && (
        <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-800 font-utility">
          {copy.editing.returnedToDraftNotice}
        </p>
      )}

      <ol className="mt-6 flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <li
            key={String(s)}
            className={`rounded-full px-3 py-1 text-xs font-utility ${
              i === stepIndex ? 'bg-[#0e2a63] text-white font-semibold' : i < stepIndex ? 'bg-[#2f5daa]/15 text-[#0e2a63]' : 'bg-[#f7f9fc] text-[#111827]/40'
            }`}
          >
            {copy.steps[s]}
          </li>
        ))}
      </ol>

      {warnings.length > 0 && (
        <div className="mt-5 space-y-2">
          {warnings.map((w) => (
            <WarningNotice key={w.code} warning={w} copy={copy.warnings} />
          ))}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-[#e4e8ee] bg-white p-6 space-y-5">
        {stepKey === 'notice' && (
          <div>
            <p className="font-display text-lg font-semibold text-[#0e2a63]">{copy.notice.title}</p>
            <p className="mt-3 text-sm text-[#111827]/70 leading-relaxed whitespace-pre-line">{options.notice.text}</p>
            <label className="mt-5 flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.notice_acknowledged}
                onChange={(e) => update('notice_acknowledged', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#e4e8ee]"
              />
              <span className="text-sm text-[#111827]/80 font-utility">{copy.notice.confirmLabel}</span>
            </label>
            {!draft.notice_acknowledged && submitError && (
              <p className="mt-2 text-xs text-red-500 font-utility">{copy.notice.confirmRequired}</p>
            )}
          </div>
        )}

        {stepKey === 'customer' && (
          <div className="space-y-4">
            <Field label={copy.customer.nameLabel}>
              <input className={inputClass} value={draft.customer_name} onChange={(e) => update('customer_name', e.target.value)} />
            </Field>
            <Field label={copy.customer.mobileLabel}>
              <input className={inputClass} value={draft.customer_mobile} onChange={(e) => update('customer_mobile', e.target.value)} />
            </Field>
            <Field label={copy.customer.emailLabel}>
              <input className={inputClass} value={draft.customer_email} onChange={(e) => update('customer_email', e.target.value)} />
            </Field>
          </div>
        )}

        {stepKey === 'connection' && (
          <div className="space-y-4">
            <TerritorySelect
              idPrefix="connection"
              copy={territory}
              value={{ state: draft.state_lgd_code, district: draft.district_lgd_code, block: draft.block_lgd_code }}
              onChange={(n) => {
                setDraft((d) => ({ ...d, state_lgd_code: n.state, district_lgd_code: n.district, block_lgd_code: n.block }))
                try {
                  window.sessionStorage.setItem(LAST_TERRITORY_KEY, JSON.stringify({ state_lgd_code: n.state, district_lgd_code: n.district }))
                } catch {
                  /* storage unavailable — pre-fill is a convenience only */
                }
              }}
              labels={{ state: copy.connection.stateLabel, district: copy.connection.districtLabel, block: copy.connection.blockLabel }}
              inputClass={() => inputClass}
              renderField={({ id, label, children }) => <Field label={label} htmlFor={id}>{children}</Field>}
            />
            <Field label={copy.connection.connectionInCustomerNameLabel}>
              <select
                className={inputClass}
                value={draft.connection_in_customer_name}
                onChange={(e) => update('connection_in_customer_name', e.target.value as 'yes' | 'no')}
              >
                <option value="" />
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
          </div>
        )}

        {stepKey === 'property' && (
          <div className="space-y-4">
            <Field label={copy.property.propertyInCustomerNameLabel}>
              <select
                className={inputClass}
                value={draft.property_in_customer_name}
                onChange={(e) => update('property_in_customer_name', e.target.value as 'yes' | 'no')}
              >
                <option value="" />
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label={copy.property.customerTimelineLabel}>
              <select className={inputClass} value={draft.customer_timeline} onChange={(e) => update('customer_timeline', e.target.value)}>
                <option value="" />
                {options.customer_timelines.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {stepKey === 'requirement' && (
          <div className="space-y-6">
            <div>
              <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.requirement.title}</p>
              <p className="mt-1 text-sm text-[#111827]/55 leading-relaxed">{copy.requirement.subtitle}</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {options.equipment_packages.map((pkg) => {
                  const selected = draft.equipment_package === pkg.key
                  return (
                    <button
                      key={pkg.key}
                      type="button"
                      onClick={() => update('equipment_package', pkg.key)}
                      className={`rounded-xl border-2 p-5 text-left transition-colors ${
                        selected ? 'border-[#0e2a63] bg-[#0e2a63]/5' : 'border-[#e4e8ee] hover:border-[#2f5daa]/40'
                      }`}
                    >
                      <p className="font-display text-base font-semibold text-[#0e2a63]">{pkg.label}</p>
                      {selected && <CheckCircle2 className="mt-2 h-4 w-4 text-[#0e2a63]" />}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="rounded-lg bg-[#f7f9fc] p-4">
              <p className="font-utility text-sm font-semibold text-[#0e2a63]">{copy.requirement.dcrTitle}</p>
              <p className="mt-1.5 text-xs text-[#111827]/60 leading-relaxed">{copy.requirement.dcrExplainer}</p>
            </div>
          </div>
        )}

        {stepKey === 'documents' && (
          <div className="space-y-5">
            <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.documents.title}</p>
            {options.documents.map((doc) => (
              <FileUploadSlot
                key={doc.key}
                label={doc.label}
                why={doc.required_when ?? ''}
                accept="image/*,application/pdf"
                acceptedTypesLabel="JPG, PNG or PDF"
                file={documents[doc.key] ?? null}
                onChange={(f) => void handleUploadDocument(doc.key, f)}
                chooseLabel={copy.documents.uploadButton}
                replaceLabel={copy.documents.replaceButton}
                whyLabel={copy.documents.missingLabel}
                uploading={documentStatus[doc.key] === 'uploading'}
                error={documentStatus[doc.key] === 'error' ? documentErrors[doc.key] : undefined}
                onRetry={documentStatus[doc.key] === 'error' ? () => retryDocumentUpload(doc.key) : undefined}
                retryLabel={copy.documents.retryButton}
              />
            ))}
          </div>
        )}

        {stepKey === 'photos' && (
          <div className="space-y-5">
            <div>
              <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.photos.title}</p>
              <p className="mt-1 text-xs text-[#111827]/55 leading-relaxed">{copy.photos.geotagNote}</p>
            </div>
            {options.photo_slots.map((slot) => (
              <PhotoCaptureSlot
                key={slot.key}
                label={slot.label}
                exampleUrl={slot.example_image_url}
                exampleLabel={copy.photos.exampleLabel}
                captureLabel={copy.photos.captureButton}
                locationRequiredLabel={copy.photos.locationRequired}
                retryLabel={copy.photos.retryButton}
                value={photoUploads.photos[slot.key] ?? null}
                onChange={(p) => void photoUploads.capture(slot.key, p)}
                status={photoUploads.status[slot.key]}
                progress={photoUploads.progress[slot.key]}
                uploadError={photoUploads.errors[slot.key]}
                onRetryUpload={photoUploads.status[slot.key] === 'error' ? () => photoUploads.retry(slot.key) : undefined}
              />
            ))}
          </div>
        )}

        {stepKey === 'review' && (
          <div className="space-y-4">
            <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.review.title}</p>
            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{submitError.message}</p>
                {submitError.missing && submitError.missing.length > 0 && (
                  <>
                    <p className="mt-2 text-xs font-semibold text-red-800">{copy.review.missingDocumentsLabel}</p>
                    <ul className="mt-1 list-disc list-inside text-xs text-red-700">
                      {submitError.missing.map((m) => (
                        <li key={m}>{documentLabelByKey.get(m) ?? m}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitMutation.isPending}
              className="w-full rounded-xl bg-[#0e2a63] px-5 py-3 text-sm font-semibold text-white font-utility disabled:opacity-50"
            >
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : copy.review.submitButton}
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={stepIndex === 0}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-utility text-[#111827]/60 disabled:opacity-0"
        >
          <ArrowLeft className="h-4 w-4" /> {copy.backButton}
        </button>
        {stepKey !== 'review' && (
          <button
            type="button"
            onClick={() => void handleContinue()}
            disabled={stepKey === 'notice' && !draft.notice_acknowledged}
            className="flex items-center gap-1.5 rounded-lg bg-[#0e2a63] px-5 py-2.5 text-sm font-semibold text-white font-utility disabled:opacity-40"
          >
            {copy.continueButton} <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
