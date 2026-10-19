import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ServiceRequestForm from '@/components/handover/ServiceRequestForm'
import { ENGLISH_SERVICE_FORM_COPY } from '@/lib/handover/form-copy'
import { PhotoPrepError } from '@/lib/associate/image-prep'

const prep = vi.hoisted(() => ({ prepareImage: vi.fn() }))
vi.mock('@/lib/associate/image-prep', async (orig) => ({ ...(await orig<typeof import('@/lib/associate/image-prep')>()), prepareImage: prep.prepareImage }))

const copy = ENGLISH_SERVICE_FORM_COPY
const jpeg = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  prep.prepareImage.mockImplementation(async (file: File) => ({ file, reencoded: false, exifTakenAt: null }))
})

function setup(over: Partial<React.ComponentProps<typeof ServiceRequestForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<ServiceRequestForm copy={copy} maxPhotos={2} onSubmit={onSubmit} describeError={(e) => `ERR:${(e as Error).message}`} {...over} />)
  return onSubmit
}
const pick = (label: RegExp, files: File[]) => fireEvent.change(screen.getByLabelText(label), { target: { files } })

describe('ServiceRequestForm — fields and errors', () => {
  it('labels every field and keeps text inputs at 16px so iOS does not zoom', () => {
    setup()
    for (const el of [screen.getByLabelText(/What is the problem/), screen.getByLabelText(/Describe the problem/), screen.getByLabelText(/Phone number/)]) {
      expect(el.className).toMatch(/text-base/)
    }
    expect(screen.getByLabelText(/Phone number/)).toHaveAttribute('inputmode', 'tel')
  })

  it('on a bad submit it marks the first invalid field, focuses it and does not send', async () => {
    const onSubmit = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Send service request' }))
    const category = screen.getByLabelText(/What is the problem/)
    expect(category).toHaveAttribute('aria-invalid', 'true')
    expect(category).toHaveFocus()
    expect(category).toHaveAccessibleDescription('Choose what the problem is.')
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.selectOptions(category, 'other')
    await userEvent.click(screen.getByRole('button', { name: 'Send service request' }))
    expect(screen.getByLabelText(/Describe the problem/)).toHaveFocus()
    expect(screen.getByLabelText(/Describe the problem/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('sends the typed values and the prepared photos, then resets and announces success', async () => {
    const onSubmit = setup()
    await userEvent.selectOptions(screen.getByLabelText(/What is the problem/), 'inverter_error')
    await userEvent.type(screen.getByLabelText(/Describe the problem/), 'E04 on the display')
    await userEvent.type(screen.getByLabelText(/Phone number/), '9800000000')
    pick(/Choose from phone/, [jpeg('a.jpg')])
    expect(await screen.findByTestId('photo-previews')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Send service request' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const sent = onSubmit.mock.calls[0][0]
    expect(sent).toMatchObject({ category: 'inverter_error', description: 'E04 on the display', contact_phone: '9800000000' })
    expect(sent.files).toHaveLength(1)
    expect(await screen.findByRole('status')).toHaveTextContent('Your service request was sent.')
    expect(screen.getByLabelText(/Describe the problem/)).toHaveValue('')
    expect(screen.queryByTestId('photo-previews')).toBeNull()
  })

  it('shows the transport’s error in an alert and keeps what was typed', async () => {
    const onSubmit = setup()
    onSubmit.mockRejectedValue(new Error('boom'))
    await userEvent.selectOptions(screen.getByLabelText(/What is the problem/), 'other')
    await userEvent.type(screen.getByLabelText(/Describe the problem/), 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Send service request' }))
    expect(await screen.findByText('ERR:boom')).toBeInTheDocument()
    expect(screen.getByLabelText(/Describe the problem/)).toHaveValue('text')
  })

  it('can hide the phone field', () => {
    setup({ showPhone: false })
    expect(screen.queryByLabelText(/Phone number/)).toBeNull()
  })
})

describe('ServiceRequestForm — photos', () => {
  it('stops at the limit and says so', async () => {
    setup()
    pick(/Choose from phone/, [jpeg('1.jpg'), jpeg('2.jpg'), jpeg('3.jpg')])
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))
    expect(screen.getByText('You can attach up to 2 photos.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Choose from phone/)).toBeDisabled()
  })

  it('removing a photo frees the slot and has an accessible name', async () => {
    setup()
    pick(/Choose from phone/, [jpeg('roof.jpg')])
    const remove = await screen.findByRole('button', { name: 'Remove photo roof.jpg' })
    await userEvent.click(remove)
    expect(screen.queryByTestId('photo-previews')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('explains a file that is not a photo and a HEIC that could not be converted', async () => {
    setup()
    prep.prepareImage.mockRejectedValueOnce(new PhotoPrepError('not_an_image'))
    pick(/Choose from phone/, [new File(['x'], 'doc.pdf', { type: 'application/pdf' })])
    expect(await screen.findByText(/That file is not a photo/)).toBeInTheDocument()
    prep.prepareImage.mockRejectedValueOnce(new PhotoPrepError('heic_conversion_failed'))
    pick(/Choose from phone/, [new File(['x'], 'p.heic', { type: 'image/heic' })])
    expect(await screen.findByText(/could not be converted/)).toBeInTheDocument()
  })

  it('offers a camera input on phones', () => {
    setup()
    expect(screen.getByLabelText(/Take a photo/)).toHaveAttribute('capture', 'environment')
  })
})
