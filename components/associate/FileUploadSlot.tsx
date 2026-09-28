'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { UploadCloud, X, FileText, AlertCircle, Image as ImageIcon, Loader2 } from 'lucide-react'

const MAX_SIZE_MB = 5

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
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const isImage = file?.type.startsWith('image/')
  const previewUrl = useMemo(() => (file && isImage ? URL.createObjectURL(file) : null), [file, isImage])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFiles(list: FileList | null) {
    const picked = list?.[0]
    if (!picked) return
    if (picked.size > MAX_SIZE_MB * 1024 * 1024) {
      setLocalError(`"${picked.name}" exceeds the ${MAX_SIZE_MB}MB limit`)
      return
    }
    setLocalError(null)
    onChange(picked)
  }

  return (
    <div>
      <p className="font-utility text-sm font-semibold text-[#0e2a63]">{label}</p>
      <p className="mt-1 text-xs text-[#111827]/55 leading-relaxed">
        <span className="font-semibold text-[#111827]/70">{whyLabel}:</span> {why}
      </p>
      {sample && (
        <p className="mt-1 text-xs text-[#111827]/45 leading-relaxed">
          {sampleLabel && <span className="font-semibold">{sampleLabel}: </span>}
          {sample}
        </p>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        className="mt-2.5 rounded-xl border-2 border-dashed border-[#e4e8ee] hover:border-[#2f5daa]/40 px-5 py-5 text-center cursor-pointer transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            {uploading ? (
              <div className="h-12 w-12 rounded-lg bg-[#f7f9fc] flex items-center justify-center shrink-0">
                <Loader2 className="h-5 w-5 text-[#2f5daa] animate-spin" />
              </div>
            ) : isImage && previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={file.name} className="h-12 w-12 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-[#f7f9fc] flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-[#2f5daa]" />
              </div>
            )}
            <div className="text-left">
              <p className="font-utility text-sm text-[#091c3c] truncate max-w-[200px]">{file.name}</p>
              {!uploading && !error && <p className="font-utility text-xs text-[#0e2a63]">{replaceLabel}</p>}
            </div>
            {!uploading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(null)
                }}
                aria-label={`Remove ${file.name}`}
                className="text-[#111827]/30 hover:text-red-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            {accept.includes('image') && !accept.includes('pdf') ? (
              <ImageIcon className="h-6 w-6 mx-auto mb-2 text-[#2f5daa]/60" />
            ) : (
              <UploadCloud className="h-6 w-6 mx-auto mb-2 text-[#2f5daa]/60" />
            )}
            <p className="text-sm font-utility text-[#0e2a63] font-semibold">{chooseLabel}</p>
            <p className="mt-1 text-[11px] font-utility text-[#111827]/40">{acceptedTypesLabel}</p>
          </>
        )}
      </div>

      {localError && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-500 font-utility">
          <AlertCircle className="h-3 w-3 shrink-0" /> {localError}
        </p>
      )}
      {error && !localError && (
        <div className="mt-2 flex items-center gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-red-500 font-utility">
            <AlertCircle className="h-3 w-3 shrink-0" /> {error}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRetry()
              }}
              className="text-[11px] font-semibold text-[#0e2a63] underline font-utility"
            >
              {retryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
