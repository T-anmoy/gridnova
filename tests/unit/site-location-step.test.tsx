import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { en, withI18n } from './helpers/i18n'
import { fakeGeolocation, removeGeolocation } from './helpers/geolocation'
import { ApiError } from '@/lib/dashboard/api-error'
import type { Onboarding, SiteLocation, SiteLocationOptions } from '@/lib/associate/onboarding-types'

const setMutateAsync = vi.fn()
const confirmMutateAsync = vi.fn()
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useSetSiteLocation: () => ({ mutateAsync: setMutateAsync, isPending: false }),
  useConfirmSiteLocation: () => ({ mutateAsync: confirmMutateAsync, isPending: false }),
}))

import SiteLocationStep, { PhotoLocationPrompt } from '@/components/associate/SiteLocationStep'

const m = en.siteLocation
const OPTIONS: SiteLocationOptions = {
  accuracy_good_m: 20,
  accuracy_warn_m: 50,
  accuracy_reject_m: 200,
  sample_seconds: 10,
  required_to_submit: true,
  sources: ['device_gps', 'photo_gps', 'google_maps_link', 'pasted_coordinates'],
  recommended_source: 'photo_gps',
}
const NOT_SET: SiteLocation = { present: false, confirmed: false, flags: ['location_missing'] }
const SET: SiteLocation = {
  present: true,
  confirmed: false,
  latitude: 22.5726,
  longitude: 88.3639,
  source: 'device_gps',
  accuracy_m: 12,
  verified: true,
  flags: [],
  maps_url: 'https://www.google.com/maps?q=22.5726,88.3639',
}
const wrap = (site_location: SiteLocation, warnings: unknown[] = []) => ({ site_location, warnings }) as unknown as Onboarding

function setup(over: Partial<React.ComponentProps<typeof SiteLocationStep>> = {}) {
  const onAdopt = vi.fn()
  const onTakePhoto = vi.fn()
  const utils = render(
    withI18n(
      <SiteLocationStep onboardingId={42} location={NOT_SET} options={OPTIONS} photoCandidate={null} onAdopt={onAdopt} onTakePhoto={onTakePhoto} {...over} />
    )
  )
  return { onAdopt, onTakePhoto, ...utils }
}

const apiError = (status: number, detail: Record<string, unknown>) => new ApiError(status, `API error ${status}`, String(detail.message ?? ''), detail)

beforeEach(() => {
  setMutateAsync.mockReset()
  confirmMutateAsync.mockReset()
})
afterEach(() => removeGeolocation())

describe('SiteLocationStep — the four states', () => {
  it.each([
    [NOT_SET, m.state.notSet, 'notSet'],
    [SET, m.state.needsConfirm, 'needsConfirm'],
    [{ ...SET, confirmed: true, verified: true }, m.state.confirmedVerified, 'confirmedVerified'],
    [{ ...SET, confirmed: true, verified: false, source: 'google_maps_link' as const }, m.state.confirmedUnverified, 'confirmedUnverified'],
  ])('shows "%#" in words', (loc, label, key) => {
    setup({ location: loc })
    expect(screen.getByTestId('location-state')).toHaveTextContent(label)
    expect(screen.getByTestId('location-state')).toHaveAttribute('data-state', key)
  })
})

