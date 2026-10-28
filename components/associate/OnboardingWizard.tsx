'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import TerritorySelect, { type TerritoryCopy } from '@/components/associate/TerritorySelect'
import { clearAutosaveDraft, useAutosaveDraft } from '@/lib/associate/useAutosaveDraft'
import {
  useOnboardingOptions,
  useCreateOnboarding,
  useUpdateOnboarding,
  useUploadOnboardingFile,
  useSubmitOnboarding,
} from '@/lib/associate/onboarding-api-client'
import { useRefreshSurvey, useSurveyResults, useSurveyStatus } from '@/lib/associate/survey-api-client'
import { ApiError, isMissingClaimsError } from '@/lib/dashboard/api-error'
import { errorCodeOf, inactiveAccountOf, portalErrorText } from '@/lib/associate/portal-error'
import { PortalError } from '@/components/associate/PortalError'
import FileUploadSlot from '@/components/associate/FileUploadSlot'
import PhotoCaptureSlot from '@/components/associate/PhotoCaptureSlot'
import { OrEquivalentNote, PackageEquipment } from '@/components/pricing/PackageCards'
import { usePackageCatalogue } from '@/lib/pricing/usePackageCatalogue'
import PhotosFirstCard from '@/components/associate/PhotosFirstCard'
import SiteLocationStep, { PhotoLocationPrompt } from '@/components/associate/SiteLocationStep'
import SurveyStep from '@/components/associate/survey/SurveyStep'
import { BillsStep, ConnectionSurveyFields, LayoutStep, RoofSurveyFields } from '@/components/associate/survey/SurveyFieldSteps'
import { FormField, SelectField, YesNoField, inputClass } from '@/components/associate/wizard-fields'
import { usePhotoUploads } from '@/lib/associate/usePhotoUploads'
import { useUnsavedGuard } from '@/lib/proposals/use-unsaved-guard'
import { inTurn } from '@/lib/associate/serial-uploads'
import { purgePendingPhotoScope } from '@/lib/associate/photo-queue'
import { LAST_TERRITORY_KEY, onboardingDraftKey, useDraftUserId } from '@/lib/associate/portal-session'
import { bestPhotoCandidate, serverPhotoCandidates } from '@/lib/associate/site-location'
import {
  ALL_SURVEY_FIELDS,
  EMPTY_SURVEY_FORM,
  STEP_FIELDS,
  recentMonths,
  splitDerivedPatch,
  stepOfField,
  stepOfSection,
  surveyFieldErrorOf,
  surveyFormFromSiteAssessment,
  surveyPatch,
  type SurveyForm,
  type SurveyStepKey,
} from '@/lib/associate/survey'
import { validateWizardStep, type StepErrors, type WizardDraft } from '@/lib/associate/wizard-validation'
import {
  CONNECTION_TYPES,
  CUSTOMER_TYPES,
  SITE_TYPES,
  SITE_LOCATION_WARNING_CODES,
  photoSlotsOf,
  type CreateOnboardingInput,
  type Onboarding,
  type OnboardingOptions,
  type OnboardingWarning,
  type PhotoSlotOption,
  type SiteLocation,
} from '@/lib/associate/onboarding-types'
import type { SurveyStatus } from '@/lib/associate/survey-types'
import { useLocale, useMessages, useOptionalMessages } from '@/lib/i18n/client'
import { localizeHref } from '@/lib/i18n/config'
import { fmt, type Messages } from '@/lib/i18n/types'

type WizardCopy = Messages['associates']['portal']['wizard']
type StepKey = keyof WizardCopy['steps']

export const WIZARD_STEPS: StepKey[] = ['notice', 'customer', 'connection', 'bills', 'property', 'requirement', 'house', 'layout', 'documents', 'photos', 'survey', 'review']

// Fields saved on each step's Continue once the customer exists (flat PATCH body,
// openapi.json `OnboardingUpdate`). Survey fields come from STEP_FIELDS.
const CORE_STEP_FIELDS: Partial<Record<StepKey, readonly string[]>> = {
  customer: ['customer_name', 'customer_mobile', 'customer_email', 'customer_type', 'pin_code', 'full_address'],
  connection: ['state_lgd_code', 'district_lgd_code', 'block_lgd_code', 'connection_in_customer_name', 'site_type', 'connection_type'],
  property: ['property_in_customer_name', 'customer_timeline'],
  requirement: ['equipment_package', 'desired_output_kw'],
}

function stepOfAnyField(field: string): StepKey | null {
  for (const [step, fields] of Object.entries(CORE_STEP_FIELDS)) if (fields?.includes(field)) return step as StepKey
  return stepOfField(field)
}

// The photo slot embedded in the house step (the first camera photo the associate takes).
const HOUSE_PHOTO_SLOT = 'panel_installation_area'

// A new customer usually lives in the same area as the previous one: pre-fill
// state / district from earlier in this browser session.
function rememberedTerritory(): Pick<WizardDraft, 'state_lgd_code' | 'district_lgd_code'> | null {
  try {
    const raw = window.sessionStorage.getItem(LAST_TERRITORY_KEY)
    return raw ? (JSON.parse(raw) as Pick<WizardDraft, 'state_lgd_code' | 'district_lgd_code'>) : null
  } catch {
    return null
  }
}

const EMPTY_DRAFT: WizardDraft = {
  customer_name: '',
  customer_mobile: '',
  customer_email: '',
  customer_type: '',
  pin_code: '',
  full_address: '',
  state_lgd_code: '',
  district_lgd_code: '',
  block_lgd_code: '',
  connection_in_customer_name: '',
  site_type: '',
  connection_type: '',
  property_in_customer_name: '',
  customer_timeline: '',
  equipment_package: '',
  desired_output_kw: '',
  notice_acknowledged: false,
  survey: EMPTY_SURVEY_FORM,
}

const saString = (sa: Record<string, unknown> | null | undefined, key: string) => (typeof sa?.[key] === 'string' ? (sa[key] as string) : '')

