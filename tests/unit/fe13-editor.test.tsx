import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProposalDocumentEditor } from '@/components/dashboard/proposal-document/ProposalDocumentEditor'
import { PREVIEW_DEBOUNCE_MS } from '@/components/dashboard/proposal-document/ProposalPreview'
import type { DocumentView } from '@/lib/proposals/document-types'
import { NO_DOCUMENT_VIEW, docError, documentView, editResponse, makeDocument, technicalView } from './fixtures/proposal-document-contract'

// These tests type into many fields; under a fully loaded CI runner 5 s is not always enough.
vi.setConfig({ testTimeout: 15000 })

// A new getToken on every render, as an un-memoised auth hook would give.
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: () => Promise.resolve('token') }) }))

let mockView: DocumentView | undefined
const mockRefetch = vi.fn()
const mockEdit = vi.fn()
const mockPreview = vi.fn()
vi.mock('@/lib/proposals/document-api-client', () => ({
  useProposalDocument: () => ({ data: mockView, isLoading: false, error: null, refetch: mockRefetch }),
  useEditDocumentSection: () => ({ mutateAsync: (...a: unknown[]) => mockEdit(...a), isPending: false }),
  fetchPreviewPdf: (...a: unknown[]) => mockPreview(...a),
}))
vi.mock('@/lib/dashboard/api-client', () => ({
  useEquipment: () => ({
    data: [
      { id: 1, category: 'module', brand: 'Sova Solar', model_name: 'S1', specification: null, is_dcr_compliant: true, procurement_price_inr: 9999, is_active: true, created_at: null },
      { id: 2, category: 'inverter', brand: 'Dummy Brand', model_name: 'D', specification: null, is_dcr_compliant: false, procurement_price_inr: null, is_active: true, created_at: null, is_placeholder: true },
    ],
    isError: false,
  }),
}))

function setInline(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const section = (name: string) => document.querySelector(`[data-section="${name}"]`) as HTMLElement

function renderEditor(props: Partial<React.ComponentProps<typeof ProposalDocumentEditor>> = {}) {
  return render(<ProposalDocumentEditor proposalId={12} totalValue={201465} requiresSignoff={false} {...props} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockView = documentView()
  mockPreview.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))
  mockRefetch.mockResolvedValue({})
  URL.createObjectURL = vi.fn(() => `blob:preview-${Math.random()}`)
  URL.revokeObjectURL = vi.fn()
  setInline(false)
})
afterEach(() => vi.useRealTimers())