describe('SiteLocationStep — photos first', () => {
  it('always shows the priority card with the camera message and the quieter gallery line', () => {
    setup()
    const card = screen.getByTestId('photos-first-card')
    expect(card).toHaveTextContent(m.priority.title)
    expect(card).toHaveTextContent(m.priority.body)
    expect(card).toHaveTextContent(m.priority.galleryLine)
  })

  it('without a photo location, "Take a photo now" is the primary action and "Use my photo" is absent', async () => {
    const { onTakePhoto } = setup()
    expect(screen.queryByTestId('use-photo-location')).not.toBeInTheDocument()
    const take = screen.getByRole('button', { name: m.actions.takePhoto })
    expect(take.className).toContain('bg-[#0e2a63]')
    await userEvent.setup().click(take)
    expect(onTakePhoto).toHaveBeenCalled()
  })

  it('with an embedded photo slot there is no jump-away button; the slot renders on this screen', () => {
    setup({ photoSlot: <div>EMBEDDED SLOT</div>, onTakePhoto: undefined })
    expect(screen.getByTestId('house-photo-slot')).toHaveTextContent('EMBEDDED SLOT')
    expect(screen.queryByRole('button', { name: m.actions.takePhoto })).not.toBeInTheDocument()
  })

  it('with a camera photo location, "Use the location of my site photo" becomes the primary one-tap action', async () => {
    setMutateAsync.mockResolvedValue(wrap(SET))
    const { onAdopt } = setup({ photoCandidate: { slot: 'front', accuracy_m: 9 } })
    const use = screen.getByTestId('use-photo-location')
    expect(use.className).toContain('bg-[#0e2a63]')
    expect(screen.getByRole('button', { name: m.actions.takePhoto }).className).not.toContain('bg-[#0e2a63]')
    await userEvent.setup().click(use)
    expect(setMutateAsync).toHaveBeenCalledWith({ id: 42, input: { source: 'photo_gps', photo_slot: 'front' } })
    await waitFor(() => expect(onAdopt).toHaveBeenCalled())
  })
})

