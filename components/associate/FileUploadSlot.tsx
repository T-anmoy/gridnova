'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { UploadCloud, X, FileText, AlertCircle, Image as ImageIcon, Loader2, CheckCircle2 } from 'lucide-react'
import { useOptionalMessages } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/types'
import { isHeic, prepareImage, PhotoPrepError } from '@/lib/associate/image-prep'

const DEFAULT_MAX_SIZE_MB = 5

// English fallback for the staff tools that render this outside a portal
// provider; the portals and the staff dashboard both provide `photoSlot`.
const FALLBACK = {
  fileTooLarge: '"{name}" is larger than the {max} MB limit.',
  removeFile: 'Remove {name}',
  chooseFileFor: '{action}: {label}',
  preparing: 'Preparing photo…',
  heicFailed: "We couldn't convert this photo. Please choose a JPEG or PNG photo, or take a new one.",
}

const isPreparableImage = (f: File) => isHeic(f) || ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)

export default function FileUploadSlot({
  label,
  why,
  sample,
  accept,
  acceptedTypesLabel,
  file,
  onChange,
  chooseLabel,
  replaceLabel,
  whyLabel,
  sampleLabel,
  error,
  uploading,
  onRetry,
  retryLabel,
  maxSizeMb = DEFAULT_MAX_SIZE_MB,
  uploadedName,
  uploadedLabel,
}: {
  label: string
  why: string
  sample?: string
  accept: string
  acceptedTypesLabel: string
  file: File | null
  onChange: (file: File | null) => void
  chooseLabel: string
  replaceLabel: string
  whyLabel: string
  sampleLabel?: string
  error?: string
  // Only relevant once `file` is set — distinguishes "picked, upload in
  // flight" from "picked, confirmed uploaded" so a slot is never shown as
  // attached before the server actually has it.
  uploading?: boolean
  onRetry?: () => void
  retryLabel?: string
  maxSizeMb?: number
  /** A file the server already holds for this slot (a resumed or edited draft). */
  uploadedName?: string | null
  /** "Already uploaded: {name}" */
  uploadedLabel?: string
}) {
  const m = { ...FALLBACK, ...useOptionalMessages('photoSlot') }
  const inputRef = useRef<HTMLInputElement>(null)
  const labelId = useId()
  const errorId = useId()
  const [localError, setLocalError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const isImage = file?.type.startsWith('image/')
  const previewUrl = useMemo(() => (file && isImage ? URL.createObjectURL(file) : null), [file, isImage])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL?.(previewUrl)
    }
  }, [previewUrl])

  async function handleFiles(list: FileList | null) {
    let picked = list?.[0]
    if (!picked) return
    setLocalError(null)
    // A normal phone camera shot is several MB: shrink it (and convert HEIC)
    // before judging its size, so ordinary photos of documents pass.
    if (isPreparableImage(picked)) {
      setPreparing(true)
      try {
        picked = (await prepareImage(picked)).file
      } catch (err) {
        if (err instanceof PhotoPrepError && err.code === 'heic_conversion_failed') {
          setLocalError(m.heicFailed)
          return
        }
        /* fall through: judge the original against the limit */
      } finally {
        setPreparing(false)
      }
    }
    if (picked.size > maxSizeMb * 1024 * 1024) {
      setLocalError(fmt(m.fileTooLarge, { name: picked.name, max: maxSizeMb }))
      return
    }
    onChange(picked)
  }

  const shownError = localError ?? error
  return (
    <div>
      <p id={labelId} className="font-utility text-sm font-semibold text-[#0e2a63]">
        {label}
      </p>
      {why && (
        <p className="mt-1 text-xs text-[#111827]/60 leading-relaxed">
          <span className="font-semibold text-[#111827]/70">{whyLabel}:</span> {why}
        </p>
      )}
      {sample && (
        <p className="mt-1 text-xs text-[#111827]/65 leading-relaxed">
          {sampleLabel && <span className="font-semibold">{sampleLabel}: </span>}
          {sample}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <div className="mt-2.5 flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={preparing || uploading}
          aria-label={fmt(m.chooseFileFor, { action: file || uploadedName ? replaceLabel : chooseLabel, label })}
          aria-describedby={shownError ? errorId : undefined}
          className="min-h-[56px] min-w-0 flex-1 rounded-xl border-2 border-dashed border-[#c9d2de] px-4 py-4 text-center transition-colors hover:border-[#2f5daa]/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] disabled:opacity-70"
        >
          {file ? (
            <span className="flex items-center justify-center gap-3">
              {uploading || preparing ? (
                <span className="h-12 w-12 rounded-lg bg-[#f7f9fc] flex items-center justify-center shrink-0">
                  <Loader2 className="h-5 w-5 text-[#2f5daa] animate-spin motion-reduce:animate-none" aria-hidden="true" />
                </span>
              ) : isImage && previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
              ) : (
                <span className="h-12 w-12 rounded-lg bg-[#f7f9fc] flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-[#2f5daa]" aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0 text-left">
                <span className="block font-utility text-sm text-[#091c3c] truncate">{file.name}</span>
                {!uploading && !error && <span className="block font-utility text-xs text-[#0e2a63]">{replaceLabel}</span>}
              </span>
            </span>
          ) : uploadedName ? (
            <span className="flex items-center justify-center gap-2" data-testid="file-already-uploaded">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0e2a63]" aria-hidden="true" />
              <span className="min-w-0 text-left">
                <span className="block font-utility text-sm text-[#091c3c] break-all">{uploadedLabel ? fmt(uploadedLabel, { name: uploadedName }) : uploadedName}</span>
                <span className="block font-utility text-xs text-[#0e2a63]">{replaceLabel}</span>
              </span>
            </span>
          ) : preparing ? (
            <span className="flex items-center justify-center gap-2 font-utility text-sm text-[#111827]/60">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {m.preparing}
            </span>
          ) : (
            <>
              {accept.includes('image') && !accept.includes('pdf') ? (
                <ImageIcon className="h-6 w-6 mx-auto mb-2 text-[#2f5daa]/60" aria-hidden="true" />
              ) : (
                <UploadCloud className="h-6 w-6 mx-auto mb-2 text-[#2f5daa]/60" aria-hidden="true" />
              )}
              <span className="block text-sm font-utility text-[#0e2a63] font-semibold">{chooseLabel}</span>
              <span className="mt-1 block text-xs font-utility text-[#111827]/65">{acceptedTypesLabel}</span>
            </>
          )}
        </button>
        {file && !uploading && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={fmt(m.removeFile, { name: file.name })}
            className="inline-flex w-11 shrink-0 items-center justify-center rounded-xl text-[#111827]/65 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {shownError && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2" id={errorId}>
          <p role="alert" className="flex items-center gap-1.5 text-xs text-red-600 font-utility">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {shownError}
          </p>
          {!localError && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-[44px] text-xs font-semibold text-[#0e2a63] underline font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]"
            >
              {retryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
