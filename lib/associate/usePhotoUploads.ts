'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/dashboard/api-error'
import type { CapturedPhoto, PhotoUploadStatus } from './photo-types'
import { listPendingPhotos, photoRetryDelayMs, putPendingPhoto, removePendingPhoto, type PendingPhoto } from './photo-queue'

// Transient failures keep the photo queued and retry on their own; anything
// else (a 4xx the server won't change its mind about, or a bug in the browser
// code) needs the person to act — retrying it would only re-upload the same
// stored photo forever.
export function isTransientUploadError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 0 || error.status === 429 || error.status >= 500
  // fetch() rejects with a TypeError when the network itself fails.
  return error instanceof TypeError || (error instanceof Error && error.message === 'network')
}

function toPending(scope: string, slot: string, photo: CapturedPhoto): PendingPhoto {
  return {
    id: `${scope}:${slot}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    scope,
    slot,
    blob: photo.file,
    filename: photo.file.name,
    type: photo.file.type,
    captureMethod: photo.capture_method,
    latitude: photo.latitude,
    longitude: photo.longitude,
    capturedAt: photo.captured_at,
    accuracyM: photo.accuracy_m,
    exifTakenAtClient: photo.exif_taken_at_client,
    createdAt: Date.now(),
  }
}

function fromPending(p: PendingPhoto): CapturedPhoto {
  return {
    file: new File([p.blob], p.filename, { type: p.type }),
    capture_method: p.captureMethod,
    latitude: p.latitude,
    longitude: p.longitude,
    captured_at: p.capturedAt ?? new Date(p.createdAt).toISOString(),
    accuracy_m: p.accuracyM,
    exif_taken_at_client: p.exifTakenAtClient,
  }
}

/**
 * Upload state for a set of photo slots. Every photo is written to IndexedDB
 * before upload and removed only once the server confirms it; transient
 * failures retry with backoff (and immediately when the browser comes back
 * online); photos left over from a previous visit resume on mount.
 */
export function usePhotoUploads({
  scope: baseScope,
  owner,
  upload,
  describeError,
}: {
  scope: string
  /** The signed-in user the photos belong to. When given, the queue is scoped to them so a shared phone never uploads one person's photos into another's work. */
  owner?: string | null
  upload: (slot: string, photo: CapturedPhoto, onProgress: (percent: number) => void) => Promise<unknown>
  describeError: (error: unknown) => string
}) {
  const scope = owner ? `${owner}:${baseScope}` : baseScope
  const [photos, setPhotos] = useState<Record<string, CapturedPhoto | null>>({})
  const [status, setStatus] = useState<Record<string, PhotoUploadStatus | undefined>>({})
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [progress, setProgress] = useState<Record<string, number | undefined>>({})

  const uploadRef = useRef(upload)
  const describeRef = useRef(describeError)
  useEffect(() => {
    uploadRef.current = upload
    describeRef.current = describeError
  })
  // Latest attempt per slot — results from a photo that has since been replaced are ignored.
  const current = useRef<Record<string, { id: string; photo: CapturedPhoto; attempts: number; done?: boolean; timer?: ReturnType<typeof setTimeout> }>>({})
  const mounted = useRef(true)

  const attempt = useCallback(async (slot: string, id: string) => {
    const entry = current.current[slot]
    if (!entry || entry.id !== id || entry.done) return
    clearTimeout(entry.timer)
    entry.timer = undefined
    setStatus((s) => ({ ...s, [slot]: 'uploading' }))
    setProgress((p) => ({ ...p, [slot]: 0 }))
    try {
      await uploadRef.current(slot, entry.photo, (percent) => {
        if (current.current[slot]?.id === id) setProgress((p) => ({ ...p, [slot]: percent }))
      })
      if (current.current[slot]?.id !== id) return
      entry.done = true
      await removePendingPhoto(id)
      if (!mounted.current) return
      setStatus((s) => ({ ...s, [slot]: 'success' }))
      setErrors((e) => ({ ...e, [slot]: undefined }))
    } catch (err) {
      if (current.current[slot]?.id !== id || !mounted.current) return
      if (isTransientUploadError(err)) {
        const delay = photoRetryDelayMs(entry.attempts)
        entry.attempts += 1
        setStatus((s) => ({ ...s, [slot]: 'waiting' }))
        entry.timer = setTimeout(() => void attempt(slot, id), delay)
      } else {
        await removePendingPhoto(id)
        setStatus((s) => ({ ...s, [slot]: 'error' }))
        setErrors((e) => ({ ...e, [slot]: describeRef.current(err) }))
      }
    }
  }, [])

  const start = useCallback(
    async (slot: string, photo: CapturedPhoto) => {
      const pending = toPending(scope, slot, photo)
      const previous = current.current[slot]
      if (previous) {
        clearTimeout(previous.timer)
        void removePendingPhoto(previous.id)
      }
      current.current[slot] = { id: pending.id, photo, attempts: 0 }
      setPhotos((p) => ({ ...p, [slot]: photo }))
      setStatus((s) => ({ ...s, [slot]: 'uploading' }))
      setErrors((e) => ({ ...e, [slot]: undefined }))
      await putPendingPhoto(pending)
      await attempt(slot, pending.id)
    },
    [scope, attempt]
  )

  const capture = useCallback(
    (slot: string, photo: CapturedPhoto | null) => {
      if (photo) return start(slot, photo)
      const previous = current.current[slot]
      if (previous) {
        clearTimeout(previous.timer)
        void removePendingPhoto(previous.id)
        delete current.current[slot]
      }
      setPhotos((p) => ({ ...p, [slot]: null }))
      setStatus((s) => ({ ...s, [slot]: undefined }))
      setErrors((e) => ({ ...e, [slot]: undefined }))
      return Promise.resolve()
    },
    [start]
  )

  const retry = useCallback(
    (slot: string) => {
      const entry = current.current[slot]
      if (entry) void start(slot, entry.photo)
    },
    [start]
  )

  // Resume photos left behind by a refresh, a closed tab or a dropped connection.
  useEffect(() => {
    mounted.current = true
    let cancelled = false
    void listPendingPhotos(scope).then((rows) => {
      if (cancelled) return
      const latest = new Map(rows.map((r) => [r.slot, r])) // rows are oldest-first
      for (const [slot, row] of latest) {
        if (current.current[slot]) continue // the person already added one this visit
        const photo = fromPending(row)
        current.current[slot] = { id: row.id, photo, attempts: 0 }
        setPhotos((p) => ({ ...p, [slot]: photo }))
        setStatus((s) => ({ ...s, [slot]: 'waiting' }))
        void attempt(slot, row.id)
      }
      for (const row of rows) if (latest.get(row.slot) !== row) void removePendingPhoto(row.id)
    })
    const timers = current.current
    return () => {
      cancelled = true
      mounted.current = false
      for (const e of Object.values(timers)) clearTimeout(e.timer)
    }
  }, [scope, attempt])

  // Back online: don't wait out the backoff.
  useEffect(() => {
    function onOnline() {
      for (const [slot, e] of Object.entries(current.current)) if (e.timer && !e.done) void attempt(slot, e.id)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [attempt])

  return { photos, status, errors, progress, capture, retry, scope }
}
