'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ScanLine, X } from 'lucide-react'

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike

// Scanning exists only where the browser has BarcodeDetector. Typing a serial
// always works; this button is simply absent everywhere else.
function detectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null
}

export default function SerialScanButton({ onScan, label = 'Scan', cancelLabel = 'Cancel', unavailableText = 'The camera isn’t available — type the serial number instead.' }: {
  onScan: (value: string) => void
  label?: string
  cancelLabel?: string
  unavailableText?: string
}) {
  // False on the server and during hydration, then true only where the browser has BarcodeDetector.
  const supported = useSyncExternalStore(
    () => () => undefined,
    () => detectorCtor() !== null,
    () => false
  )
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!open) return
    const Ctor = detectorCtor()
    if (!Ctor) return
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | undefined
    let stopped = false
    const detector = new Ctor()
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        const video = videoRef.current
        if (!video) return
        video.srcObject = s
        void video.play()
        timer = setInterval(() => {
          detector
            .detect(video)
            .then((found) => {
              if (found[0]?.rawValue && !stopped) {
                stopped = true
                onScan(found[0].rawValue)
                setOpen(false)
              }
            })
            .catch(() => undefined)
        }, 300)
      })
      .catch(() => setError(unavailableText))
    return () => {
      stopped = true
      clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [open, onScan, unavailableText])

  if (!supported) return null

  return (
    <>
      <button type="button" onClick={() => { setError(null); setOpen(true) }} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#e4e8ee] px-3 text-sm font-semibold text-[#0e2a63]">
        <ScanLine className="h-4 w-4" /> {label}
      </button>
      {open && (
        <div role="dialog" aria-label={label} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-4">
          <video ref={videoRef} muted playsInline className="max-h-[60vh] w-full max-w-md rounded-xl bg-black" />
          {error && <p role="alert" className="max-w-md rounded-lg bg-white p-3 text-sm text-red-700">{error}</p>}
          <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-white px-4 text-sm font-semibold">
            <X className="h-4 w-4" /> {cancelLabel}
          </button>
        </div>
      )}
    </>
  )
}