describe('field states follow editable_sections from the API', () => {
  it('Admin / Sales: every section editable, computed figures greyed, fixed parts locked, signatory from the API', () => {
    renderEditor()
    for (const s of ['addressee', 'connection', 'site', 'pm_surya_ghar', 'plant', 'system', 'boq', 'customer_scope', 'payment_terms', 'notes']) {
      expect(section(s).dataset.editable, s).toBe('true')
    }
    expect(screen.getByLabelText('DISCOM')).toBeEnabled()
    expect(screen.getByTestId('price-summary').querySelectorAll('[data-state="computed"]').length).toBeGreaterThan(0)
    expect(screen.getByText('₹2,01,465.00')).toBeInTheDocument()
    const fixed = screen.getByTestId('fixed-parts')
    expect(within(fixed).getByText(/SIGNATORY FROM API, Authorised Signatory — For Grid Nova Energy/)).toBeInTheDocument()
    expect(within(fixed).getAllByText(/Same on every proposal — changed only by Admin in settings/).length).toBeGreaterThan(5)
    expect(screen.getByTestId('layout-badge')).toHaveTextContent('Compact layout')
    expect(screen.getByTestId('document-reference')).toHaveTextContent('Allocated on approval')
  })

  it('Management: reads everything, edits nothing (editable_sections empty)', () => {
    mockView = documentView({ editable_sections: [] })
    renderEditor()
    expect(document.querySelectorAll('[data-editable="true"]')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /^Save / })).not.toBeInTheDocument()
    expect(screen.getByLabelText('DISCOM')).toBeDisabled()
    expect(screen.getByTestId('proposal-preview')).toBeInTheDocument()
  })

  it('Engineer: technical view only — system and BOQ editable, plant read-only, no money, no preview', async () => {
    mockView = technicalView()
    setInline(true)
    renderEditor({ totalValue: null })
    expect(section('system').dataset.editable).toBe('true')
    expect(section('boq').dataset.editable).toBe('true')
    expect(section('plant').dataset.editable).toBe('false')
    expect(section('addressee')).toBeNull()
    expect(screen.queryByTestId('proposal-preview')).not.toBeInTheDocument()
    expect(screen.queryByTestId('price-summary')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/₹|Rs\.|GST|Total incl/)
    expect(screen.queryByLabelText('Package')).not.toBeInTheDocument()
    await new Promise((r) => setTimeout(r, PREVIEW_DEBOUNCE_MS + 50))
    expect(mockPreview).not.toHaveBeenCalled()
  })

  it('PM Surya Ghar shows only while the subsidy is opted', () => {
    mockView = documentView({ document: makeDocument({ pm_surya_ghar: { subsidy_opted: false, portal_registered: false, approved_capacity_kwp: null } }) })
    renderEditor()
    expect(section('pm_surya_ghar')).toBeNull()
  })

  it('an older proposal (has_document false) shows the plain note and no editor', () => {
    mockView = NO_DOCUMENT_VIEW
    renderEditor()
    expect(screen.getByTestId('no-document-note')).toHaveTextContent('This proposal was created before the new template and cannot be edited here.')
    expect(screen.queryByTestId('proposal-document-editor')).not.toBeInTheDocument()
  })
})