describe('SiteLocationStep — capture location here', () => {
  it('shows a calm live line, sends the best reading with accuracy_m and captured_at, and releases the watcher', async () => {
    const geo = fakeGeolocation()
    setMutateAsync.mockResolvedValue(wrap(SET))
    const { onAdopt } = setup()
    await userEvent.setup().click(screen.getByRole('button', { name: m.actions.captureHere }))
    expect(screen.getByTestId('gps-finding')).toHaveTextContent(m.gps.finding)
    expect(geo.active()).toBe(1)

    act(() => geo.emit(60, 22.1, 88.1))
    act(() => geo.emit(12, 22.5726, 88.3639)) // at or under accuracy_good_m: stops early
    await waitFor(() => expect(setMutateAsync).toHaveBeenCalledTimes(1))
    const input = setMutateAsync.mock.calls[0][0].input
    expect(input).toMatchObject({ source: 'device_gps', latitude: 22.5726, longitude: 88.3639, accuracy_m: 12 })
    expect(new Date(input.captured_at).toString()).not.toBe('Invalid Date')
    expect(geo.active()).toBe(0)
    await waitFor(() => expect(onAdopt).toHaveBeenCalled())
    expect(await screen.findByTestId('gps-note')).toHaveTextContent('Saved — accurate to about 12 m.')
  })

  it('a poor reading is saved with a warning and a Retry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const geo = fakeGeolocation()
      setMutateAsync.mockResolvedValue(wrap(SET))
      setup()
      fireEvent.click(screen.getByRole('button', { name: m.actions.captureHere }))
      act(() => geo.emit(90))
      await act(async () => {
        vi.advanceTimersByTime(10_000)
      })
      await waitFor(() => expect(screen.getByTestId('gps-note')).toHaveTextContent('about 90 m'))
      expect(setMutateAsync).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: m.actions.retry })).toBeInTheDocument()
      expect(geo.active()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a reading above accuracy_reject_m is never sent; Retry and the Google Maps option are offered', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const geo = fakeGeolocation()
      setup()
      fireEvent.click(screen.getByRole('button', { name: m.actions.captureHere }))
      act(() => geo.emit(450))
      await act(async () => {
        vi.advanceTimersByTime(10_000)
      })
      await waitFor(() => expect(screen.getByTestId('gps-note')).toHaveTextContent('too rough'))
      expect(setMutateAsync).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: m.actions.retry })).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: m.actions.haveLink }).length).toBeGreaterThanOrEqual(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('permission denied: its own message, Retry, and a pointer to the Google Maps option', async () => {
    const geo = fakeGeolocation()
    setup()
    await userEvent.setup().click(screen.getByRole('button', { name: m.actions.captureHere }))
    act(() => geo.fail(1))
    const alert = await screen.findByTestId('gps-error')
    expect(alert).toHaveAttribute('data-code', 'denied')
    expect(alert).toHaveTextContent(m.gps.denied)
    expect(alert).toHaveTextContent(m.gps.alternative)
    expect(screen.getByRole('button', { name: m.actions.retry })).toBeInTheDocument()
    expect(geo.active()).toBe(0)
    // Retry starts a fresh session.
    await userEvent.setup().click(screen.getByRole('button', { name: m.actions.retry }))
    expect(geo.watchPosition).toHaveBeenCalledTimes(2)
  })

  it('timeout: its own message with Retry and the Google Maps option', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const geo = fakeGeolocation()
      setup()
      fireEvent.click(screen.getByRole('button', { name: m.actions.captureHere }))
      await act(async () => {
        vi.advanceTimersByTime(20_000)
      })
      const alert = await screen.findByTestId('gps-error')
      expect(alert).toHaveAttribute('data-code', 'timeout')
      expect(alert).toHaveTextContent(m.gps.timeout)
      expect(within(alert).getByRole('button', { name: m.actions.retry })).toBeInTheDocument()
      expect(within(alert).getByRole('button', { name: m.actions.haveLink })).toBeInTheDocument()
      expect(geo.active()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('no GPS support: its own message and the Google Maps option (no pointless Retry)', async () => {
    removeGeolocation()
    setup()
    await userEvent.setup().click(screen.getByRole('button', { name: m.actions.captureHere }))
    const alert = await screen.findByTestId('gps-error')
    expect(alert).toHaveAttribute('data-code', 'unsupported')
    expect(alert).toHaveTextContent(m.gps.unsupported)
    expect(within(alert).queryByRole('button', { name: m.actions.retry })).not.toBeInTheDocument()
    expect(within(alert).getByRole('button', { name: m.actions.haveLink })).toBeInTheDocument()
  })

  it('releases the watcher when the step goes away mid-session', async () => {
    const geo = fakeGeolocation()
    const { unmount } = setup()
    await userEvent.setup().click(screen.getByRole('button', { name: m.actions.captureHere }))
    act(() => geo.emit(70))
    expect(geo.active()).toBe(1)
    unmount()
    expect(geo.active()).toBe(0)
  })

  it('offline: keeps the reading, says it will save later, and sends it when the connection returns', async () => {
    const geo = fakeGeolocation()
    setMutateAsync.mockRejectedValueOnce(new ApiError(0, 'Network request failed')).mockResolvedValueOnce(wrap(SET))
    const { onAdopt } = setup()
    await userEvent.setup().click(screen.getByRole('button', { name: m.actions.captureHere }))
    act(() => geo.emit(10))
    expect(await screen.findByTestId('gps-waiting-online')).toHaveTextContent(m.gps.waitingOnline)
    expect(onAdopt).not.toHaveBeenCalled() // never "done" until the server accepts it

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(onAdopt).toHaveBeenCalledTimes(1))
    expect(setMutateAsync).toHaveBeenCalledTimes(2)
    expect(setMutateAsync.mock.calls[1][0].input).toMatchObject({ source: 'device_gps', accuracy_m: 10 })
    expect(screen.queryByTestId('gps-waiting-online')).not.toBeInTheDocument()
  })
})

