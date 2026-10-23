'use client'

import { useState, type ReactNode } from 'react'
import { AlertCircle, Check, Clock, Loader2, ShieldAlert } from 'lucide-react'
import FileUploadSlot from '@/components/associate/FileUploadSlot'
import PhotoCaptureSlot from '@/components/associate/PhotoCaptureSlot'
import { describeMissing, labelFor } from '@/lib/associate/execution-labels'
import { usePhotoUploads } from '@/lib/associate/usePhotoUploads'
import { clearAutosaveDraft, useAutosaveDraft } from '@/lib/associate/useAutosaveDraft'
import { ApiError } from '@/lib/dashboard/api-error'
import type { ExecutionStageStatus, ExecutionStatus } from '@/lib/associate/execution-types'
import type { UploadFileInput } from '@/lib/associate/onboarding-types'
import type { Messages } from '@/lib/i18n/types'

export type ExecutionCopy = Messages['associates']['portal']['execution']
export type PhotosCopy = Messages['associates']['portal']['wizard']['photos']

const ACCEPT_DOCS = 'image/jpeg,image/png,image/webp,application/pdf'
const MAX_MB = 10
export const evidenceInputClass =
  'w-full min-h-[44px] rounded-xl border border-[#e4e8ee] bg-white px-4 py-3 text-[#111827] text-sm font-utility outline-none focus-visible:border-[#2f5daa] focus-visible:ring-2 focus-visible:ring-[#2f5daa]/25'

export function executionErrorMessage(err: unknown, copy: ExecutionCopy): string {
  if (err instanceof ApiError) {
    const code = err.structuredDetail?.code
    if (typeof code === 'string' && code in copy.errors) return copy.errors[code as keyof ExecutionCopy['errors']]
  }
  return copy.errors.generic
}

export function Panel({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'warn' | 'alert' | 'ok' }) {
  const toneClass = {
    plain: 'border-[#e4e8ee] bg-white',
    warn: 'border-amber-200 bg-amber-50',
    alert: 'border-red-200 bg-red-50',
    ok: 'border-emerald-200 bg-emerald-50',
  }[tone]
  return <div className={`rounded-2xl border p-5 ${toneClass}`}>{children}</div>
}

/**
 * The evidence form for one execution stage, rendered from the response's
 * `evidence_required` (never a fixed list): text references, documents, photos
 * (two-way slot), and the serial-register requirement. Used by the associate
 * checklist (submit for verification) and by staff recording a stage directly.
 * Submit stays disabled until the response's own requirements are met; the
 * server remains the authority and its `evidence_missing` list is mapped to
 * friendly lines.
 */