function draftFromOnboarding(o: Onboarding, options: OnboardingOptions): WizardDraft {
  const sa = o.site_assessment as Record<string, unknown> | null
  return {
    customer_name: o.customer.name,
    customer_mobile: o.customer.mobile,
    customer_email: o.customer.email ?? '',
    // Hydrated when the server echoes them in site_assessment; otherwise asked again.
    customer_type: saString(sa, 'customer_type'),
    pin_code: saString(sa, 'pin_code'),
    full_address: saString(sa, 'full_address'),
    state_lgd_code: String(o.territory.state.lgd_code),
    district_lgd_code: o.territory.district ? String(o.territory.district.lgd_code) : '',
    block_lgd_code: o.territory.block ? String(o.territory.block.lgd_code) : '',
    connection_in_customer_name: o.connection_in_customer_name ? 'yes' : 'no',
    site_type: saString(sa, 'site_type'),
    connection_type: saString(sa, 'connection_type'),
    property_in_customer_name: o.property_in_customer_name ? 'yes' : 'no',
    customer_timeline: o.customer_timeline ?? '',
    equipment_package: '',
    desired_output_kw: sa?.desired_output_kw != null ? String(sa.desired_output_kw) : '',
    notice_acknowledged: true,
    survey: surveyFormFromSiteAssessment(sa, options.survey.discom_options),
    onboarding_id: o.onboarding_id,
  }
}

const textOrNull = (v: string) => (v.trim() ? v.trim() : null)
const intOrNull = (v: string) => (v.trim() ? Number(v) : null)
const boolOrNull = (v: '' | 'yes' | 'no') => (v === 'yes' ? true : v === 'no' ? false : null)

/** Core fields as the flat body carries them. */
function corePayload(d: WizardDraft): Record<string, unknown> {
  return {
    customer_name: d.customer_name.trim(),
    customer_mobile: d.customer_mobile.trim(),
    customer_email: textOrNull(d.customer_email),
    customer_type: textOrNull(d.customer_type),
    pin_code: textOrNull(d.pin_code),
    full_address: textOrNull(d.full_address),
    state_lgd_code: intOrNull(d.state_lgd_code),
    district_lgd_code: intOrNull(d.district_lgd_code),
    block_lgd_code: intOrNull(d.block_lgd_code),
    connection_in_customer_name: boolOrNull(d.connection_in_customer_name),
    site_type: textOrNull(d.site_type),
    connection_type: textOrNull(d.connection_type),
    property_in_customer_name: boolOrNull(d.property_in_customer_name),
    customer_timeline: textOrNull(d.customer_timeline),
    equipment_package: textOrNull(d.equipment_package),
    // A size, not money: sent as the number the backend's float field takes.
    desired_output_kw: d.desired_output_kw?.trim() ? Number(d.desired_output_kw.trim()) : null,
  }
}

// The server normalises mobiles (+91…); compare the last ten digits only.
const comparable = (key: string, v: unknown) => {
  if (v === undefined || v === '') return null
  if (key === 'customer_mobile' && typeof v === 'string') return v.replace(/\D/g, '').slice(-10)
  return v
}

/** Changed core fields of a step, compared with what the server last returned. */
function corePatch(d: WizardDraft, server: WizardDraft, fields: readonly string[]): Record<string, unknown> {
  const mine = corePayload(d)
  const theirs = corePayload(server)
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    // An untouched package choice on an existing customer is never re-sent.
    if (f === 'equipment_package' && !mine[f]) continue
    if (JSON.stringify(comparable(f, mine[f])) !== JSON.stringify(comparable(f, theirs[f]))) out[f] = mine[f]
  }
  return out
}

function WarningNotice({ warning, copy }: { warning: OnboardingWarning; copy: WizardCopy['warnings'] }) {
  // attribution_review deliberately withholds who — the backend never sends
  // a name for it, and this notice must never imply one exists to guess.
  const text = (copy as Record<string, string>)[warning.code] ?? warning.message
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
      <p className="text-sm text-amber-800 leading-relaxed">{text}</p>
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
function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
}

const anySigned = (s: SurveyStatus | undefined) => !!s && (s.signatures.customer.signed || s.signatures.associate.signed)

interface Props {
  copy: WizardCopy
  territory: TerritoryCopy
  portalBase: '/associates/portal' | '/preferred/portal'
  existing?: Onboarding
  // Deep link from a to-do ("add / confirm the house location").
  initialStep?: 'connection' | 'bills' | 'house' | 'layout' | 'survey'
}

/**
 * Waits for the signed-in user (drafts are scoped to them) and the options
 * (the survey's DISCOM list shapes the draft), then mounts the wizard keyed
 * by its draft so a different user or customer never sees another's draft.
 */
