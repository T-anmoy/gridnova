'use client'

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

export interface SignaturePadHandle {
  isEmpty: () => boolean
  clear: () => void
  /** A PNG no larger than `maxBytes`, or null when the pad is empty or it cannot be made small enough. */
  toPng: (maxBytes: number) => Promise<Blob | null>
}

const toBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))

/**
 * Encodes `source` as PNG, scaling it down (¾ each try) until it fits under
 * `maxBytes`. A signature drawn on a phone is normally a few tens of KB, so
 * this almost always returns on the first try; it gives up (null) rather than
 * ever sending something the server will refuse with 413.
 */
export async function fitPngUnder(
  source: HTMLCanvasElement,
  maxBytes: number,
  encode: (c: HTMLCanvasElement) => Promise<Blob | null> = toBlob,
  makeCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')
): Promise<Blob | null> {
  let canvas = source
  for (let attempt = 0; attempt < 6; attempt++) {
    const blob = await encode(canvas)
    if (!blob) return null
    if (blob.size <= maxBytes) return blob
    const next = makeCanvas()
    next.width = Math.max(1, Math.round(canvas.width * 0.75))
    next.height = Math.max(1, Math.round(canvas.height * 0.75))
    const ctx = next.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(canvas, 0, 0, next.width, next.height)
    canvas = next
  }
  return null
}

/**
 * A small signature pad: finger, stylus or mouse (pointer events), a Clear
 * button, and a PNG export that refuses an empty pad. Touch scrolling is
 * disabled only on the pad itself so the page still scrolls around it.
 */
export default function SignaturePad({
  ref,
  id,
  label,
  hint,
  clearLabel,
  onInkChange,
  disabled,
  invalid,
  describedBy,
}: {
  ref?: React.Ref<SignaturePadHandle>
  id: string
  label: string
  hint: string
  clearLabel: string
  onInkChange?: (hasInk: boolean) => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const inkRef = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  const setInk = useCallback(
    (v: boolean) => {
      inkRef.current = v
      setHasInk(v)
      onInkChange?.(v)
    },
    [onInkChange]
  )

  // Size the drawing buffer to the element (sharp on high-DPI phones). Done
  // once on mount; a later resize keeps what was drawn rather than wiping it.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 2.2
      ctx.strokeStyle = '#091c3c'
    }
  }, [])

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drawing.current = true
    last.current = point(e)
    const ctx = e.currentTarget.getContext('2d')
    if (ctx) {
      // A tap leaves a dot, so a deliberate mark always counts as ink.
      ctx.beginPath()
      ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2)
      ctx.fillStyle = '#091c3c'
      ctx.fill()
    }
    if (!inkRef.current) setInk(true)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return
    const p = point(e)
    const ctx = e.currentTarget.getContext('2d')
    if (ctx && last.current) {
      ctx.beginPath()
      ctx.moveTo(last.current.x, last.current.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
    last.current = p
  }

  function end() {
    drawing.current = false
    last.current = null
  }

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
    setInk(false)
  }, [setInk])

  useImperativeHandle(
    ref,
    () => ({
      isEmpty: () => !inkRef.current,
      clear,
      toPng: async (maxBytes: number) => {
        if (!inkRef.current || !canvasRef.current) return null
        return fitPngUnder(canvasRef.current, maxBytes)
      },
    }),
    [clear]
  )

  const hintId = `${id}-hint`
  return (
    <div>
      <p id={`${id}-label`} className="font-utility text-xs text-[#111827]/65 uppercase tracking-[0.1em] mb-1.5">
        {label}
      </p>
      <canvas
        ref={canvasRef}
        id={id}
        data-testid={`${id}-canvas`}
        role="img"
        aria-labelledby={`${id}-label`}
        aria-describedby={[hintId, describedBy].filter(Boolean).join(' ')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        className={`block h-40 w-full touch-none rounded-xl border-2 bg-white ${invalid ? 'border-red-300' : 'border-dashed border-[#c9d2de]'} ${disabled ? 'opacity-50' : 'cursor-crosshair'}`}
      />
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <p id={hintId} className="text-xs text-[#111827]/65 font-utility">
          {hint}
        </p>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasInk}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#0e2a63] font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] disabled:opacity-40"
        >
          <Eraser className="h-4 w-4" aria-hidden="true" /> {clearLabel}
        </button>
      </div>
    </div>
  )
}