describe('saving one section at a time', () => {
  it('marks unsaved changes, reports dirty, sends {base_revision, section, whole value}, and logs the change', async () => {
    const onDirty = vi.fn()
    mockEdit.mockImplementation(async () => {
      const res = editResponse({ document: makeDocument({ connection: { ...makeDocument().connection, discom: 'WBSEDCL' } }) })
      mockView = res
      return res
    })
    const user = userEvent.setup()
    renderEditor({ onDirtyChange: onDirty })
    await user.type(screen.getByLabelText('DISCOM'), 'WBSEDCL')
    expect(screen.getByTestId('unsaved-connection')).toBeInTheDocument()
    expect(onDirty).toHaveBeenLastCalledWith(true)
    await user.click(within(section('connection')).getByRole('button', { name: 'Save electricity connection' }))
    expect(mockEdit).toHaveBeenCalledWith({
      proposalId: 12,
      base_revision: 3,
      section: 'connection',
      value: { discom: 'WBSEDCL', consumer_number: '1234567', sub_division: null, sanctioned_load_kw: '5', category: 'Residential', phase: 'single' },
    })
    await waitFor(() => expect(screen.queryByTestId('unsaved-connection')).not.toBeInTheDocument())
    expect(onDirty).toHaveBeenLastCalledWith(false)
    expect(within(screen.getByTestId('session-changes')).getByText('connection.discom')).toBeInTheDocument()
    expect(within(screen.getByTestId('session-changes')).getByText('WBSEDCL')).toBeInTheDocument()
  })

  it('explains regenerated sections, the price move and the sign-off flip after a capacity change', async () => {
    mockEdit.mockImplementation(async () => {
      const res = editResponse({ regenerated_sections: ['boq', 'payment_terms'], layout: 'detailed', total_value: 980000, requires_manager_signoff: true })
      mockView = res
      return res
    })
    const user = userEvent.setup()
    renderEditor()
    const cap = screen.getByLabelText('Plant capacity (kWp)')
    await user.clear(cap)
    await user.type(cap, '12')
    await user.click(within(section('plant')).getByRole('button', { name: 'Save plant configuration' }))
    const notice = await screen.findByTestId('save-notice')
    expect(notice).toHaveTextContent('Regenerated: Bill of quantity, Price & payment terms')
    expect(notice).toHaveTextContent('because the plant changed')
    expect(notice).toHaveTextContent('layout is now Detailed')
    expect(notice).toHaveTextContent(/price changed from ₹2,01,465 to ₹9,80,000/)
    expect(notice).toHaveTextContent('now needs manager sign-off')
  })

  it('BOQ: add, remove and reorder rows; the catalogue offers real brands only (no placeholders)', async () => {
    mockEdit.mockImplementation(async () => editResponse())
    const user = userEvent.setup()
    renderEditor()
    const boq = section('boq')
    expect(within(boq).getAllByTestId('boq-row')).toHaveLength(2)
    const picker = within(boq).getByRole('combobox', { name: 'Add a catalogue make to row 2' })
    expect(within(picker).queryByText('Dummy Brand')).not.toBeInTheDocument()
    await user.selectOptions(picker, 'Sova Solar')
    expect(within(boq).getByLabelText('Make', { selector: '#doc-field-boq-1-make' })).toHaveValue('Sova Solar / Equivalent')
    await user.click(within(boq).getByRole('button', { name: 'Move row 2 up' }))
    await user.click(within(boq).getByRole('button', { name: 'Add row' }))
    await user.type(screen.getByLabelText('Description', { selector: '#doc-field-boq-2-description' }), 'Earthing kit')
    await user.type(screen.getByLabelText('Quantity', { selector: '#doc-field-boq-2-quantity' }), '1 set')
    await user.type(screen.getByLabelText('Make', { selector: '#doc-field-boq-2-make' }), 'Equivalent')
    await user.click(within(boq).getByRole('button', { name: 'Remove row 2' }))
    await user.click(within(boq).getByRole('button', { name: 'Save bill of quantity' }))
    const sent = mockEdit.mock.calls[0][0]
    expect(sent.section).toBe('boq')
    // Inverter moved to the top, a row added, then the modules row (now row 2) removed.
    expect(sent.value.map((r: { description: string }) => r.description)).toEqual(['Grid-tied inverter', 'Earthing kit'])
    expect(sent.value[0].make).toBe('Sova Solar / Equivalent')
  })

  it('payment terms: running total, and no save unless exactly 100 %', async () => {
    const user = userEvent.setup()
    renderEditor()
    expect(screen.getByTestId('payment-total')).toHaveTextContent('100 %')
    const first = screen.getByLabelText('Percent', { selector: '#doc-field-payment-terms-0-percent' })
    await user.clear(first)
    await user.type(first, '25')
    expect(screen.getByTestId('payment-total')).toHaveTextContent('105 %')
    await user.click(within(section('payment_terms')).getByRole('button', { name: 'Save price & payment terms' }))
    expect(mockEdit).not.toHaveBeenCalled()
    expect(within(section('payment_terms')).getByRole('alert')).toHaveTextContent('105 %. They must add up to exactly 100 %')
  })

  it('token chips explain “filled in automatically”', () => {
    renderEditor()
    expect(within(section('boq')).getAllByTestId('token-chips')[0]).toHaveTextContent('{module_technology}')
    expect(within(section('boq')).getAllByTestId('token-chips')[0]).toHaveTextContent('filled in automatically')
  })

  it('a forbidden marker is caught before the request', async () => {
    const user = userEvent.setup()
    renderEditor()
    await user.type(screen.getByLabelText('Inverter'), 'DUMMY inverter')
    await user.click(within(section('system')).getByRole('button', { name: 'Save system configuration' }))
    expect(mockEdit).not.toHaveBeenCalled()
    expect(within(section('system')).getByRole('alert')).toHaveTextContent('placeholder markers')
  })
})

