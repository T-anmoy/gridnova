import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePhotoUploads } from '@/lib/associate/usePhotoUploads'
import { listPendingPhotos } from '@/lib/associate/photo-queue'
import { ApiError } from '@/lib/dashboard/api-error'
import type { CapturedPhoto } from '@/lib/associate/photo-types'

const photo = (name = 'a.jpg'): CapturedPhoto => ({
  file: new File(['pixels'], name, { type: 'image/jpeg' }),
  capture_method: 'camera',
  latitude: 22.5,
  longitude: 88.4,
  captured_at: '2026-01-01T00:00:00Z',
})

let scopeN = 0
let scope: string
beforeEach(() => {
  scope = `test-${(scopeN += 1)}`
})

const describeError = (e: unknown) => (e instanceof ApiError ? (e.detail ?? 'failed') : 'failed')

describe('usePhotoUploads', () => {
  it('uploads, reports progress state, and clears the pending copy only after success', async () => {
    const upload = vi.fn().mockResolvedValue({})
    const { result } = renderHook(() => usePhotoUploads({ scope, upload, describeError }))
    await act(async () => {
      await result.current.capture('front', photo())
    })
    expect(upload).toHaveBeenCalledWith('front', expect.objectContaining({ capture_method: 'camera' }), expect.any(Function))
    await waitFor(() => expect(result.current.status.front).toBe('success'))
    expect(await listPendingPhotos(scope)).toHaveLength(0)
  })

  it('keeps the photo stored while the upload is in flight', async () => {
    let finish: () => void = () => undefined
    const upload = vi.fn(() => new Promise((resolve) => (finish = () => resolve({}))))
    const { result } = renderHook(() => usePhotoUploads({ scope, upload, describeError }))
    act(() => void result.current.capture('front', photo()))
    await waitFor(() => expect(result.current.status.front).toBe('uploading'))
    expect(await listPendingPhotos(scope)).toHaveLength(1)
    await act(async () => finish())
    await waitFor(() => expect(result.current.status.front).toBe('success'))
  })

  it('a network failure leaves it queued ("waiting") and the browser coming back online retries it', async () => {
    const upload = vi.fn().mockRejectedValueOnce(new ApiError(0, 'Network request failed')).mockResolvedValue({})
    const { result } = renderHook(() => usePhotoUploads({ scope, upload, describeError }))
    await act(async () => {
      await result.current.capture('front', photo())
    })
    expect(result.current.status.front).toBe('waiting')
    expect(await listPendingPhotos(scope)).toHaveLength(1)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(result.current.status.front).toBe('success'))
    expect(upload).toHaveBeenCalledTimes(2)
    expect(await listPendingPhotos(scope)).toHaveLength(0)
  })

  it('a 4xx is not retried: shows the error, and a manual retry uploads the same photo again', async () => {
    const upload = vi.fn().mockRejectedValueOnce(new ApiError(422, 'x', 'Not a valid photo')).mockResolvedValue({})
    const { result } = renderHook(() => usePhotoUploads({ scope, upload, describeError }))
    await act(async () => {
      await result.current.capture('front', photo())
    })
    expect(result.current.status.front).toBe('error')
    expect(result.current.errors.front).toBe('Not a valid photo')
    expect(upload).toHaveBeenCalledTimes(1)
    await act(async () => result.current.retry('front'))
    await waitFor(() => expect(result.current.status.front).toBe('success'))
    expect(upload).toHaveBeenCalledTimes(2)
  })

  it('a pending photo survives a simulated reload and uploads on the next visit', async () => {
    const offline = vi.fn().mockRejectedValue(new ApiError(0, 'Network request failed'))
    const first = renderHook(() => usePhotoUploads({ scope, upload: offline, describeError }))
    await act(async () => {
      await first.result.current.capture('front', photo('front.jpg'))
    })
    first.unmount() // the tab closes

    const upload = vi.fn().mockResolvedValue({})
    const second = renderHook(() => usePhotoUploads({ scope, upload, describeError }))
    await waitFor(() => expect(second.result.current.photos.front?.file.name).toBe('front.jpg'))
    expect(second.result.current.photos.front?.capture_method).toBe('camera')
    await waitFor(() => expect(second.result.current.status.front).toBe('success'))
    expect(upload).toHaveBeenCalledWith('front', expect.objectContaining({ latitude: 22.5 }), expect.any(Function))
    expect(await listPendingPhotos(scope)).toHaveLength(0)
  })

  it('removing a photo discards its pending copy', async () => {
    const upload = vi.fn().mockRejectedValue(new ApiError(0, 'Network request failed'))
    const { result } = renderHook(() => usePhotoUploads({ scope, upload, describeError }))
    await act(async () => {
      await result.current.capture('front', photo())
    })
    await act(async () => {
      await result.current.capture('front', null)
    })
    expect(await listPendingPhotos(scope)).toHaveLength(0)
    expect(result.current.photos.front).toBeNull()
  })
})
