import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhotoCaptureSlot from '@/components/associate/PhotoCaptureSlot'

const CAPTURE_LABEL = 'Take photo'
const LOCATION_REQUIRED_LABEL = 'Turn on location to take this photo, then try again.'
const RETRY_LABEL = 'Retry'

function file(name = 'site.jpg') {
  return new File(['x'], name, { type: 'image/jpeg' })
}

beforeEach(() => {
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock') })
})

afterEach(() => {
  vi.unstubAllGlobals()
  // @ts-expect-error test override
  delete navigator.geolocation
})

describe('PhotoCaptureSlot — location failures get their own message, distinct from a camera problem', () => {
  it('a denied/timed-out location read shows the location message (never a camera-unavailable one), with a retry', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (_ok: PositionCallback, err: PositionErrorCallback) => err(new Error('denied') as never) },
    })
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <PhotoCaptureSlot
        label="Front of premises"
        captureLabel={CAPTURE_LABEL}
        locationRequiredLabel={LOCATION_REQUIRED_LABEL}
        retryLabel={RETRY_LABEL}
        value={null}
        onChange={onChange}
      />
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file())

    expect(await screen.findByText(LOCATION_REQUIRED_LABEL)).toBeInTheDocument()
    expect(screen.queryByText(/camera/i)).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('when geolocation is unsupported entirely, still shows the location message, not a camera one', async () => {
    // No navigator.geolocation defined at all (deleted in afterEach/beforeEach state).
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <PhotoCaptureSlot
        label="Front of premises"
        captureLabel={CAPTURE_LABEL}
        locationRequiredLabel={LOCATION_REQUIRED_LABEL}
        retryLabel={RETRY_LABEL}
        value={null}
        onChange={onChange}
      />
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file())
    expect(await screen.findByText(LOCATION_REQUIRED_LABEL)).toBeInTheDocument()
  })

  it('retry re-reads location for the SAME photo — the associate never has to retake it', async () => {
    let attempt = 0
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback, err: PositionErrorCallback) => {
          attempt += 1
          if (attempt === 1) return err(new Error('timeout') as never)
          ok({ coords: { latitude: 22.5, longitude: 88.4 } } as GeolocationPosition)
        },
      },
    })
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <PhotoCaptureSlot
        label="Front of premises"
        captureLabel={CAPTURE_LABEL}
        locationRequiredLabel={LOCATION_REQUIRED_LABEL}
        retryLabel={RETRY_LABEL}
        value={null}
        onChange={onChange}
      />
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const picked = file('front.jpg')
    await user.upload(input, picked)
    await screen.findByText(LOCATION_REQUIRED_LABEL)

    await user.click(screen.getByRole('button', { name: RETRY_LABEL }))

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(onChange.mock.calls[0][0]).toMatchObject({ file: picked, latitude: 22.5, longitude: 88.4 })
  })
})

describe('PhotoCaptureSlot — upload-to-server failure (photo already captured) is a separate error', () => {
  it('shows uploadError with its own retry, without touching the location error state', async () => {
    const onRetryUpload = vi.fn()
    render(
      <PhotoCaptureSlot
        label="Front of premises"
        captureLabel={CAPTURE_LABEL}
        locationRequiredLabel={LOCATION_REQUIRED_LABEL}
        retryLabel={RETRY_LABEL}
        value={{ file: file(), latitude: 22.5, longitude: 88.4, captured_at: '2026-01-01T00:00:00Z' }}
        onChange={vi.fn()}
        uploadError="This photo couldn't be uploaded. Please try again."
        onRetryUpload={onRetryUpload}
      />
    )
    expect(screen.getByText("This photo couldn't be uploaded. Please try again.")).toBeInTheDocument()
    expect(screen.queryByText(LOCATION_REQUIRED_LABEL)).not.toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: RETRY_LABEL }))
    expect(onRetryUpload).toHaveBeenCalledTimes(1)
  })
})
