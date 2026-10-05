import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhotoCaptureSlot from '@/components/associate/PhotoCaptureSlot'
import { PhotoPrepError } from '@/lib/associate/image-prep'
import { en, withI18n } from './helpers/i18n'
import type { CapturedPhoto } from '@/lib/associate/photo-types'

const prepare = vi.fn()
vi.mock('@/lib/associate/image-prep', async (orig) => ({ ...(await orig<typeof import('@/lib/associate/image-prep')>()), prepareImage: (f: File) => prepare(f) }))

const CAPTURE_LABEL = 'Take photo'
const LOCATION_REQUIRED_LABEL = 'Turn on location to take this photo, then try again.'
const RETRY_LABEL = 'Retry'
const m = en.photoSlot

function file(name = 'site.jpg') {
  return new File(['x'], name, { type: 'image/jpeg' })
}

function setup(props: Partial<React.ComponentProps<typeof PhotoCaptureSlot>> = {}) {
  const onChange = vi.fn()
  const utils = render(
    withI18n(
      <PhotoCaptureSlot
        label="Front of premises"
        captureLabel={CAPTURE_LABEL}
        locationRequiredLabel={LOCATION_REQUIRED_LABEL}
        retryLabel={RETRY_LABEL}
        value={null}
        onChange={onChange}
        {...props}
      />
    )
  )
  const camera = utils.container.querySelector('[data-testid="camera-input"]') as HTMLInputElement
  const gallery = utils.container.querySelector('[data-testid="gallery-input"]') as HTMLInputElement
  return { onChange, camera, gallery, ...utils }
}

function geolocation(impl: (ok: PositionCallback, err: PositionErrorCallback) => void) {
  const getCurrentPosition = vi.fn(impl)
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })
  return getCurrentPosition
}

beforeEach(() => {
  prepare.mockImplementation(async (f: File) => ({ file: f, reencoded: false, exifTakenAt: null }))
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock') })
})

afterEach(() => {
  vi.unstubAllGlobals()
  prepare.mockReset()
  // @ts-expect-error test override
  delete navigator.geolocation
})

describe('PhotoCaptureSlot — two ways in', () => {
  it('offers both "Take photo" and "Choose from phone"', () => {
    const { camera, gallery } = setup()
    expect(screen.getByRole('button', { name: CAPTURE_LABEL })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.galleryButton })).toBeInTheDocument()
    expect(camera).toHaveAttribute('capture', 'environment')
    expect(gallery).not.toHaveAttribute('capture')
    expect(gallery.accept).toContain('.heic')
  })

  it('camera path requires location and sends capture_method=camera with the GPS reading and accuracy', async () => {
    geolocation((ok) => ok({ coords: { latitude: 22.5, longitude: 88.4, accuracy: 12 } } as GeolocationPosition))
    const { camera, onChange } = setup()
    const picked = file('front.jpg')
    await userEvent.setup().upload(camera, picked)
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(onChange.mock.calls[0][0]).toMatchObject({ file: picked, capture_method: 'camera', latitude: 22.5, longitude: 88.4, accuracy_m: 12 })
  })

  it('omits accuracy_m when the reading reports none', async () => {
    geolocation((ok) => ok({ coords: { latitude: 22.5, longitude: 88.4, accuracy: 0 } } as GeolocationPosition))
    const { camera, onChange } = setup()
    await userEvent.setup().upload(camera, file())
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('accuracy_m')
  })

  it('gallery path never asks for location and sends capture_method=gallery without coordinates', async () => {
    const getCurrentPosition = geolocation(() => undefined)
    const { gallery, onChange } = setup()
    prepare.mockResolvedValueOnce({ file: file('re.jpg'), reencoded: true, exifTakenAt: '2026-03-05T10:20:30Z' })
    await userEvent.setup().upload(gallery, file('IMG_1.heic'))
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(getCurrentPosition).not.toHaveBeenCalled()
    const photo = onChange.mock.calls[0][0] as CapturedPhoto
    expect(photo).toMatchObject({ capture_method: 'gallery', exif_taken_at_client: '2026-03-05T10:20:30Z' })
    expect(photo.latitude).toBeUndefined()
    expect(photo.longitude).toBeUndefined()
  })

  it('a conversion failure shows a clear message and adds nothing', async () => {
    prepare.mockRejectedValueOnce(new PhotoPrepError('heic_conversion_failed'))
    const { gallery, onChange } = setup()
    await userEvent.setup().upload(gallery, file('IMG_1.heic'))
    expect(await screen.findByText(m.heicFailed)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('PhotoCaptureSlot — location failures get their own message, distinct from a camera problem', () => {
  it('a denied location read keeps the photo, shows the location message with Retry, and offers the gallery path', async () => {
    geolocation((_ok, err) => err(new Error('denied') as never))
    const { camera, onChange } = setup()
    await userEvent.setup().upload(camera, file())
    expect(await screen.findByText(LOCATION_REQUIRED_LABEL)).toBeInTheDocument()
    expect(screen.queryByText(/camera is/i)).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: RETRY_LABEL })).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: m.chooseInstead }))
    expect(onChange).toHaveBeenCalledTimes(1)
    const photo = onChange.mock.calls[0][0] as CapturedPhoto
    expect(photo.capture_method).toBe('gallery')
    expect(photo.latitude).toBeUndefined()
    expect(screen.queryByText(LOCATION_REQUIRED_LABEL)).not.toBeInTheDocument()
  })

  it('unsupported geolocation still shows the location message', async () => {
    const { camera } = setup()
    await userEvent.setup().upload(camera, file())
    expect(await screen.findByText(LOCATION_REQUIRED_LABEL)).toBeInTheDocument()
  })

  it('retry re-reads location for the SAME photo — the associate never has to retake it', async () => {
    let attempt = 0
    geolocation((ok, err) => {
      attempt += 1
      if (attempt === 1) return err(new Error('timeout') as never)
      ok({ coords: { latitude: 22.5, longitude: 88.4, accuracy: 5 } } as GeolocationPosition)
    })
    const { camera, onChange } = setup()
    const picked = file('front.jpg')
    const user = userEvent.setup()
    await user.upload(camera, picked)
    await screen.findByText(LOCATION_REQUIRED_LABEL)
    await user.click(screen.getByRole('button', { name: RETRY_LABEL }))
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(onChange.mock.calls[0][0]).toMatchObject({ file: picked, capture_method: 'camera', latitude: 22.5, longitude: 88.4 })
  })
})