describe('server errors land on the right field', () => {
  it('409 stale_version keeps the typing and offers “Copy my text” and reload', async () => {
    mockEdit.mockRejectedValue(docError(409, { code: 'stale_version', message: 'x', current_revision: 5 }))
    const user = userEvent.setup()
    // After setup(): user-event installs its own clipboard.
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderEditor()
    await user.type(screen.getByLabelText('DISCOM'), 'WBSEDCL')
    await user.click(within(section('connection')).getByRole('button', { name: 'Save electricity connection' }))
    expect(await within(section('connection')).findByText('Someone else changed this proposal — reload to see their changes.')).toBeInTheDocument()
    expect(screen.getByLabelText('DISCOM')).toHaveValue('WBSEDCL')
    await user.click(within(section('connection')).getByRole('button', { name: 'Copy my text' }))
    expect(writeText.mock.calls[0][0]).toContain('WBSEDCL')
    await user.click(within(section('connection')).getByRole('button', { name: 'Reload latest' }))
    expect(mockRefetch).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByLabelText('DISCOM')).toHaveValue(''))
  })

  it('422 make_not_in_catalogue is shown on that row’s make', async () => {
    mockEdit.mockRejectedValue(docError(422, { code: 'make_not_in_catalogue', message: 'Unknown', field: 'boq[1].make' }))
    const user = userEvent.setup()
    renderEditor()
    await user.type(screen.getByLabelText('Make', { selector: '#doc-field-boq-1-make' }), ' / Acme')
    await user.click(within(section('boq')).getByRole('button', { name: 'Save bill of quantity' }))
    const err = await screen.findByText(/not in the equipment catalogue/)
    expect(err.id).toBe('doc-field-boq-1-make-error')
    expect(document.activeElement?.id).toBe('doc-field-boq-1-make')
  })

  it.each([
    [docError(422, { code: 'invalid_value', message: 'addressee.mobile: must be 10 digits', field: 'addressee' }), 'addressee.mobile: must be 10 digits'],
    [docError(403, { code: 'field_not_editable', message: 'x', field: 'addressee' }), 'Your role cannot change this part of the proposal.'],
    [docError(409, { code: 'proposal_locked', message: 'x' }), 'This proposal is approved or sent, so it can no longer be changed. Request a revision to make changes.'],
    [docError(409, { code: 'no_document', message: 'x' }), 'This proposal was created before the new template and cannot be edited here.'],
  ])('%o → section message', async (err, text) => {
    mockEdit.mockRejectedValue(err)
    const user = userEvent.setup()
    renderEditor()
    await user.type(screen.getByLabelText('Name'), 'x')
    await user.click(within(section('addressee')).getByRole('button', { name: 'Save customer & addressee' }))
    expect(await within(section('addressee')).findByText(text)).toBeInTheDocument()
  })

  it('422 payment_terms_total from the server is shown on the milestones', async () => {
    mockEdit.mockRejectedValue(docError(422, { code: 'payment_terms_total', message: 'x', field: 'payment_terms' }))
    const user = userEvent.setup()
    renderEditor()
    await user.type(screen.getByLabelText('Short label (optional)', { selector: '#doc-field-payment-terms-0-short-label' }), 'Order')
    await user.click(within(section('payment_terms')).getByRole('button', { name: 'Save price & payment terms' }))
    expect(await within(section('payment_terms')).findByText('The payment milestones must add up to exactly 100 %.')).toBeInTheDocument()
  })
})

describe('missing-required links', () => {
  it('lists what is missing as links that focus the field', async () => {
    const user = userEvent.setup()
    renderEditor()
    const list = screen.getByTestId('missing-required')
    await user.click(within(list).getByRole('button', { name: 'The DISCOM' }))
    expect(document.activeElement?.id).toBe('doc-field-connection-discom')
  })
  it('a 409 from approve / send replaces the list', () => {
    renderEditor({ serverMissing: [{ field: 'site.town', message: 'the town' }] })
    expect(within(screen.getByTestId('missing-required')).getByRole('button', { name: 'The town' })).toBeInTheDocument()
  })
})