export default function ExecutionEvidenceForm({
  scope,
  status,
  stage,
  copy,
  photosCopy,
  uploadFile,
  onSubmit,
  submitLabel,
  submittingLabel,
  doneMessage,
  mapError,
  showBlockers = true,
  extra,
  extraReady = true,
  renderErrorExtra,
}: {
  scope: string
  status: ExecutionStatus
  stage: ExecutionStageStatus
  copy: ExecutionCopy
  photosCopy: PhotosCopy
  uploadFile: (input: UploadFileInput) => Promise<unknown>
  onSubmit: (payload: { text: Record<string, string>; note?: string }) => Promise<unknown>
  submitLabel?: string
  submittingLabel?: string
  doneMessage?: string
  mapError?: (err: unknown) => string
  showBlockers?: boolean
  extra?: ReactNode
  extraReady?: boolean
  // Lets the caller add an action under a specific failure (e.g. switch mode when evidence is missing).
  renderErrorExtra?: (err: unknown) => ReactNode
}) {
  const ev = stage.evidence_required
  const rejected = stage.submission?.status === 'rejected' ? stage.submission : null
  const toMessage = mapError ?? ((err: unknown) => executionErrorMessage(err, copy))
  // Typed references and the note survive a refresh or a back-press (this device only).
  const draftKey = `gna-exec-${scope}-${stage.stage}`
  const [draft, setDraft] = useAutosaveDraft<Record<string, string>>(draftKey, {
    note: '',
    ...Object.fromEntries(Object.entries(rejected?.evidence.text ?? {}).map(([k, v]) => [`t:${k}`, v])),
  })
  const text = Object.fromEntries(ev.text.map((k) => [k, draft[`t:${k}`] ?? '']))
  const note = draft.note ?? ''
  const setText = (updater: (t: Record<string, string>) => Record<string, string>) =>
    setDraft((d) => ({ ...d, ...Object.fromEntries(Object.entries(updater(text)).map(([k, v]) => [`t:${k}`, v])) }))
  const setNote = (value: string) => setDraft((d) => ({ ...d, note: value }))
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({})
  const [docStatus, setDocStatus] = useState<Record<string, 'uploading' | 'error' | undefined>>({})
  const [docErrors, setDocErrors] = useState<Record<string, string | undefined>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitErrorRaw, setSubmitErrorRaw] = useState<unknown>(null)
  const [missing, setMissing] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const photoUploads = usePhotoUploads({
    scope,
    upload: (slot, photo, onProgress) => {
      const camera = photo.capture_method === 'camera'
      return uploadFile({
        file: photo.file,
        kind: 'photo',
        photo_slot: slot,
        capture_method: photo.capture_method,
        ...(camera
          ? { latitude: photo.latitude, longitude: photo.longitude, captured_at: photo.captured_at, accuracy_m: photo.accuracy_m }
          : { exif_taken_at_client: photo.exif_taken_at_client }),
        onProgress,
      })
    },
    describeError: toMessage,
  })

  async function uploadDocument(type: string, file: File | null) {
    setDocFiles((d) => ({ ...d, [type]: file }))
    setDocErrors((e) => ({ ...e, [type]: undefined }))
    if (!file) {
      setDocStatus((s) => ({ ...s, [type]: undefined }))
      return
    }
    setDocStatus((s) => ({ ...s, [type]: 'uploading' }))
    try {
      await uploadFile({ file, kind: 'document', document_type: type })
      setDocStatus((s) => ({ ...s, [type]: undefined }))
    } catch (err) {
      setDocStatus((s) => ({ ...s, [type]: 'error' }))
      setDocErrors((e) => ({ ...e, [type]: toMessage(err) }))
    }
  }

  const haveText = ev.text.every((k) => (text[k] ?? '').trim() !== '')
  const haveDocs = ev.documents.every((k) => !!status.files.documents[k])
  const havePhotos = ev.photos.every((k) => !!status.files.photos[k])
  const haveRegister = !ev.register_verified || !!status.register_verified_at
  const anyUploading = Object.values(docStatus).includes('uploading') || Object.values(photoUploads.status).some((s) => s === 'uploading' || s === 'waiting')
  const ready = haveText && haveDocs && havePhotos && haveRegister && !anyUploading && extraReady

  async function handleSubmit() {
    setSubmitError(null)
    setSubmitErrorRaw(null)
    setMissing([])
    setSubmitting(true)
    try {
      await onSubmit({
        text: Object.fromEntries(ev.text.map((k) => [k, (text[k] ?? '').trim()])),
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      clearAutosaveDraft(draftKey)
      setSubmitted(true)
    } catch (err) {
      setSubmitError(toMessage(err))
      setSubmitErrorRaw(err)
      const list = err instanceof ApiError ? err.structuredDetail?.missing : undefined
      if (Array.isArray(list)) setMissing(list.filter((m): m is string => typeof m === 'string'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Panel tone="ok">
        <p role="status" className="font-utility text-sm text-emerald-800">{doneMessage ?? copy.submitted}</p>
      </Panel>
    )
  }

  const stageName = copy.stages[stage.stage as keyof ExecutionCopy['stages']] ?? stage.label

  return (
    <div className="space-y-5">
      <div>
        <p className="font-utility text-xs uppercase tracking-wide text-[#111827]/65">{copy.currentStep}</p>
        <h2 className="font-display text-xl font-semibold text-[#0e2a63]">{stageName}</h2>
      </div>

      {rejected && (
        <Panel tone="alert">
          <p className="flex items-center gap-2 font-utility text-sm font-semibold text-red-800">
            <AlertCircle className="h-4 w-4" /> {copy.rejectedTitle}
          </p>
          {rejected.review_note && (
            <p className="mt-2 text-sm text-red-900" data-testid="review-note">
              <span className="font-semibold">{copy.rejectedNote}: </span>
              {rejected.review_note}
            </p>
          )}
          <p className="mt-2 text-xs text-red-800/80">{copy.resubmitHint}</p>
        </Panel>
      )}

      {showBlockers &&
        stage.blockers.map((b) => (
          <Panel key={b.code} tone="warn">
            <p className="flex items-start gap-2 font-utility text-sm text-amber-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {copy.blockers[b.code as keyof ExecutionCopy['blockers']] ?? b.message}
            </p>
          </Panel>
        ))}

      {ev.text.length > 0 && (
        <Panel>
          <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.sectionText}</p>
          <div className="mt-3 space-y-4">
            {ev.text.map((k) => (
              <div key={k}>
                <label htmlFor={`exec-text-${k}`} className="mb-1.5 block font-utility text-xs uppercase tracking-[0.1em] text-[#111827]/65">
                  {labelFor(copy.text, k)} <span className="normal-case">({copy.required})</span>
                </label>
                <input id={`exec-text-${k}`} className={evidenceInputClass} value={text[k] ?? ''} onChange={(e) => setText((t) => ({ ...t, [k]: e.target.value }))} />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {(ev.documents.length > 0 || ev.optional_documents.length > 0) && (
        <Panel>
          <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.sectionDocuments}</p>
          <div className="mt-3 space-y-5">
            {[...ev.documents.map((k) => [k, true] as const), ...ev.optional_documents.map((k) => [k, false] as const)].map(([k, req]) => {
              const onFile = status.files.documents[k]
              return (
                <div key={k}>
                  <p className="font-utility text-xs text-[#111827]/65">
                    {req ? copy.required : copy.optional} · {onFile ? `${copy.onFile}: ${onFile.filename}` : copy.notYet}
                  </p>
                  <FileUploadSlot
                    label={labelFor(copy.documents, k)}
                    why={copy.documentWhy}
                    whyLabel={copy.whyLabel}
                    accept={ACCEPT_DOCS}
                    acceptedTypesLabel={copy.acceptedTypes}
                    file={docFiles[k] ?? null}
                    onChange={(f) => void uploadDocument(k, f)}
                    chooseLabel={copy.chooseFile}
                    replaceLabel={copy.replaceFile}
                    error={docErrors[k]}
                    uploading={docStatus[k] === 'uploading'}
                    onRetry={docFiles[k] ? () => void uploadDocument(k, docFiles[k]) : undefined}
                    retryLabel={copy.retry}
                    maxSizeMb={MAX_MB}
                  />
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {ev.photos.length > 0 && (
        <Panel>
          <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.sectionPhotos}</p>
          <div className="mt-3 space-y-5">
            {ev.photos.map((k) => {
              const onFile = status.files.photos[k]
              return (
                <div key={k}>
                  <p className="font-utility text-xs text-[#111827]/65">
                    {copy.required} · {onFile ? `${copy.onFile}: ${onFile.filename}` : copy.notYet}
                  </p>
                  <PhotoCaptureSlot
                    slotKey={k}
                    label={labelFor(copy.photoSlots, k)}
                    captureLabel={photosCopy.captureButton}
                    locationRequiredLabel={photosCopy.locationRequired}
                    retryLabel={photosCopy.retryButton}
                    value={photoUploads.photos[k] ?? null}
                    onChange={(p) => void photoUploads.capture(k, p)}
                    status={photoUploads.status[k]}
                    progress={photoUploads.progress[k]}
                    uploadError={photoUploads.errors[k]}
                    onRetryUpload={photoUploads.status[k] === 'error' ? () => photoUploads.retry(k) : undefined}
                  />
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {ev.register_verified && (
        <Panel tone={status.register_verified_at ? 'ok' : 'plain'}>
          <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.sectionRegister}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-[#111827]/70">
            {status.register_verified_at ? <Check className="h-4 w-4 text-emerald-600" /> : <Clock className="h-4 w-4 text-amber-600" />}
            {status.register_verified_at ? copy.registerVerified : `${copy.registerNeeded} ${copy.registerNotVerified}`}
          </p>
        </Panel>
      )}

      <div>
        <label htmlFor="exec-note" className="mb-1.5 block font-utility text-xs uppercase tracking-[0.1em] text-[#111827]/65">
          {copy.noteLabel}
        </label>
        <textarea id="exec-note" rows={2} className={evidenceInputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {extra}

      {submitError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{submitError}</p>
          {missing.length > 0 && (
            <ul className="mt-2 list-disc pl-5" data-testid="missing-list">
              {missing.map((m) => (
                <li key={m}>{describeMissing(m, copy)}</li>
              ))}
            </ul>
          )}
          {renderErrorExtra?.(submitErrorRaw)}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 bg-white/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <button
          type="button"
          disabled={!ready || submitting}
          onClick={() => void handleSubmit()}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#0e2a63] px-5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? (submittingLabel ?? copy.submitting) : (submitLabel ?? copy.submit)}
        </button>
      </div>
    </div>
  )
}