describe('SiteLocationStep — Google Maps link or pasted coordinates', () => {
  async function paste(text: string) {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: m.actions.haveLink }))
    await user.click(screen.getByLabelText(m.paste.label))
    await user.paste(text)
    await user.click(screen.getByRole('button', { name: m.actions.save }))
  }

  it('routes a link to google_maps_link', async () => {
    setMutateAsync.mockResolvedValue(wrap(SET))
    setup()
    await paste('https://maps.app.goo.gl/abc')
    expect(setMutateAsync).toHaveBeenCalledWith({ id: 42, input: { source: 'google_maps_link', link: 'https://maps.app.goo.gl/abc' } })
  })

  it('routes numbers to pasted_coordinates', async () => {
    setMutateAsync.mockResolvedValue(wrap(SET))
    setup()
    await paste('22.5726, 88.3639')
    expect(setMutateAsync).toHaveBeenCalledWith({ id: 42, input: { source: 'pasted_coordinates', text: '22.5726, 88.3639' } })
  })

  it('shows the plain sentence for a contract error, plus the guidance the server asked for', async () => {
    setMutateAsync.mockRejectedValue(
      apiError(422, {
        code: 'no_coordinates_in_link',
        message: 'x',
        guidance_keys: ['site_location.guidance.drop_pin_and_share', 'site_location.guidance.use_device_gps', 'site_location.guidance.paste_coordinates'],
      })
    )
    setup()
    await paste('https://maps.app.goo.gl/abc')
    const alert = await screen.findByTestId('location-error')
    expect(alert).toHaveAttribute('data-code', 'no_coordinates_in_link')
    expect(alert).toHaveTextContent(m.errors.no_coordinates_in_link)
    expect(alert).toHaveTextContent(m.guidance.drop_pin_and_share)
    expect(alert).toHaveTextContent(m.guidance.use_device_gps)
    expect(alert).toHaveTextContent(m.guidance.paste_coordinates)
  })

  it('a rate limit (429) says to wait or use GPS', async () => {
    setMutateAsync.mockRejectedValue(new ApiError(429, 'API error 429'))
    setup()
    await paste('https://maps.app.goo.gl/abc')
    expect(await screen.findByTestId('location-error')).toHaveTextContent(m.errors.link_rate_limited)
  })

  it('the help sheet has four steps in order', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: m.actions.haveLink }))
    await user.click(screen.getByRole('button', { name: m.actions.howTo }))
    const sheet = screen.getByTestId('maps-help')
    const items = sheet.querySelectorAll('ol > li')
    expect(items).toHaveLength(4)
    m.help.steps.forEach((s, i) => expect(items[i]).toHaveTextContent(s.title))
    await user.click(screen.getByRole('button', { name: m.help.close }))
    expect(screen.queryByTestId('maps-help')).not.toBeInTheDocument()
  })
})

describe('SiteLocationStep — a location that is set', () => {
  it('shows coordinates, accuracy, source, Open in Google Maps from the server maps_url, and says how to change it', () => {
    setup({ location: SET })
    expect(screen.getByTestId('location-coords')).toHaveTextContent('22.5726, 88.3639')
    expect(screen.getByText(/about 12 m/)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(m.source.device_gps))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: m.actions.openMaps })).toHaveAttribute('href', SET.maps_url)
    expect(screen.getByText(m.details.resetNote)).toBeInTheDocument()
  })

  it('renders the server flags in plain language and never the staff-only ones', () => {
    setup({
      location: { ...SET, source: 'google_maps_link', verified: false, precision: 'viewport_center', flags: ['approximate_location', 'unverified_source', 'far_from_photos', 'low_accuracy'], photo_distance_m: 412 },
    })
    for (const k of ['approximate_location', 'unverified_source', 'far_from_photos', 'low_accuracy'] as const) expect(screen.getByText(m.flags[k])).toBeInTheDocument()
    expect(screen.getByText(/About 412 m/)).toBeInTheDocument()
    expect(screen.queryByText(/check_with_customer/)).not.toBeInTheDocument()
  })

  it('needs an explicit confirmation and there is no skip', async () => {
    confirmMutateAsync.mockResolvedValue(wrap({ ...SET, confirmed: true }))
    const { onAdopt } = setup({ location: SET })
    expect(screen.queryByRole('button', { name: /skip|later|not now/i })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: m.actions.confirm }))
    expect(confirmMutateAsync).toHaveBeenCalledWith(42)
    await waitFor(() => expect(onAdopt).toHaveBeenCalled())
  })

  it('once confirmed the confirm button is gone, and changing the location is offered again', async () => {
    setup({ location: { ...SET, confirmed: true } })
    expect(screen.queryByRole('button', { name: m.actions.confirm })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: m.actions.change }))
    expect(screen.getByRole('button', { name: m.actions.captureHere })).toBeInTheDocument()
  })

  it('changing the location adopts the server response, where confirmation is cleared', async () => {
    setMutateAsync.mockResolvedValue(wrap({ ...SET, confirmed: false, latitude: 22.6, longitude: 88.4 }))
    const { onAdopt } = setup({ location: { ...SET, confirmed: true } })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: m.actions.change }))
    await user.click(screen.getByRole('button', { name: m.actions.haveLink }))
    await user.click(screen.getByLabelText(m.paste.label))
    await user.paste('22.6, 88.4')
    await user.click(screen.getByRole('button', { name: m.actions.save }))
    await waitFor(() => expect(onAdopt).toHaveBeenCalled())
    expect(onAdopt.mock.calls[0][0].site_location.confirmed).toBe(false)
  })

  it('a confirm failure shows its sentence', async () => {
    confirmMutateAsync.mockRejectedValue(apiError(409, { code: 'site_location_not_set', message: 'x' }))
    setup({ location: SET })
    await userEvent.setup().click(screen.getByRole('button', { name: m.actions.confirm }))
    expect(await screen.findByTestId('location-error')).toHaveTextContent(m.errors.site_location_not_set)
  })
})

