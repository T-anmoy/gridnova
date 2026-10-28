import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { fillDateField } from './helpers/date-field'
import { ApiError } from '@/lib/dashboard/api-error'
import { APPLY_FIELD_STEP, applyFieldErrors, stepsWithErrors } from '@/lib/associate/apply-errors'
import en from '@/messages/en.json'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'

// FE-19 item 10: a refused application shows every field error from its stable `code`, in
// the reader's language; the API's English `msg` is only the fallback.

const root = path.resolve(__dirname, '../..')
const contract = readFileSync(path.join(root, 'docs/api/associate_journeys.md'), 'utf8')

/** Every code in the §1 table of associate_journeys.md. */
function contractCodes(): string[] {
  const section = contract.slice(contract.indexOf('| code | field(s) |'), contract.indexOf('**Emails to the applicant**'))
  const codes = new Set<string>()
  for (const line of section.split('\n').slice(2)) {
    const first = line.split('|')[1] ?? ''
    for (const m of first.matchAll(/`([a-z_]+)`/g)) codes.add(m[1])
  }
  return [...codes]
}

const refused = (detail: unknown[]) => new ApiError(422, 'API error 422', 'x', { fieldErrors: detail })

describe('the contract’s field-error codes', () => {
  it('lists the codes of associate_journeys.md §1', () => {
    const codes = contractCodes()
    expect(codes.length).toBeGreaterThanOrEqual(30)
    expect(codes).toContain('pan_not_individual')
    expect(codes).toContain('heic_not_supported')
  })

  it.each([
    ['en', en],
    ['hi', hi],
    ['bn', bn],
  ])('every code has a sentence in %s', (_lang, messages) => {
    const map = messages.associates.wizard.fieldErrors as Record<string, string>
    const missing = contractCodes().filter((c) => !map[c]?.trim())
    expect(missing).toEqual([])
  })

  it('Hindi and Bengali sentences are not the English one', () => {
    for (const c of contractCodes()) {
      const e = (en.associates.wizard.fieldErrors as Record<string, string>)[c]
      expect((hi.associates.wizard.fieldErrors as Record<string, string>)[c], c).not.toBe(e)
      expect((bn.associates.wizard.fieldErrors as Record<string, string>)[c], c).not.toBe(e)
    }
  })

  it('every field the contract names in §1 is asked on a wizard step', () => {
    const fields = ['full_name', 'date_of_birth', 'aadhaar_number', 'pan', 'bank_account_number', 'bank_ifsc', 'gstin', 'masked_aadhaar', 'pan_card', 'photo', 'cancelled_cheque', 'reference_1_mobile', 'reference_2_mobile']
    for (const f of fields) expect(APPLY_FIELD_STEP[f], f).toBeTruthy()
  })
})

describe('applyFieldErrors', () => {
  const map = hi.associates.wizard.fieldErrors as Record<string, string>

  it('turns each item into its field’s sentence in the reader’s language', () => {
    const r = applyFieldErrors(
      refused([
        { loc: ['body', 'pan'], msg: "The PAN must be an individual's PAN (4th character 'P').", type: 'value_error', code: 'pan_not_individual' },
        { loc: ['body', 'aadhaar_number'], msg: 'Invalid Aadhaar', type: 'value_error', code: 'aadhaar_checksum' },
      ]),
      map,
    )!
    expect(r.byField).toEqual({ pan: map.pan_not_individual, aadhaar_number: map.aadhaar_checksum })
    expect(r.general).toEqual([])
  })

  it('maps both consent fields to the one tick-box and notices a stale consent', () => {
    const r = applyFieldErrors(refused([{ loc: ['body', 'kyc_consent_version'], msg: 'stale', code: 'consent_version_stale' }]), map)!
    expect(r.byField).toEqual({ consent: map.consent_version_stale })
    expect(r.consentStale).toBe(true)
  })

  it('falls back to the English msg only for a code this build does not know', () => {
    const r = applyFieldErrors(refused([{ loc: ['body', 'pan'], msg: 'Some new rule', code: 'brand_new_code' }]), map)!
    expect(r.byField.pan).toBe('Some new rule')
  })

  it('keeps an error for no form field as a general sentence', () => {
    const r = applyFieldErrors(refused([{ loc: ['body'], msg: 'x', code: 'invalid' }]), map)!
    expect(r.general).toEqual([map.invalid])
  })

  it('is null for anything that is not a 422 with field errors', () => {
    expect(applyFieldErrors(new ApiError(409, 'x', 'dup', { code: 'duplicate', field: 'pan' }), map)).toBeNull()
    expect(applyFieldErrors(new Error('x'), map)).toBeNull()
  })

  it('orders the steps that hold errors as the wizard asks them', () => {
    const steps = ['personal', 'address', 'identityBank', 'capability', 'documents', 'consent', 'review']
    expect(stepsWithErrors({ photo: 'x', pan: 'y' }, steps)).toEqual(['identityBank', 'documents'])
  })
})

// ── The form itself, in Hindi ───────────────────────────────────────────────

