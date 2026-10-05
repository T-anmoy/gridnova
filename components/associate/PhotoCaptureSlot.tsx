'use client'

import { useRef, useState } from 'react'
import { Camera, AlertCircle, MapPin, Loader2, Image as ImageIcon, CloudOff } from 'lucide-react'
import { useMessages } from '@/lib/i18n/client'
import { prepareImage, PhotoPrepError, type PhotoPrepErrorCode } from '@/lib/associate/image-prep'
import type { CapturedPhoto, PhotoUploadStatus } from '@/lib/associate/photo-types'

export type { CapturedPhoto } from '@/lib/associate/photo-types'

const PREP_ERROR_KEY: Record<PhotoPrepErrorCode, 'notAnImage' | 'heicFailed' | 'tooLarge'> = {
  not_an_image: 'notAnImage',
  heic_conversion_failed: 'heicFailed',
  too_large: 'tooLarge',
}

const BUTTON =
  'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#e4e8ee] px-3 py-3 text-center font-utility text-sm font-semibold text-[#0e2a63] transition-colors hover:border-[#2f5daa]/40'

// Every photo slot offers two ways in: "Take photo" (the device camera; the
// location is read at that moment and is required) and "Choose from phone"
// (the gallery; location optional and never treated as verified). A denied or
// slow location read is a distinct failure from the camera itself — it keeps
// the photo, gets its own message and Retry, and offers the gallery path for
// that same photo so the associate's work is never lost.
export default function PhotoCaptureSlot({
  label,
  exampleUrl,
  exampleLabel,
  captureLabel,
  locationRequiredLabel,
  retryLabel,
  value,
  onChange,
  uploading,
  uploadError,
  onRetryUpload,
  status,
  progress,
}: {
  label: string
  exampleUrl?: string | null
  exampleLabel?: string
  captureLabel: string
  locationRequiredLabel: string
  retryLabel: string
  value: CapturedPhoto | null
  onChange: (photo: CapturedPhoto | null) => void
  // Upload-to-server state, once a photo has already been added — distinct
  // from the capture-time location error above. `status` supersedes `uploading`.
  uploading?: boolean
  uploadError?: string
  onRetryUpload?: () => void
  status?: PhotoUploadStatus
  progress?: number | null
}) {
  const m = useMessages('photoSlot')
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [locationError, setLocationError] = useState(false)
  const [prepError, setPrepError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [pending, setPending] = useState<{ file: File; exif?: string } | null>(null)
  const previewUrl = value ? URL.createObjectURL(value.file) : null
  const isUploading = status ? status === 'uploading' : !!uploading

  function addGallery(file: File, exif?: string) {
    setPending(null)
    setLocationError(false)
    onChange({ file, capture_method: 'gallery', captured_at: new Date().toISOString(), exif_taken_at_client: exif })
  }

  function readLocation(file: File) {
    if (!navigator.geolocation) {
      setPending({ file })
      setLocationError(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationError(false)
        setPending(null)
        onChange({
          file,
          capture_method: 'camera',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          captured_at: new Date().toISOString(),
          ...(pos.coords.accuracy > 0 ? { accuracy_m: pos.coords.accuracy } : {}),
        })
      },
      () => {
        setPending({ file })
        setLocationError(true)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  async function handlePicked(raw: File | undefined, method: 'camera' | 'gallery') {
    if (!raw) return
    setPrepError(null)
    setLocationError(false)
    setPreparing(true)
    try {
      const prepared = await prepareImage(raw)
      if (method === 'gallery') addGallery(prepared.file, prepared.exifTakenAt ?? undefined)
      else readLocation(prepared.file)
    } catch (err) {
      setPrepError(m[PREP_ERROR_KEY[err instanceof PhotoPrepError ? err.code : 'not_an_image']])
    } finally {
      setPreparing(false)
    }
  }

  function picker(ref: React.RefObject<HTMLInputElement | null>, method: 'camera' | 'gallery') {
    return (
      <input
        ref={ref}
        type="file"
        accept={method === 'camera' ? 'image/*' : 'image/*,.heic,.heif'}
        {...(method === 'camera' ? { capture: 'environment' as const } : {})}
        className="hidden"
        data-testid={`${method}-input`}
        onChange={(e) => {
          void handlePicked(e.target.files?.[0], method)
          e.target.value = ''
        }}
      />
    )
  }

  const chip = value ? (value.capture_method === 'camera' ? m.cameraChip : m.galleryChip) : null

  return (
    <div>
      <p className="font-utility text-sm font-semibold text-[#0e2a63]">{label}</p>
      {exampleUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={exampleUrl} alt={exampleLabel ?? label} className="mt-2 h-20 w-28 rounded-lg object-cover border border-[#e4e8ee]" />
      )}

      {value && previewUrl && (
        <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-[#e4e8ee] px-4 py-3">
          {isUploading ? (
            <div className="h-12 w-12 rounded-lg bg-[#f7f9fc] flex items-center justify-center shrink-0">
              <Loader2 className="h-5 w-5 text-[#2f5daa] animate-spin" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={label} className="h-12 w-12 rounded-lg object-cover shrink-0" />
          )}
          <div className="min-w-0 text-left">
            <p
              data-testid="provenance-chip"
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-utility text-xs ${
                value.capture_method === 'camera' ? 'bg-[#0e2a63]/10 text-[#0e2a63]' : 'bg-[#f7a800]/15 text-[#7a5200]'
              }`}
            >
              {value.capture_method === 'camera' ? <MapPin className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
              {chip}
            </p>
            {value.capture_method === 'gallery' && <p className="mt-1 font-utility text-xs text-[#111827]/55">{m.galleryNote}</p>}
            {isUploading && (
              <p role="status" className="mt-1 font-utility text-xs text-[#111827]/55">
                {typeof progress === 'number' && progress > 0 ? m.uploadingPct.replace('{percent}', String(progress)) : m.uploading}
              </p>
            )}
            {status === 'waiting' && (
              <p role="status" className="mt-1 flex items-center gap-1 font-utility text-xs text-amber-700">
                <CloudOff className="h-3 w-3 shrink-0" /> {m.waitingOnline}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-2.5 flex gap-2">
        <button type="button" disabled={preparing} onClick={() => cameraRef.current?.click()} className={BUTTON}>
          <Camera className="h-5 w-5 text-[#2f5daa]/70" />
          {captureLabel}
        </button>
        <button type="button" disabled={preparing} onClick={() => galleryRef.current?.click()} className={BUTTON}>
          <ImageIcon className="h-5 w-5 text-[#2f5daa]/70" />
          {m.galleryButton}
        </button>
        {picker(cameraRef, 'camera')}
        {picker(galleryRef, 'gallery')}
      </div>

      {preparing && (
        <p role="status" className="mt-2 flex items-center gap-1.5 font-utility text-xs text-[#111827]/55">
          <Loader2 className="h-3 w-3 animate-spin" /> {m.preparing}
        </p>
      )}
      {prepError && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-[11px] text-red-500 font-utility">
          <AlertCircle className="h-3 w-3 shrink-0" /> {prepError}
        </p>
      )}
      {locationError && pending && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="flex items-center gap-1.5 text-[11px] text-red-500 font-utility">
            <AlertCircle className="h-3 w-3 shrink-0" /> {locationRequiredLabel}
          </p>
          <button type="button" onClick={() => readLocation(pending.file)} className="min-h-[44px] text-[11px] font-semibold text-[#0e2a63] underline font-utility">
            {retryLabel}
          </button>
          <button type="button" onClick={() => addGallery(pending.file)} className="min-h-[44px] text-[11px] font-semibold text-[#0e2a63] underline font-utility">
            {m.chooseInstead}
          </button>
        </div>
      )}
      {!locationError && !prepError && (uploadError || status === 'error') && (
        <div className="mt-2 flex items-center gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-red-500 font-utility">
            <AlertCircle className="h-3 w-3 shrink-0" /> {uploadError}
          </p>
          {onRetryUpload && (
            <button type="button" onClick={onRetryUpload} className="min-h-[44px] text-[11px] font-semibold text-[#0e2a63] underline font-utility">
              {retryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