describe('PhotoLocationPrompt — in the photos step', () => {
  function prompt(over: Partial<React.ComponentProps<typeof PhotoLocationPrompt>> = {}) {
    const onAdopt = vi.fn()
    const onBackToHouse = vi.fn()
    render(withI18n(<PhotoLocationPrompt onboardingId={42} location={NOT_SET} candidate={null} onAdopt={onAdopt} onBackToHouse={onBackToHouse} {...over} />))
    return { onAdopt, onBackToHouse }
  }

  it('appears only when a camera photo with a location exists and no location is set', () => {
    prompt()
    expect(screen.queryByTestId('photo-location-prompt')).not.toBeInTheDocument()
  })

  it('asks the one-tap question and calls photo_gps for the best slot', async () => {
    setMutateAsync.mockResolvedValue(wrap(SET))
    const { onAdopt } = prompt({ candidate: { slot: 'front', accuracy_m: 7 } })
    expect(screen.getByTestId('photo-location-prompt')).toHaveTextContent(m.photoPrompt.question)
    await userEvent.setup().click(screen.getByRole('button', { name: m.photoPrompt.yes }))
    expect(setMutateAsync).toHaveBeenCalledWith({ id: 42, input: { source: 'photo_gps', photo_slot: 'front' } })
    await waitFor(() => expect(onAdopt).toHaveBeenCalled())
  })

  it('is hidden once a location is set, and offers a way back to confirm it', async () => {
    const { onBackToHouse } = prompt({ location: SET, candidate: { slot: 'front', accuracy_m: 7 } })
    expect(screen.queryByTestId('photo-location-prompt')).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: m.actions.backToHouse }))
    expect(onBackToHouse).toHaveBeenCalled()
  })
})

describe('privacy — coordinates never reach logs', () => {
  it('does not log a reading, a link or an error during a full capture + failure', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => {}))
    const geo = fakeGeolocation()
    setMutateAsync.mockRejectedValue(apiError(422, { code: 'outside_india', message: 'Point 22.5726,88.3639 is outside India' }))
    setup()
    await userEvent.setup().click(screen.getByRole('button', { name: m.actions.captureHere }))
    act(() => geo.emit(8, 22.5726, 88.3639))
    await screen.findByTestId('location-error')
    expect(screen.getByTestId('location-error')).not.toHaveTextContent('22.5726') // the server's text is never echoed
    for (const s of spies) for (const call of s.mock.calls) expect(JSON.stringify(call)).not.toMatch(/22\.5726|88\.3639/)
    spies.forEach((s) => s.mockRestore())
  })
})