const submit = vi.fn()
const refetchConsent = vi.fn()
// Photos are shrunk in the browser before upload; jsdom cannot decode images.
vi.mock('@/lib/associate/image-prep', async (orig) => ({
  ...(await orig<typeof import('@/lib/associate/image-prep')>()),
  prepareImage: async (file: File) => ({ file, reencoded: false, exifTakenAt: null }),
}))
vi.mock('@/lib/associate/portal-session', async (orig) => ({ ...(await orig<object>()), useDraftUserId: () => ({ userId: 'u1', ready: true }) }))
vi.mock('@/lib/associate/api-client', () => ({
  useTerritoryStates: () => ({ data: [{ lgd_code: 19, name: 'West Bengal' }], isSuccess: true }),
  useTerritoryDistricts: () => ({ data: [] }),
  useTerritoryBlocks: () => ({}),
  useKycConsent: () => ({ data: { version: 'kyc-v1', text: 'Consent text' }, isLoading: false, error: null, refetch: refetchConsent }),
  useSeatAvailability: () => ({ data: undefined, isFetching: false }),
  submitApplication: (...a: unknown[]) => submit(...a),
}))

async function walkToReview(t: typeof hi.associates) {
  const { default: AssociateApplyForm } = await import('@/components/associate/AssociateApplyForm')
  const view = render(<AssociateApplyForm kind="associate" t={t as never} />)
  const f = t.wizard.fields
  const next = () => fireEvent.click(screen.getByRole('button', { name: t.wizard.common.next }))
  fireEvent.change(screen.getByLabelText(f.full_name.label), { target: { value: 'Asha Roy' } })
  fillDateField(f.date_of_birth.label, '1990-01-01')
  fireEvent.change(screen.getByLabelText(f.mobile.label), { target: { value: '9876543210' } })
  fireEvent.change(screen.getByLabelText(f.email.label), { target: { value: 'asha@example.com' } })
  next()
  fireEvent.change(screen.getByLabelText(f.address_line.label), { target: { value: '12 Lane, Habra' } })
  fireEvent.change(screen.getByLabelText(t.wizard.common.stateLabel), { target: { value: '19' } })
  fireEvent.change(screen.getByLabelText(f.pin_code.label), { target: { value: '743263' } })
  next()
  fireEvent.change(screen.getByLabelText(f.aadhaar_number.label), { target: { value: '234567890124' } })
  fireEvent.change(screen.getByLabelText(f.pan.label), { target: { value: 'ABCPE1234F' } })
  fireEvent.change(screen.getByLabelText(f.bank_account_number.label), { target: { value: '123456789012' } })
  fireEvent.change(screen.getByLabelText(f.bank_ifsc.label), { target: { value: 'HDFC0001234' } })
  next()
  fireEvent.click(screen.getByRole('radio', { name: t.wizard.associate.capabilitySales }))
  next()
  for (const input of view.container.querySelectorAll<HTMLInputElement>('input[type="file"]')) {
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['x'], 'doc.jpg', { type: 'image/jpeg' })] } })
    })
  }
  next()
  fireEvent.click(screen.getByRole('checkbox'))
  next()
  return view
}

describe('the apply form shows the server’s field errors beside their fields (hi)', () => {
  beforeEach(() => {
    submit.mockReset()
    window.localStorage.clear()
  })

  it('jumps to the first step with an error, shows each sentence in Hindi, names the other steps, and never the English msg', async () => {
    submit.mockRejectedValue(
      refused([
        { loc: ['body', 'pan'], msg: "The PAN must be an individual's PAN (4th character 'P').", type: 'value_error', code: 'pan_not_individual' },
        { loc: ['body', 'photo'], msg: 'HEIC is not supported', type: 'value_error', code: 'heic_not_supported' },
      ]),
    )
    await walkToReview(hi.associates)
    fireEvent.click(screen.getByRole('button', { name: hi.associates.wizard.common.submit }))
    const fe = hi.associates.wizard.fieldErrors
    expect(await screen.findByText(fe.pan_not_individual)).toBeInTheDocument()
    expect(screen.getByLabelText(hi.associates.wizard.fields.pan.label)).toHaveAttribute('aria-invalid', 'true')
    const banner = screen.getByTestId('apply-error')
    expect(banner).toHaveTextContent(hi.associates.wizard.common.errorFields)
    expect(banner).toHaveTextContent(hi.associates.wizard.stepNames.documents)
    expect(screen.queryByText(/individual's PAN/)).toBeNull()

    // The documents step still shows its error after the identity step is passed again.
    fireEvent.click(screen.getByRole('button', { name: hi.associates.wizard.common.next }))
    fireEvent.click(screen.getByRole('button', { name: hi.associates.wizard.common.next }))
    await waitFor(() => expect(screen.getByText(fe.heic_not_supported)).toBeInTheDocument())
  })

  it('a stale consent unticks the box, reloads the text and says why', async () => {
    submit.mockRejectedValue(refused([{ loc: ['body', 'kyc_consent_version'], msg: 'stale', code: 'consent_version_stale' }]))
    await walkToReview(hi.associates)
    fireEvent.click(screen.getByRole('button', { name: hi.associates.wizard.common.submit }))
    expect(await screen.findByTestId('apply-error')).toHaveTextContent(hi.associates.wizard.common.consentUpdated)
    expect(refetchConsent).toHaveBeenCalled()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('a duplicate names the field as the form does, not by its API name', async () => {
    submit.mockRejectedValue(new ApiError(409, 'API error 409', 'An application with this PAN already exists.', { code: 'duplicate', field: 'pan' }))
    await walkToReview(hi.associates)
    fireEvent.click(screen.getByRole('button', { name: hi.associates.wizard.common.submit }))
    expect(await screen.findByTestId('apply-error')).toHaveTextContent(hi.associates.wizard.fields.pan.label)
    expect(screen.queryByText(/already exists/)).toBeNull()
  })
})
