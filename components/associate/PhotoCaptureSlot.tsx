'use client'

import { useRef, useState } from 'react'
import { Camera, AlertCircle, MapPin, Loader2 } from 'lucide-react'

export interface CapturedPhoto {
  file: File
  latitude: number
  longitude: number
  captured_at: string
}

// Camera-only capture (capture="environment" forces the device camera on
// mobile, never the photo gallery — a gallery picker would defeat the point
// of a geotagged, time-stamped site photo) plus mandatory geolocation read
// at the moment of capture. A denied/unavailable/timed-out location read is
// a distinct failure from the camera itself — it gets its own message and a
// retry that re-reads location for the same already-picked photo, rather
// than making the associate take the photo again.
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
}: {
  label: string
  exampleUrl?: string | null
  exampleLabel?: string
  captureLabel: string
  locationRequiredLabel: string
  retryLabel: string
  value: CapturedPhoto | null
  onChange: (photo: CapturedPhoto | null) => void
  // Upload-to-server state, once a photo has already been captured with a
  // location — distinct from the capture-time location error above.
  uploading?: boolean
  uploadError?: string
  onRetryUpload?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const previewUrl = value ? URL.createObjectURL(value.file) : null

  function requestLocation(file: File) {
    if (!navigator.geolocation) {
      setPendingFile(file)
      setError(locationRequiredLabel)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setError(null)
        setPendingFile(null)
        onChange({
          file,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          captured_at: new Date().toISOString(),
        })
      },
      () => {
        setPendingFile(file)
        setError(locationRequiredLabel)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  function handlePicked(file: File | undefined) {
    if (!file) return
    setError(null)
    requestLocation(file)
  }

  function handleRetry(e: React.MouseEvent) {
    e.stopPropagation()
    if (pendingFile) requestLocation(pendingFile)
  }

  return (
    <div>
      <p className="font-utility text-sm font-semibold text-[#0e2a63]">{label}</p>
      {exampleUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={exampleUrl} alt={exampleLabel ?? label} className="mt-2 h-20 w-28 rounded-lg object-cover border border-[#e4e8ee]" />
      )}
      <div
        onClick={() => inputRef.current?.click()}
        className="mt-2.5 rounded-xl border-2 border-dashed border-[#e4e8ee] hover:border-[#2f5daa]/40 px-5 py-5 text-center cursor-pointer transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handlePicked(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {value && previewUrl ? (
          <div className="flex items-center justify-center gap-3">
            {uploading ? (
              <div className="h-12 w-12 rounded-lg bg-[#f7f9fc] flex items-center justify-center shrink-0">
                <Loader2 className="h-5 w-5 text-[#2f5daa] animate-spin" />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={label} className="h-12 w-12 rounded-lg object-cover shrink-0" />
            )}
            <div className="text-left">
              <p className="flex items-center gap-1 font-utility text-xs text-[#0e2a63]">
                <MapPin className="h-3 w-3" /> {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
              </p>
              <p className="font-utility text-xs text-[#111827]/50">{new Date(value.captured_at).toLocaleString()}</p>
            </div>
          </div>
        ) : (
          <>
            <Camera className="h-6 w-6 mx-auto mb-2 text-[#2f5daa]/60" />
            <p className="text-sm font-utility text-[#0e2a63] font-semibold">{captureLabel}</p>
          </>
        )}
      </div>
      {error && (
        <div className="mt-2 flex items-center gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-red-500 font-utility">
            <AlertCircle className="h-3 w-3 shrink-0" /> {error}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="text-[11px] font-semibold text-[#0e2a63] underline font-utility"
          >
            {retryLabel}
          </button>
        </div>
      )}
      {!error && uploadError && (
        <div className="mt-2 flex items-center gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-red-500 font-utility">
            <AlertCircle className="h-3 w-3 shrink-0" /> {uploadError}
          </p>
          {onRetryUpload && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRetryUpload()
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