describe('PhotoCaptureSlot — provenance and upload state', () => {
  const camera: CapturedPhoto = { file: file(), capture_method: 'camera', latitude: 22.5, longitude: 88.4, captured_at: '2026-01-01T00:00:00Z' }
  const gallery: CapturedPhoto = { file: file(), capture_method: 'gallery', captured_at: '2026-01-01T00:00:00Z' }

  it('shows "Camera · location saved" for a camera photo', () => {
    setup({ value: camera })
    expect(screen.getByTestId('provenance-chip')).toHaveTextContent(m.cameraChip)
    expect(screen.queryByText(m.galleryNote)).not.toBeInTheDocument()
  })

  it('shows "From phone · location not verified" plus one calm line for a gallery photo, and no flags', () => {
    setup({ value: gallery })
    expect(screen.getByTestId('provenance-chip')).toHaveTextContent(m.galleryChip)
    expect(screen.getByText(m.galleryNote)).toBeInTheDocument()
    expect(screen.queryByTestId('photo-flags')).toBeNull()
  })

  it('keeps both buttons available once a photo is attached', () => {
    setup({ value: camera })
    expect(screen.getByRole('button', { name: CAPTURE_LABEL })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.galleryButton })).toBeInTheDocument()
  })

  it('shows upload progress, and the "will upload when you\'re online" state', () => {
    const { rerender } = setup({ value: camera, status: 'uploading', progress: 40 })
    expect(screen.getByRole('status')).toHaveTextContent('Uploading 40%')
    rerender(
      withI18n(
        <PhotoCaptureSlot label="x" captureLabel={CAPTURE_LABEL} locationRequiredLabel="l" retryLabel={RETRY_LABEL} value={camera} onChange={vi.fn()} status="waiting" />
      )
    )
    expect(screen.getByText(m.waitingOnline)).toBeInTheDocument()
  })

  it('shows uploadError with its own retry, without touching the location error state', async () => {
    const onRetryUpload = vi.fn()
    setup({ value: camera, uploadError: "This photo couldn't be uploaded. Please try again.", onRetryUpload })
    expect(screen.getByText("This photo couldn't be uploaded. Please try again.")).toBeInTheDocument()
    expect(screen.queryByText(LOCATION_REQUIRED_LABEL)).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: RETRY_LABEL }))
    expect(onRetryUpload).toHaveBeenCalledTimes(1)
  })
})
