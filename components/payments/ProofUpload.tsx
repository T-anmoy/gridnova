'use client'

import { useRef, useState } from 'react'
import { AlertCircle, Camera, CheckCircle2, CloudOff, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useMessages } from '@/lib/i18n/client'
import { MAX_UPLOAD_BYTES, PhotoPrepError, prepareImage } from '@/lib/associate/image-prep'
import { usePhotoUploads } from '@/lib/associate/usePhotoUploads'
import { paymentErrorMessage, type PaymentCopy } from '@/components/payments/payment-errors'

const BUTTON =
  'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#e4e8ee] px-3 py-3 text-center font-utility text-sm font-semibold text-[#0e2a63] hover:border-[#2f5daa]/40'

/**
 * Proof of payment — a photo, screenshot or PDF — using the same two-way,
 * compress-and-queue upload as site photos (it survives a refresh or a dropped
 * signal). Mount it for a payment that still lacks proof: any proof left
 * pending from an earlier visit resumes uploading on mount.
 */
export default function ProofUpload({
  copy,
  paymentId,
  upload,
  startOpen = false,
  onUploaded,
}: {
  copy: PaymentCopy
  paymentId: number
  upload: (paymentId: number, file: File, onProgress: (percent: number) => void) => Promise<unknown>
  startOpen?: boolean
  onUploaded?: () => void
}) {
  const m = useMessages('photoSlot')
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(startOpen)
  const [preparing, setPreparing] = useState(false)
  const [prepError, setPrepError] = useState<string | null>(null)

  const uploads = usePhotoUploads({
    scope: `payment-proof-${paymentId}`,
    upload: async (_slot, photo, onProgress) => {
      await upload(paymentId, photo.file, onProgress)
      onUploaded?.()
    },
    describeError: (err) => paymentErrorMessage(err, copy),
  })
  const photo = uploads.photos.proof
  const status = uploads.status.proof
  const progress = uploads.progress.proof

  async function handlePicked(raw: File | undefined) {
    if (!raw) return
    setPrepError(null)
    setPreparing(true)
    try {
      let file = raw
      if (raw.type === 'application/pdf') {
        if (raw.size > MAX_UPLOAD_BYTES) {
          setPrepError(copy.errors.file_too_large)
          return
        }
      } else {
        file = (await prepareImage(raw)).file
      }
      await uploads.capture('proof', { file, capture_method: 'gallery', captured_at: new Date().toISOString() })
    } catch (err) {
      const key = err instanceof PhotoPrepError ? { not_an_image: 'notAnImage', heic_conversion_failed: 'heicFailed', too_large: 'tooLarge' }[err.code] : 'notAnImage'
      setPrepError(m[key as 'notAnImage' | 'heicFailed' | 'tooLarge'])
    } finally {
      setPreparing(false)
    }
  }

  if (status === 'success') {
    return (
      <p role="status" className="flex items-center gap-1.5 font-utility text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> {copy.proofDone}
      </p>
    )
  }

  if (!open && !photo) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-[44px] font-utility text-sm font-semibold text-[#0e2a63] underline">
        {copy.addProof}
      </button>
    )
  }

  const isPdf = photo?.file.type === 'application/pdf'

  return (
    <div>
      {photo && (
        <p className="mb-2 flex items-center gap-1.5 font-utility text-xs text-[#111827]/70">
          {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
          <span className="truncate">{photo.file.name}</span>
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={preparing} onClick={() => cameraRef.current?.click()} className={BUTTON}>
          <Camera className="h-5 w-5 text-[#2f5daa]/70" />
          {copy.proofTake}
        </button>
        <button type="button" disabled={preparing} onClick={() => fileRef.current?.click()} className={BUTTON}>
          <ImageIcon className="h-5 w-5 text-[#2f5daa]/70" />
          {copy.proofChoose}
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          data-testid="proof-camera-input"
          onChange={(e) => {
            void handlePicked(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif,application/pdf"
          className="hidden"
          data-testid="proof-file-input"
          onChange={(e) => {
            void handlePicked(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      <p className="mt-1.5 font-utility text-[11px] text-[#111827]/65">{copy.proofHint}</p>
      {(preparing || status === 'uploading') && (
        <p role="status" className="mt-2 flex items-center gap-1.5 font-utility text-xs text-[#111827]/65">
          <Loader2 className="h-3 w-3 animate-spin" />
          {preparing ? m.preparing : typeof progress === 'number' && progress > 0 ? m.uploadingPct.replace('{percent}', String(progress)) : m.uploading}
        </p>
      )}
      {status === 'waiting' && (
        <p role="status" className="mt-2 flex items-center gap-1.5 font-utility text-xs text-amber-700">
          <CloudOff className="h-3 w-3 shrink-0" /> {m.waitingOnline}
        </p>
      )}
      {prepError && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-[11px] text-red-500 font-utility">
          <AlertCircle className="h-3 w-3 shrink-0" /> {prepError}
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="mt-2 flex items-center gap-2 text-[11px] text-red-500 font-utility">
          <AlertCircle className="h-3 w-3 shrink-0" /> {uploads.errors.proof}
          <button type="button" onClick={() => uploads.retry('proof')} className="min-h-[44px] font-semibold text-[#0e2a63] underline">
            {copy.retry}
          </button>
        </p>
      )}
    </div>
  )
}