export default function OnboardingWizard(props: Props) {
  const { userId, ready } = useDraftUserId()
  const { data: options, isLoading, error, refetch } = useOnboardingOptions()
  if (error) return <PortalError error={error} onRetry={() => void refetch()} />
  if (!ready || isLoading || !options) {
    return (
      <div className="flex items-center justify-center py-20" role="status">
        <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none text-[#111827]/65" aria-hidden="true" />
      </div>
    )
  }
  const draftKey = onboardingDraftKey(userId, props.existing?.onboarding_id ?? 'new')
  return <WizardInner key={draftKey} {...props} options={options} userId={userId} draftKey={draftKey} />
}

function WizardInner({
  copy,
  territory,
  portalBase,
  existing,
  initialStep,
  options,
  userId,
  draftKey,
}: Props & { options: OnboardingOptions; userId: string | null; draftKey: string }) {
  const router = useRouter()
  const locale = useLocale()
  const siteCopy = useMessages('siteLocation')
  const surveyCopy = useMessages('survey')
  const missingClaims = useOptionalMessages('portalErrors')?.missingClaims?.body
  const feedback = useMessages('portalFeedback')
  const online = useOnline()
  // Real makes and technology per package (public endpoint); the cards still work without it.
  const { catalogue } = usePackageCatalogue()
  const surveyOptions = options.survey

  // Prompt for the requested months of bills when none are recorded (month-only rows are never sent).
  const billPrompts = () => recentMonths(surveyOptions.requested_consumption_months).map((month) => ({ month, units: '', bill: '' }))
  const fromServer = existing ? draftFromOnboarding(existing, options) : null
  const initialDraft: WizardDraft = fromServer
    ? { ...fromServer, survey: fromServer.survey.bills.length ? fromServer.survey : { ...fromServer.survey, bills: billPrompts() } }
    : {
        ...EMPTY_DRAFT,
        ...(typeof window === 'undefined' ? null : rememberedTerritory()),
        survey: { ...EMPTY_SURVEY_FORM, bills: billPrompts() },
      }
  const [draft, setDraft, restored] = useAutosaveDraft<WizardDraft>(draftKey, initialDraft)
  // The server's latest picture of this customer — the baseline every PATCH is diffed against.
  const [server, setServer] = useState<Onboarding | undefined>(existing)
  const serverDraft = useMemo(() => (server ? draftFromOnboarding(server, options) : null), [server, options])

  // A slot only counts as attached once its upload has actually succeeded —
  // `status` tracks that separately from the picked file so an in-flight or
  // failed upload is never shown the same way as a confirmed one.
  const [documents, setDocuments] = useState<Record<string, File | null>>({})
  const [documentStatus, setDocumentStatus] = useState<Record<string, 'uploading' | 'success' | 'error' | undefined>>({})
  const [documentErrors, setDocumentErrors] = useState<Record<string, string | undefined>>({})
  const steps = WIZARD_STEPS
  const [stepIndex, setStepIndex] = useState(() => (existing && initialStep ? steps.indexOf(initialStep) : 0))
  const [siteLocation, setSiteLocation] = useState<SiteLocation | undefined>(existing?.site_location)
  const [warnings, setWarnings] = useState<OnboardingWarning[]>(existing?.warnings ?? [])
  const [onboardingId, setOnboardingId] = useState<number | undefined>(existing?.onboarding_id ?? draft.onboarding_id)
  const [fieldErrors, setFieldErrors] = useState<StepErrors>({})
  const [stepError, setStepError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [resignNotice, setResignNotice] = useState(false)
  const [confirmStartOver, setConfirmStartOver] = useState(false)
  const [submitError, setSubmitError] = useState<{
    message: string
    missing?: string[]
    locationMissing?: boolean
    locationUnconfirmed?: boolean
    surveySections?: string[]
    surveyUnsigned?: string[]
  } | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const stepBodyRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  const createMutation = useCreateOnboarding()
  const updateMutation = useUpdateOnboarding()
  const uploadMutation = useUploadOnboardingFile()
  const submitMutation = useSubmitOnboarding()
  const refreshSurvey = useRefreshSurvey()
  const surveyStatus = useSurveyStatus(onboardingId)
  const surveyResults = useSurveyResults(onboardingId)

  const stepKey = steps[stepIndex]
  const isNew = !existing

  // Every response carries the whole onboarding — adopt it as the new baseline.
  function adopt(o: Onboarding | undefined) {
    if (!o || typeof o !== 'object' || !('onboarding_id' in o)) return
    setServer(o)
    if (o.site_location) setSiteLocation(o.site_location)
  }

  const photoUploads = usePhotoUploads({
    scope: `onboarding-${onboardingId ?? 'pending'}`,
    owner: userId,
    upload: (slot, photo, onProgress) => {
      if (!onboardingId) return Promise.reject(new Error('onboarding not created yet'))
      const camera = photo.capture_method === 'camera'
      return uploadMutation
        .mutateAsync({
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
        .then((res) => {
          adopt(res)
          return res
        })
    },
    describeError: (err) => errorText(err, copy.photos.uploadFailed),
  })

  // On step change: back to the top, focus the step heading (not on first paint).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollTo?.({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    headingRef.current?.focus({ preventScroll: true })
  }, [stepIndex])

  // Keep the current step's chip visible in the scrolling step strip.
  const stepsRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const chip = stepsRef.current?.querySelector<HTMLElement>('[aria-current="step"]')
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    chip?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [stepIndex])

  // Focus the first invalid field once errors render.
  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) return
    const el = stepBodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')
    el?.focus()
  }, [fieldErrors])

  // The server's English text is never shown: a known code or an inactive account gets its
  // own sentence, anything else the caller's translated fallback.
  function errorText(err: unknown, fallback: string): string {
    if (isMissingClaimsError(err)) return missingClaims ?? fallback
    if (err instanceof ApiError && err.status === 0) return surveyCopy.saveErrors.offline
    const code = errorCodeOf(err)
    if (inactiveAccountOf(err) || (code && code in feedback.codes)) return portalErrorText(err, feedback)
    return fallback
  }

  function goToStep(step: StepKey) {
    const i = steps.indexOf(step)
    if (i >= 0) {
      setFieldErrors({})
      setStepError(null)
      setStepIndex(i)
    }
  }

  // Translates a save error into inline field errors and moves to their step.
  function applySaveError(err: unknown): boolean {
    const se = surveyFieldErrorOf(err)
    if (se) {
      const b = surveyCopy.bills.errors
      let key = se.field ?? ''
      const known = { ...surveyCopy.roof.errors, ...surveyCopy.layout.errors, ...surveyCopy.bills.errors, ...feedback.codes } as Record<string, string>
      let msg = known[se.code] ?? copy.saveFailed
      if (se.field === 'consumption_history') {
        key = se.code === 'too_many_months' || se.index == null ? 'bills' : `bills.${se.index}`
        msg = se.code === 'too_many_months' ? fmt(b.too_many_months, { max: se.max_months ?? surveyOptions.max_consumption_months }) : ((b as Record<string, string>)[se.code] ?? msg)
      } else if (se.code === 'obstacle_exceeds_section') {
        key = se.index != null ? `roof_sections.${se.index}` : 'roof_sections'
        msg = surveyCopy.roof.errors.obstacle_exceeds_section
      } else if (se.code === 'derived_field') {
        key = 'shadow_free_area_sqft'
        msg = surveyCopy.roof.errors.derived_field
      } else if (se.code === 'out_of_range') {
        msg = fmt(surveyCopy.layout.errors.out_of_range, { max: se.max_m ?? surveyOptions.distance_max_m })
      } else if (se.code === 'roofs_considered_exceeds_available') {
        key = 'roofs_considered_count'
        msg = surveyCopy.roof.errors.roofs_considered_exceeds_available
      }
      const field = key.split('.')[0]
      const target = stepOfAnyField(field === 'bills' ? 'consumption_history' : field)
      if (target && target !== stepKey) setStepIndex(steps.indexOf(target))
      setFieldErrors({ [key]: msg })
      setStepError(surveyCopy.saveErrors.fixHighlighted)
      return true
    }
    // FastAPI's standard 422: a list of {loc: ["body", field, …], msg}.
    if (err instanceof ApiError && err.status === 422 && Array.isArray(err.structuredDetail)) {
      const errs: StepErrors = {}
      let target: StepKey | null = null
      for (const item of err.structuredDetail as { loc?: unknown[] }[]) {
        const field = Array.isArray(item.loc) && typeof item.loc[1] === 'string' ? item.loc[1] : null
        if (!field) continue
        errs[field] = copy.validation.fixErrors
        target ??= stepOfAnyField(field)
      }
      if (Object.keys(errs).length) {
        if (target && target !== stepKey) setStepIndex(steps.indexOf(target))
        setFieldErrors(errs)
        setStepError(surveyCopy.saveErrors.fixHighlighted)
        return true
      }
    }
    return false
  }

  async function createOnboarding(): Promise<number> {
    const core = corePayload(draft)
    const body: CreateOnboardingInput = {
      notice_version: options.notice.version,
      notice_acknowledged: true,
      customer_name: core.customer_name as string,
      customer_mobile: core.customer_mobile as string,
      ...(core.customer_email ? { customer_email: core.customer_email as string } : {}),
      customer_type: core.customer_type as CreateOnboardingInput['customer_type'],
      project_family: 'rooftop_solar',
      pin_code: core.pin_code as string,
      full_address: core.full_address as string,
      site_type: core.site_type as CreateOnboardingInput['site_type'],
      connection_type: core.connection_type as CreateOnboardingInput['connection_type'],
      state_lgd_code: core.state_lgd_code as number,
      district_lgd_code: core.district_lgd_code as number,
      ...(core.block_lgd_code != null ? { block_lgd_code: core.block_lgd_code as number } : {}),
      connection_in_customer_name: core.connection_in_customer_name === true,
      property_in_customer_name: core.property_in_customer_name === true,
      ...(core.customer_timeline ? { customer_timeline: core.customer_timeline as string } : {}),
      ...(core.equipment_package ? { equipment_package: core.equipment_package as string } : {}),
      ...(core.desired_output_kw != null ? { desired_output_kw: core.desired_output_kw as number } : {}),
      // Survey answers given so far ride along (only what was actually entered).
      ...surveyPatch(draft.survey, EMPTY_SURVEY_FORM, ALL_SURVEY_FIELDS),
    }
    const res = await createMutation.mutateAsync(body)
    adopt(res)
    setOnboardingId(res.onboarding_id)
    setDraft((d) => ({ ...d, onboarding_id: res.onboarding_id }))
    setWarnings(res.warnings ?? [])
    return res.onboarding_id
  }

  /** PATCH what this step changed (nothing when nothing changed); detects cleared signatures. */
  async function saveStep(step: StepKey): Promise<void> {
    if (!onboardingId || !serverDraft) return
    const surveyFields = (STEP_FIELDS as Record<string, readonly string[]>)[step] ?? []
    const patch = {
      ...corePatch(draft, serverDraft, CORE_STEP_FIELDS[step] ?? []),
      ...surveyPatch(draft.survey, serverDraft.survey, surveyFields),
    }
    if (Object.keys(patch).length === 0) return
    const signedBefore = anySigned(surveyStatus.data)
    for (const part of splitDerivedPatch(patch, serverDraft.survey)) {
      adopt(await updateMutation.mutateAsync({ id: onboardingId, patch: part }))
    }
    // Survey edits after signing clear both signatures (resign_after_edit, §1).
    if (surveyFields.length && Object.keys(patch).some((k) => surveyFields.includes(k))) {
      const after = await refreshSurvey(onboardingId)
      if (signedBefore && after && !anySigned(after)) setResignNotice(true)
    }
  }

  async function handleContinue() {
    if (busyRef.current) return
    setSubmitError(null)
    setStepError(null)
    if (stepKey === 'notice' && !draft.notice_acknowledged) {
      setStepError(copy.notice.confirmRequired)
      return
    }
    if (stepKey === 'house' && !siteLocation?.confirmed) return
    const errs = validateWizardStep(stepKey, draft, {
      isNew,
      survey: surveyOptions,
      v: { ...copy.validation, kw: copy.requirement.desiredKwInvalid },
      s: { bills: surveyCopy.bills.errors, roof: surveyCopy.roof.errors, layout: surveyCopy.layout.errors },
    })
    setFieldErrors(errs)
    if (Object.keys(errs).length) {
      setStepError(copy.validation.fixErrors)
      return
    }
    busyRef.current = true
    setBusy(true)
    try {
      if (!onboardingId && stepKey === 'requirement') await createOnboarding()
      else await saveStep(stepKey)
      setStepIndex((i) => Math.min(i + 1, steps.length - 1))
    } catch (err) {
      if (!applySaveError(err)) setStepError(errorText(err, copy.saveFailed))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function handleBack() {
    setFieldErrors({})
    setStepError(null)
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  function startOver() {
    clearAutosaveDraft(draftKey)
    void purgePendingPhotoScope(photoUploads.scope)
    setDraft({ ...EMPTY_DRAFT, survey: initialDraft.survey })
    setOnboardingId(undefined)
    setServer(undefined)
    setSiteLocation(undefined)
    setWarnings([])
    setDocuments({})
    setDocumentStatus({})
    setFieldErrors({})
    setStepError(null)
    setSubmitError(null)
    setResignNotice(false)
    setConfirmStartOver(false)
    setStepIndex(0)
  }

  function update<K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
    setFieldErrors((e) => (e[key as string] ? { ...e, [key as string]: '' } : e))
  }
  function updateSurvey(p: Partial<SurveyForm>) {
    setDraft((d) => ({ ...d, survey: { ...d.survey, ...p } }))
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
      // One upload at a time per customer (lib/associate/serial-uploads.ts).
      adopt(await inTurn(`onboarding-${onboardingId}`, () => uploadMutation.mutateAsync({ id: onboardingId, input: { file, kind: 'document', document_type: documentType } })))
      setDocumentStatus((s) => ({ ...s, [documentType]: 'success' }))
    } catch (err) {
      setDocumentStatus((s) => ({ ...s, [documentType]: 'error' }))
      setDocumentErrors((e) => ({ ...e, [documentType]: errorText(err, copy.documents.uploadFailed) }))
    }
  }

  function retryDocumentUpload(documentType: string) {
    const file = documents[documentType]
    if (file) void handleUploadDocument(documentType, file)
  }

  const pendingPhotos = Object.entries(photoUploads.status).filter(([, s]) => s === 'uploading' || s === 'waiting')
  // Answers are kept on this phone as they are typed; only a save or a photo still on its way
  // to Grid Nova would be cut off by leaving, so ask first while one is running.
  useUnsavedGuard(busy || Object.values(photoUploads.status).some((st) => st === 'uploading'), feedback.unsaved)
  const waitingPhotos = pendingPhotos.filter(([, s]) => s === 'waiting').length

  async function handleSubmit() {
    if (!onboardingId || busyRef.current) return
    setSubmitError(null)
    // Submitting while photos are still on the phone would send an incomplete customer.
    if (pendingPhotos.length > 0) return
    busyRef.current = true
    setBusy(true)
    try {
      await submitMutation.mutateAsync(onboardingId)
      clearAutosaveDraft(draftKey)
      void purgePendingPhotoScope(photoUploads.scope)
      // Stay in the reader's language: /hi/associates/portal/…, not the English page (FE-19).
      router.push(localizeHref(`${portalBase}/customers/${onboardingId}`, locale))
    } catch (err) {
      if (err instanceof ApiError && err.structuredDetail?.code === 'incomplete') {
        const d = err.structuredDetail
        setSubmitError({
          message: copy.review.incompleteTitle,
          missing: Array.isArray(d.missing_documents) ? (d.missing_documents as string[]) : [],
          locationMissing: d.missing_site_location === true,
          locationUnconfirmed: d.site_location_unconfirmed === true,
          surveySections: Array.isArray(d.missing_survey_sections) ? (d.missing_survey_sections as string[]) : [],
          surveyUnsigned: Array.isArray(d.survey_unsigned) ? (d.survey_unsigned as string[]) : [],
        })
      } else {
        setSubmitError({ message: errorText(err, copy.submitFailed) })
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  // A 409 not_editable customer (no longer draft/submitted) can't be
  // changed from here — a clear, distinct state, not a generic error.
  if (existing && existing.can_edit === false) {
    return (
      <div className="rounded-2xl border border-[#e4e8ee] bg-white p-8 text-center">
        <p className="font-utility text-sm text-[#111827]/70">{copy.editing.notEditableNotice}</p>
      </div>
    )
  }

  // The slot with the best-accuracy camera photo that the server already has.
  const uploadedSlots = Object.entries(photoUploads.photos)
    .filter(([slot, p]) => !!p && photoUploads.status[slot] === 'success')
    .map(([slot, p]) => ({ slot, ...p! }))
  const handledSlots = new Set(Object.keys(photoUploads.photos))
  const photoCandidate = bestPhotoCandidate([
    ...uploadedSlots,
    ...serverPhotoCandidates(server?.photos ?? []).filter((p) => !handledSlots.has(p.slot)),
  ])
  const photoSlots = photoSlotsOf(options.photo_slots, copy.photos.slotLabels, copy.photos.otherSlot)
  const houseSlot = photoSlots.find((slot) => slot.key === HOUSE_PHOTO_SLOT)
  const houseStepIndex = steps.indexOf('house')
  const photosStepIndex = steps.indexOf('photos')

  const renderPhotoSlot = (slot: PhotoSlotOption) => (
    <PhotoCaptureSlot
      key={slot.key}
      slotKey={slot.key}
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
  )

  // The submit-time `missing_documents` list is a list of document type keys —
  // look each one up against the options so review never shows a raw key.
  const documentLabelByKey = new Map(options.documents.map((d) => [d.key, d.label]))
  // What the server already holds per document type (a resumed or edited draft).
  const serverDocs = new Map((server?.documents ?? []).filter((d) => d.document_type).map((d) => [d.document_type!, d.filename]))

  const common = { yes: copy.yes, no: copy.no, placeholder: copy.selectPlaceholder }
  const fe = fieldErrors
  const signedNow = anySigned(surveyStatus.data) && surveyOptions.resign_after_edit
  const surveyEditStep = stepKey === 'connection' || stepKey === 'bills' || stepKey === 'house' || stepKey === 'layout'
  const sa = server?.site_assessment as Record<string, unknown> | null | undefined
  const derivedShadowFree = serverDraft && serverDraft.survey.roof_sections.length > 0 && typeof sa?.shadow_free_area_sqft === 'number' ? (sa.shadow_free_area_sqft as number) : null
  const sectionsDirty = !!serverDraft && Object.keys(surveyPatch(draft.survey, serverDraft.survey, ['roof_sections'])).length > 0
  const hasDraftContent = !!onboardingId || !!draft.customer_name.trim() || !!draft.customer_mobile.trim()
  const sectionName = (key: string) => (surveyCopy.status.sections as Record<string, string>)[key] ?? key

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>
        {isNew && hasDraftContent && !confirmStartOver && (
          <button
            type="button"
            onClick={() => setConfirmStartOver(true)}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#0e2a63] font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> {copy.startOver}
          </button>
        )}
      </div>

      {confirmStartOver && (
        <div role="alertdialog" aria-labelledby="start-over-text" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p id="start-over-text" className="text-sm text-amber-900">
            {copy.startOverConfirm}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={startOver} className="min-h-[44px] rounded-lg bg-[#0e2a63] px-4 text-sm font-semibold text-white font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]">
              {copy.startOverYes}
            </button>
            <button type="button" onClick={() => setConfirmStartOver(false)} className="min-h-[44px] rounded-lg border border-[#c9d2de] bg-white px-4 text-sm font-semibold text-[#0e2a63] font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]">
              {copy.startOverNo}
            </button>
          </div>
        </div>
      )}

      {restored && <p className="mt-3 rounded-lg bg-[#2f5daa]/10 px-3.5 py-2.5 text-sm text-[#0e2a63] font-utility">{copy.restoredNotice}</p>}

      {existing && existing.status === 'submitted' && (
        <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-sm text-amber-800 font-utility">{copy.editing.returnedToDraftNotice}</p>
      )}

      {resignNotice && (
        <div role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3" data-testid="resign-notice">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-sm text-amber-900">{surveyCopy.signatures.resignNotice}</p>
        </div>
      )}

      <nav aria-label={copy.stepsLabel} className="mt-5">
        <p className="font-utility text-xs text-[#111827]/60">{fmt(copy.stepProgress, { current: stepIndex + 1, total: steps.length })}</p>
        {/* Scrolls inside itself at 375px; the page never scrolls sideways. */}
        <ol ref={stepsRef} className="mt-2 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-testid="wizard-steps">
          {steps.map((s, i) => (
            <li
              key={s}
              aria-current={i === stepIndex ? 'step' : undefined}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-utility ${
                i === stepIndex ? 'bg-[#0e2a63] text-white font-semibold' : i < stepIndex ? 'bg-[#2f5daa]/15 text-[#0e2a63]' : 'bg-[#eef1f5] text-[#111827]/60'
              }`}
            >
              {copy.steps[s]}
            </li>
          ))}
        </ol>
      </nav>

      {warnings.length > 0 && (
        <div className="mt-5 space-y-2">
          {warnings
            .filter((w) => !SITE_LOCATION_WARNING_CODES.includes(w.code))
            .map((w) => (
              <WarningNotice key={w.code} warning={w} copy={copy.warnings} />
            ))}
        </div>
      )}

      <div ref={stepBodyRef} className="mt-5 rounded-2xl border border-[#e4e8ee] bg-white p-4 sm:p-6 space-y-5">
        {/* The house step's own card repeats this title, so there it is for screen readers only. */}
        <h2
          ref={headingRef}
          tabIndex={-1}
          className={`font-display text-lg font-semibold text-[#0e2a63] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] ${stepKey === 'house' ? 'sr-only' : ''}`}
        >
          {copy.steps[stepKey]}
        </h2>

        {surveyEditStep && signedNow && !resignNotice && (
          <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">{surveyCopy.signatures.resignWarning}</p>
        )}

        {stepKey === 'notice' && (
          <div>
            <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.notice.title}</p>
            <p className="mt-3 text-sm text-[#111827]/75 leading-relaxed whitespace-pre-line">{options.notice.text}</p>
            <p className="mt-2 font-utility text-xs text-[#111827]/65" data-testid="notice-version">{fmt(feedback.noticeVersion, { version: options.notice.version })}</p>
            <label className="mt-5 flex min-h-[44px] items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.notice_acknowledged}
                onChange={(e) => update('notice_acknowledged', e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#c9d2de] accent-[#0e2a63]"
              />
              <span className="text-base text-[#111827]/85 font-utility">{copy.notice.confirmLabel}</span>
            </label>
          </div>
        )}

        {stepKey === 'customer' && (
          <div className="space-y-4">
            <FormField label={copy.customer.nameLabel} error={fe.customer_name} required>
              {(p) => <input {...p} name="customer_name" autoComplete="off" maxLength={200} className={inputClass(!!fe.customer_name)} value={draft.customer_name} onChange={(e) => update('customer_name', e.target.value)} />}
            </FormField>
            <FormField label={copy.customer.mobileLabel} error={fe.customer_mobile} required>
              {(p) => (
                <input {...p} name="customer_mobile" type="tel" inputMode="tel" autoComplete="off" maxLength={14} className={inputClass(!!fe.customer_mobile)} value={draft.customer_mobile} onChange={(e) => update('customer_mobile', e.target.value)} />
              )}
            </FormField>
            <FormField label={copy.customer.emailLabel} error={fe.customer_email}>
              {(p) => (
                <input {...p} name="customer_email" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} className={inputClass(!!fe.customer_email)} value={draft.customer_email} onChange={(e) => update('customer_email', e.target.value)} />
              )}
            </FormField>
            <SelectField
              name="customer_type"
              label={copy.customer.customerTypeLabel}
              value={draft.customer_type}
              onChange={(v) => update('customer_type', v)}
              options={CUSTOMER_TYPES.map((c) => [c, copy.customer.customerTypes[c]] as const)}
              placeholder={copy.selectPlaceholder}
              error={fe.customer_type}
              required
            />
            <FormField label={copy.customer.fullAddressLabel} error={fe.full_address} required>
              {(p) => <textarea {...p} name="full_address" rows={2} maxLength={500} className={inputClass(!!fe.full_address)} value={draft.full_address} onChange={(e) => update('full_address', e.target.value)} />}
            </FormField>
            <FormField label={copy.customer.pinCodeLabel} error={fe.pin_code} required>
              {(p) => (
                <input {...p} name="pin_code" type="text" inputMode="numeric" autoComplete="off" maxLength={6} className={inputClass(!!fe.pin_code)} value={draft.pin_code} onChange={(e) => update('pin_code', e.target.value.replace(/\D/g, ''))} />
              )}
            </FormField>
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
                setFieldErrors((e) => ({ ...e, state_lgd_code: '', district_lgd_code: '' }))
                try {
                  window.sessionStorage.setItem(LAST_TERRITORY_KEY, JSON.stringify({ state_lgd_code: n.state, district_lgd_code: n.district }))
                } catch {
                  /* storage unavailable — pre-fill is a convenience only */
                }
              }}
              labels={{ state: copy.connection.stateLabel, district: copy.connection.districtLabel, block: copy.connection.blockLabel }}
              errors={{ state: fe.state_lgd_code, district: fe.district_lgd_code }}
              inputClass={(invalid) => inputClass(invalid)}
              renderField={({ id, label, error, children }) => (
                <div>
                  <label htmlFor={id} className="font-utility text-xs text-[#111827]/60 uppercase tracking-[0.08em] mb-1.5 block">
                    {label}
                  </label>
                  {children}
                  {error && <p className="mt-1.5 text-xs text-red-600 font-utility">{error}</p>}
                </div>
              )}
            />
            <YesNoField
              name="connection_in_customer_name"
              label={copy.connection.connectionInCustomerNameLabel}
              value={draft.connection_in_customer_name}
              onChange={(v) => update('connection_in_customer_name', v)}
              {...common}
              error={fe.connection_in_customer_name}
              required
            />
            <SelectField
              name="site_type"
              label={copy.connection.siteTypeLabel}
              value={draft.site_type}
              onChange={(v) => update('site_type', v)}
              options={SITE_TYPES.map((s) => [s, copy.connection.siteTypes[s]] as const)}
              placeholder={copy.selectPlaceholder}
              error={fe.site_type}
              required
            />
            <SelectField
              name="connection_type"
              label={copy.connection.connectionTypeLabel}
              value={draft.connection_type}
              onChange={(v) => update('connection_type', v)}
              options={CONNECTION_TYPES.map((s) => [s, copy.connection.connectionTypes[s]] as const)}
              placeholder={copy.selectPlaceholder}
              error={fe.connection_type}
              required
            />
            <div className="border-t border-[#e4e8ee] pt-5">
              <ConnectionSurveyFields form={draft.survey} onChange={updateSurvey} options={surveyOptions} errors={fe} common={common} />
            </div>
          </div>
        )}

        {stepKey === 'bills' && <BillsStep form={draft.survey} onChange={updateSurvey} options={surveyOptions} errors={fe} results={surveyResults.data} />}

        {stepKey === 'property' && (
          <div className="space-y-4">
            <YesNoField
              name="property_in_customer_name"
              label={copy.property.propertyInCustomerNameLabel}
              value={draft.property_in_customer_name}
              onChange={(v) => update('property_in_customer_name', v)}
              {...common}
              error={fe.property_in_customer_name}
              required
            />
            <SelectField
              name="customer_timeline"
              label={copy.property.customerTimelineLabel}
              value={draft.customer_timeline}
              onChange={(v) => update('customer_timeline', v)}
              // Enum values from the server, labelled — never shown raw.
              options={options.customer_timelines.map((t) => [t, (copy.property.customerTimelines as Record<string, string>)[t] ?? t] as const)}
              placeholder={copy.selectPlaceholder}
            />
          </div>
        )}

        {stepKey === 'requirement' && (
          <div className="space-y-6">
            <fieldset>
              <legend className="font-display text-base font-semibold text-[#0e2a63]">{copy.requirement.title}</legend>
              <p className="mt-1 text-sm text-[#111827]/60 leading-relaxed">{copy.requirement.subtitle}</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {options.equipment_packages.map((pkg) => {
                  const selected = draft.equipment_package === pkg.key
                  const detail = catalogue?.packages.find((c) => c.equipment_tier === pkg.equipment_tier)
                  return (
                    <button
                      key={pkg.key}
                      type="button"
                      aria-pressed={selected}
                      data-invalid={fe.equipment_package ? 'true' : undefined}
                      onClick={() => update('equipment_package', pkg.key)}
                      className={`rounded-xl border-2 p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] ${
                        selected ? 'border-[#0e2a63] bg-[#0e2a63]/5' : fe.equipment_package ? 'border-red-300' : 'border-[#e4e8ee] hover:border-[#2f5daa]/40'
                      }`}
                    >
                      <span className="block font-display text-base font-semibold text-[#0e2a63]">{pkg.label}</span>
                      {detail && (
                        <span className="mt-3 block" data-testid="package-equipment" data-package={detail.package}>
                          <PackageEquipment pkg={detail} />
                        </span>
                      )}
                      {selected && <CheckCircle2 className="mt-2 h-4 w-4 text-[#0e2a63]" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
              {fe.equipment_package && <p className="mt-2 text-xs text-red-600 font-utility">{fe.equipment_package}</p>}
            </fieldset>
            <FormField label={copy.requirement.desiredKwLabel} hint={copy.requirement.desiredKwHint} error={fe.desired_output_kw} required={isNew}>
              {(p) => (
                <input {...p} name="desired_output_kw" type="text" inputMode="decimal" autoComplete="off" maxLength={10} className={inputClass(!!fe.desired_output_kw)} value={draft.desired_output_kw ?? ''} onChange={(e) => update('desired_output_kw', e.target.value.replace(/[^\d.]/g, ''))} />
              )}
            </FormField>
            {catalogue && <OrEquivalentNote />}
            <div className="rounded-lg bg-[#f7f9fc] p-4">
              <p className="font-utility text-sm font-semibold text-[#0e2a63]">{copy.requirement.dcrTitle}</p>
              <p className="mt-1.5 text-sm text-[#111827]/65 leading-relaxed">{copy.requirement.dcrExplainer}</p>
            </div>
          </div>
        )}

        {stepKey === 'house' && onboardingId && (
          <div className="space-y-6">
            <SiteLocationStep
              onboardingId={onboardingId}
              location={siteLocation}
              options={options.site_location}
              photoCandidate={photoCandidate}
              onAdopt={adopt}
              photoSlot={houseSlot ? renderPhotoSlot(houseSlot) : undefined}
              onTakePhoto={houseSlot ? undefined : () => setStepIndex(photosStepIndex)}
            />
            <div className="border-t border-[#e4e8ee] pt-5">
              {siteLocation?.confirmed ? (
                <RoofSurveyFields
                  form={draft.survey}
                  onChange={updateSurvey}
                  options={surveyOptions}
                  errors={fe}
                  common={common}
                  derivedShadowFree={derivedShadowFree}
                  sectionsDirty={sectionsDirty}
                />
              ) : (
                <p className="text-sm text-[#111827]/65" data-testid="roof-locked">
                  {surveyCopy.roof.lockedUntilLocation}
                </p>
              )}
            </div>
          </div>
        )}

        {stepKey === 'layout' && <LayoutStep form={draft.survey} onChange={updateSurvey} options={surveyOptions} errors={fe} common={common} />}

        {stepKey === 'documents' && (
          <div className="space-y-5">
            <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.documents.title}</p>
            {options.documents.map((doc) => (
              <FileUploadSlot
                key={doc.key}
                label={doc.label}
                // `required_when` is a rule code (always, scheme_linked…) with no wording in the contract:
                // never shown to the associate (FE-19); the server's incomplete answer names what is missing.
                why=""
                accept="image/*,application/pdf"
                acceptedTypesLabel={copy.documents.acceptedTypes}
                file={documents[doc.key] ?? null}
                onChange={(f) => void handleUploadDocument(doc.key, f)}
                chooseLabel={copy.documents.uploadButton}
                replaceLabel={copy.documents.replaceButton}
                whyLabel={copy.documents.missingLabel}
                uploading={documentStatus[doc.key] === 'uploading'}
                error={documentStatus[doc.key] === 'error' ? documentErrors[doc.key] : undefined}
                onRetry={documentStatus[doc.key] === 'error' ? () => retryDocumentUpload(doc.key) : undefined}
                retryLabel={copy.documents.retryButton}
                uploadedName={serverDocs.get(doc.key) ?? null}
                uploadedLabel={copy.documents.alreadyUploaded}
              />
            ))}
          </div>
        )}

        {stepKey === 'photos' && (
          <div className="space-y-5">
            <PhotosFirstCard />
            {onboardingId && (
              <PhotoLocationPrompt onboardingId={onboardingId} location={siteLocation} candidate={photoCandidate} onAdopt={adopt} onBackToHouse={() => setStepIndex(houseStepIndex)} />
            )}
            <div>
              <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.photos.title}</p>
              <p className="mt-1 text-sm text-[#111827]/60 leading-relaxed">{copy.photos.geotagNote}</p>
            </div>
            {photoSlots.filter((slot) => slot.key !== houseSlot?.key).map((slot) => renderPhotoSlot(slot))}
          </div>
        )}

        {stepKey === 'survey' && (
          <SurveyStep onboardingId={onboardingId} options={surveyOptions} onGoToStep={(s: SurveyStepKey) => goToStep(s)} online={online} />
        )}

        {stepKey === 'review' && (
          <div className="space-y-4">
            {pendingPhotos.length > 0 && (
              <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900" data-testid="photos-pending">
                {fmt(waitingPhotos > 0 ? copy.review.photosOffline : copy.review.photosPending, { count: pendingPhotos.length })}
              </p>
            )}
            {submitError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{submitError.message}</p>
                {(submitError.locationMissing || submitError.locationUnconfirmed) && (
                  <div className="mt-2" data-testid="incomplete-location">
                    <p className="text-sm font-semibold text-red-800">{submitError.locationMissing ? siteCopy.review.missing : siteCopy.review.unconfirmed}</p>
                    <button
                      type="button"
                      onClick={() => goToStep('house')}
                      className="mt-1 min-h-[44px] rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]"
                    >
                      {siteCopy.review.goToStep}
                    </button>
                  </div>
                )}
                {submitError.missing && submitError.missing.length > 0 && (
                  <>
                    <p className="mt-2 text-sm font-semibold text-red-800">{copy.review.missingDocumentsLabel}</p>
                    <ul className="mt-1 list-disc pl-5 text-sm text-red-700">
                      {submitError.missing.map((m) => (
                        <li key={m}>{documentLabelByKey.get(m) ?? m}</li>
                      ))}
                    </ul>
                  </>
                )}
                {submitError.surveySections && submitError.surveySections.length > 0 && (
                  <div className="mt-2" data-testid="incomplete-survey">
                    <p className="text-sm font-semibold text-red-800">{surveyCopy.review.surveyMissing}</p>
                    <ul className="mt-1 space-y-1">
                      {submitError.surveySections.map((sec) => {
                        const target = stepOfSection(sec)
                        return (
                          <li key={sec}>
                            {target ? (
                              <button
                                type="button"
                                onClick={() => goToStep(target)}
                                className="min-h-[44px] text-left text-sm font-semibold text-red-800 underline font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]"
                              >
                                {fmt(surveyCopy.status.goTo, { section: sectionName(sec) })}
                              </button>
                            ) : (
                              <span className="text-sm text-red-700">{sectionName(sec)}</span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
                {submitError.surveyUnsigned && submitError.surveyUnsigned.length > 0 && (
                  <div className="mt-2" data-testid="incomplete-signatures">
                    <p className="text-sm font-semibold text-red-800">
                      {surveyCopy.review.surveyUnsigned}{' '}
                      {submitError.surveyUnsigned.map((p) => (surveyCopy.review.parties as Record<string, string>)[p] ?? p).join(', ')}
                    </p>
                    <button
                      type="button"
                      onClick={() => goToStep('survey')}
                      className="mt-1 min-h-[44px] rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]"
                    >
                      {surveyCopy.review.goToSignatures}
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={busy || submitMutation.isPending || pendingPhotos.length > 0}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#0e2a63] px-5 text-base font-semibold text-white font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] disabled:opacity-50"
            >
              {busy || submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {copy.saving}
                </>
              ) : (
                copy.review.submitButton
              )}
            </button>
          </div>
        )}

        {stepError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700" data-testid="step-error">
            {stepError}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          disabled={stepIndex === 0 || busy}
          className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-4 text-sm font-utility text-[#111827]/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] disabled:invisible"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {copy.backButton}
        </button>
        {stepKey !== 'review' && (
          <button
            type="button"
            onClick={() => void handleContinue()}
            disabled={busy || (stepKey === 'notice' && !draft.notice_acknowledged) || (stepKey === 'house' && !siteLocation?.confirmed)}
            aria-busy={busy || undefined}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#0e2a63] px-5 text-sm font-semibold text-white font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {copy.saving}
              </>
            ) : (
              <>
                {copy.continueButton} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {busy ? copy.saving : ''}
      </p>
    </div>
  )
}