describe('live preview', () => {
  it('phones get “Open preview” and fetch nothing until asked', async () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /Open preview/ })).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, PREVIEW_DEBOUNCE_MS + 50))
    expect(mockPreview).not.toHaveBeenCalled()
  })

  it('desktop renders the saved draft in a frame, refreshes after a save, and revokes the old blob', async () => {
    setInline(true)
    mockEdit.mockImplementation(async () => {
      const res = editResponse({ revision: 4 })
      mockView = res
      return res
    })
    const user = userEvent.setup()
    renderEditor()
    await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(1), { timeout: 2000 })
    expect(await screen.findByTitle(/Draft preview of proposal 12/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Download/ })).toHaveAttribute('download', 'proposal-12-draft.pdf')
    await user.type(screen.getByLabelText('DISCOM'), 'W')
    await user.click(within(section('connection')).getByRole('button', { name: 'Save electricity connection' }))
    await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(2), { timeout: 2000 })
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalled())
  })

  it('429 shows a short “try again in a few seconds” countdown', async () => {
    setInline(true)
    mockPreview.mockRejectedValue(docError(429, { code: 'rate_limited', message: 'x' }, 3))
    renderEditor()
    expect(await screen.findByText(/Too many previews in a minute — trying again in 3 s/, undefined, { timeout: 2000 })).toBeInTheDocument()
  })

  it('a refused preview is not retried in a loop (re-renders do not re-fetch)', async () => {
    setInline(true)
    mockPreview.mockRejectedValue(docError(409, { code: 'missing_required', message: 'x', missing: [{ field: 'price', message: 'the price' }] }))
    renderEditor()
    await screen.findByText('The preview appears once the proposal has a price.', undefined, { timeout: 2000 })
    await new Promise((r) => setTimeout(r, PREVIEW_DEBOUNCE_MS * 3))
    expect(mockPreview).toHaveBeenCalledTimes(1)
  })

  it('409 missing_required (no price yet) says the preview needs a price', async () => {
    setInline(true)
    mockPreview.mockRejectedValue(docError(409, { code: 'missing_required', message: 'x', missing: [{ field: 'price', message: 'the price' }] }))
    renderEditor()
    expect(await screen.findByText('The preview appears once the proposal has a price.', undefined, { timeout: 2000 })).toBeInTheDocument()
  })
})

describe('locked after approval', () => {
  it('shows the reference and date, a locked banner with the revision action, and no edit controls', () => {
    mockView = documentView({ locked: true, editable_sections: [], status: 'approved', document_reference: 'GN/23/10/2026/01', document_date: '2026-10-23', missing_required: [] })
    renderEditor({ revisionAction: <button type="button">Request Revision</button> })
    expect(screen.getByTestId('locked-banner')).toHaveTextContent('approved and locked')
    expect(within(screen.getByTestId('locked-banner')).getByRole('button', { name: 'Request Revision' })).toBeInTheDocument()
    expect(screen.getByTestId('document-reference')).toHaveTextContent('GN/23/10/2026/01')
    expect(document.querySelectorAll('[data-editable="true"]')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /Adjust Price/ })).not.toBeInTheDocument()
  })
})

describe('Adjust Price entry point', () => {
  it('appears in the price card only when the page passes it', async () => {
    const onAdjust = vi.fn()
    const user = userEvent.setup()
    const { unmount } = renderEditor({ onAdjustPrice: onAdjust })
    await user.click(within(screen.getByTestId('price-summary')).getByRole('button', { name: /Adjust Price/ }))
    expect(onAdjust).toHaveBeenCalled()
    unmount()
    renderEditor()
    expect(within(screen.getByTestId('price-summary')).queryByRole('button', { name: /Adjust Price/ })).not.toBeInTheDocument()
  })
})

// Kept last: fake timers.
describe('timers', () => {
  it('debounces the first render', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    setInline(true)
    renderEditor()
    expect(mockPreview).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10)
    })
    expect(mockPreview).toHaveBeenCalledTimes(1)
  })
})
