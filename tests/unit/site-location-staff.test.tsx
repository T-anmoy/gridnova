import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmLocationPrompt, SiteLocationCard, checkReasons } from '@/components/dashboard/SiteLocationStaff'
import { ApiError } from '@/lib/dashboard/api-error'
import { withI18n } from './helpers/i18n'
import type { SiteLocation } from '@/lib/associate/onboarding-types'

const mutateAsync = vi.fn()
vi.mock('@/lib/dashboard/onboarding-api-client', () => ({
  useCorrectSiteLocation: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const LOC: SiteLocation = {
  present: true,
  confirmed: true,
  latitude: 22.5726,
  longitude: 88.3639,
  source: 'google_maps_link',
  accuracy_m: null,
  verified: false,
  precision: 'viewport_center',
  flags: ['approximate_location', 'unverified_source', 'far_from_photos'],
  photo_distance_m: 640,
  maps_url: 'https://www.google.com/maps?q=22.5726,88.3639',
  check_with_customer: true,
}

beforeEach(() => {
  mutateAsync.mockReset()
})

describe('staff Site location card', () => {
  it('shows coordinates, source, verified/confirmed, flags, photo distance and Open in Google Maps', () => {
    render(withI18n(<SiteLocationCard onboardingId={9} location={LOC} role="admin" />))
    const card = screen.getByTestId('staff-site-location')
    expect(card).toHaveTextContent('22.5726, 88.3639')
    expect(card).toHaveTextContent('Google Maps link')
    expect(card).toHaveTextContent('map centre')
    expect(card).toHaveTextContent('Not verified')
    expect(card).toHaveTextContent('Confirmed by associate')
    expect(card).toHaveTextContent('about 640 m')
    expect(card).toHaveTextContent('Approximate')
    expect(card).toHaveTextContent('Far from where the site photos were taken')
    expect(screen.getByRole('link', { name: /Open in Google Maps/ })).toHaveAttribute('href', LOC.maps_url)
  })

  it('says plainly when there is no location', () => {
    render(withI18n(<SiteLocationCard onboardingId={9} location={{ present: false, confirmed: false, flags: ['location_missing'] }} role="sales" />))
    expect(screen.getByTestId('staff-site-location')).toHaveTextContent('No site location on file')
  })

  it.each(['admin', 'sales'] as const)('%s can correct the location', (role) => {
    render(withI18n(<SiteLocationCard onboardingId={9} location={LOC} role={role} />))
    expect(screen.getByRole('button', { name: 'Correct location' })).toBeInTheDocument()
  })

  it.each(['management', 'engineer', 'operations', 'accounts', undefined] as const)('%s gets no correct control (it would always 403)', (role) => {
    render(withI18n(<SiteLocationCard onboardingId={9} location={LOC} role={role} />))
    expect(screen.queryByRole('button', { name: 'Correct location' })).not.toBeInTheDocument()
  })
})

describe('correct-location dialog', () => {
  async function open() {
    const user = userEvent.setup()
    render(withI18n(<SiteLocationCard onboardingId={9} location={LOC} role="admin" />))
    await user.click(screen.getByRole('button', { name: 'Correct location' }))
    return user
  }

  it('requires a reason of at least 5 characters, and says the correction is audited', async () => {
    const user = await open()
    expect(screen.getByRole('dialog')).toHaveTextContent(/audited/)
    const save = screen.getByRole('button', { name: 'Save correction' })
    await user.type(screen.getByLabelText(/Google Maps link or coordinates/), '22.6, 88.4')
    expect(save).toBeDisabled() // no reason yet
    await user.type(screen.getByLabelText(/Reason/), '  ab ')
    expect(save).toBeDisabled() // 2 characters after trimming
    await user.type(screen.getByLabelText(/Reason/), 'cdef')
    expect(save).not.toBeDisabled()
  })

  it('sends coordinates as pasted_coordinates with the trimmed reason', async () => {
    mutateAsync.mockResolvedValue({})
    const user = await open()
    await user.type(screen.getByLabelText(/Google Maps link or coordinates/), '22.6, 88.4')
    await user.type(screen.getByLabelText(/Reason/), '  Customer confirmed on call  ')
    await user.click(screen.getByRole('button', { name: 'Save correction' }))
    expect(mutateAsync).toHaveBeenCalledWith({ id: 9, input: { source: 'pasted_coordinates', text: '22.6, 88.4', reason: 'Customer confirmed on call' } })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('sends a link as google_maps_link', async () => {
    mutateAsync.mockResolvedValue({})
    const user = await open()
    await user.click(screen.getByLabelText(/Google Maps link or coordinates/))
    await user.paste('https://maps.app.goo.gl/abc')
    await user.type(screen.getByLabelText(/Reason/), 'Pin was on the wrong lane')
    await user.click(screen.getByRole('button', { name: 'Save correction' }))
    expect(mutateAsync.mock.calls[0][0].input).toEqual({ source: 'google_maps_link', link: 'https://maps.app.goo.gl/abc', reason: 'Pin was on the wrong lane' })
  })

  it('keeps the dialog open and shows a plain sentence when the server refuses', async () => {
    mutateAsync.mockRejectedValue(new ApiError(422, 'API error 422', 'x', { code: 'no_coordinates_in_link', message: 'x' }))
    const user = await open()
    await user.click(screen.getByLabelText(/Google Maps link or coordinates/))
    await user.paste('https://maps.app.goo.gl/abc')
    await user.type(screen.getByLabelText(/Reason/), 'Pin was on the wrong lane')
    await user.click(screen.getByRole('button', { name: 'Save correction' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('no exact point')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows a 403 refusal (e.g. a lead that belongs to another salesperson) as the server worded it', async () => {
    mutateAsync.mockRejectedValue(new ApiError(403, 'API error 403', 'You can only change your own leads.'))
    const user = await open()
    await user.type(screen.getByLabelText(/Google Maps link or coordinates/), '22.6, 88.4')
    await user.type(screen.getByLabelText(/Reason/), 'Customer confirmed')
    await user.click(screen.getByRole('button', { name: 'Save correction' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You can only change your own leads.')
  })
})

describe('verification-call prompt', () => {
  it('asks staff to confirm the location with the customer and lists the reasons', () => {
    render(<ConfirmLocationPrompt location={LOC} />)
    const prompt = screen.getByTestId('confirm-location-prompt')
    expect(prompt).toHaveTextContent('Confirm the site location with the customer')
    expect(prompt).toHaveTextContent('Approximate')
    expect(prompt).toHaveTextContent('Far from where the site photos were taken')
  })
  it('is shown when there is no location at all', () => {
    render(<ConfirmLocationPrompt location={{ present: false, confirmed: false }} />)
    expect(screen.getByTestId('confirm-location-prompt')).toHaveTextContent('No site location is on file.')
  })
  it('is not shown for a verified, unflagged, confirmed location', () => {
    render(<ConfirmLocationPrompt location={{ ...LOC, verified: true, flags: [], check_with_customer: false, source: 'device_gps', accuracy_m: 8 }} />)
    expect(screen.queryByTestId('confirm-location-prompt')).not.toBeInTheDocument()
  })
  it('checkReasons covers an unconfirmed, unverified GPS fix', () => {
    expect(checkReasons({ present: true, confirmed: false, verified: false, flags: [] })).toEqual(['Location is not verified.', 'The associate has not confirmed the location.'])
  })
})
