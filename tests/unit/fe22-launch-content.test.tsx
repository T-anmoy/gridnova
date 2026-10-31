// FE-22 (BE-22 launch content): an Admin reads each drafted text and approves it exactly as written
// on the Launch readiness; the holds it lifts are explained in plain words; the contract the screens
// rely on (routes, bodies, codes) is the one docs/api/launch_content.md publishes.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DataChecklistPage from '@/app/(internal)/dashboard/data-checklist/page'
import { ApiError } from '@/lib/dashboard/api-error'
import { approveError, revokeError, wordingAwaitingApproval } from '@/lib/dashboard/placeholders'
import { heldReasonText, isDummyReason, isWordingHold } from '@/lib/dashboard/payment-ui'
import { SEND_HOLD_CODES } from '@/lib/dashboard/types'
import { studioError } from '@/lib/studio/logic'
import { loadOpenApi, requestSchema, validate } from './helpers/openapi'
import { withI18n } from './helpers/i18n'
import type { PlaceholderItem, PlaceholdersResponse } from '@/lib/dashboard/placeholders-api-client'
import en from '@/messages/en.json'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'

const h = vi.hoisted(() => ({
  role: 'admin' as string,
  state: {} as { data?: unknown },
  approve: vi.fn(),
  revoke: vi.fn(),
}))
vi.mock('@/lib/access/use-permissions', async () => {
  const { permissionsValue } = await import('./helpers/permissions-bridge')
  return { usePermissions: () => permissionsValue([h.role as never]) }
})
vi.mock('@/lib/dashboard/placeholders-api-client', () => ({
  usePlaceholders: () => ({ ...h.state, refetch: vi.fn() }),
  useResolvePlaceholder: () => ({ mutateAsync: vi.fn() }),
  useApproveWording: () => ({ mutateAsync: h.approve }),
  useRevokeWording: () => ({ mutateAsync: h.revoke }),
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 't' }), useClerk: () => ({ signOut: vi.fn() }) }))

const SHA = 'a'.repeat(64)
const OLD_SHA = 'b'.repeat(64)

const wording = (over: Partial<PlaceholderItem>): PlaceholderItem => ({
  id: 'PRO-7',
  area: 'proposals',
  location: 'config/proposal_content.yaml → sections_library.utility_scale_scope',
  description: 'Ground-mounted scope',
  dummy_value: '',
  needed_from_grid_nova: 'Approve the ground-mounted scope text in the dashboard.',
  blocking: 'blocks_launch',
  probe: 'approved_text',
  resolved: false,
  probe_error: null,
  resolution: null,
  legal_review_required: false,
  current_text: 'Grid Nova designs, supplies and installs the ground-mounted plant.\nSecond paragraph.',
  current_sha256: SHA,
  approval: null,
  approval_state: 'not_approved',
  ...over,
})

const data = (items: PlaceholderItem[]): PlaceholdersResponse => ({
  summary: { total: items.length, unresolved: items.filter((i) => !i.resolved).length, by_blocking: {} },
  areas: [{ area: 'proposals', items }],
})

const terms = wording({ id: 'PRO-2', description: 'Proposal terms and conditions', legal_review_required: true, current_text: 'Terms and conditions.' })
const approved = wording({
  id: 'P6', description: 'Receipt wording', resolved: true, approval_state: 'approved', current_text: 'heading: PAYMENT RECEIPT\nfooter: Thank you.',
  approval: { by: 'admin@gridnova.in', at: '2026-11-01T05:00:00Z', note: 'Read with the owner', legal_review_confirmed: false, content_sha256: SHA },
})
const lapsed = wording({
  id: 'HW-OM', description: 'O&M after the free first year', approval_state: 'lapsed',
  approval: { by: 'admin@gridnova.in', at: '2026-11-01T05:00:00Z', note: null, legal_review_confirmed: false, content_sha256: OLD_SHA },
})

beforeEach(() => {
  h.role = 'admin'
  h.state = { data: data([wording({}), terms, approved, lapsed]) }
  h.approve.mockReset().mockResolvedValue({})
  h.revoke.mockReset().mockResolvedValue({})
})

const row = (id: string) => screen.getAllByTestId('checklist-item').find((li) => within(li).queryByText(id))!

async function showAll(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Unresolved only' }))
}

describe('Launch readiness — drafted wording (BE-22)', () => {
  it('says how many texts wait for approval, and that documents printing them are held', () => {
    render(withI18n(<DataChecklistPage />))
    const banner = screen.getByTestId('wording-awaiting')
    expect(banner).toHaveTextContent('3 drafted texts waiting for an Admin to approve')
    expect(banner).toHaveTextContent('PRO-7, PRO-2, HW-OM')
    expect(banner).toHaveTextContent('held — never sent')
  })

  it('shows each text’s state: not approved, changed since approval, approved', async () => {
    const user = userEvent.setup()
    render(withI18n(<DataChecklistPage />))
    await showAll(user)
    expect(within(row('PRO-7')).getByTestId('approval-state')).toHaveTextContent('Wording not approved')
    expect(within(row('HW-OM')).getByTestId('approval-state')).toHaveTextContent('Changed since approval')
    expect(row('HW-OM')).toHaveTextContent('The text has changed since')
    expect(within(row('P6')).getByTestId('approval-state')).toHaveTextContent('Wording approved')
    expect(row('P6')).toHaveTextContent('Approved by admin@gridnova.in')
    expect(within(row('PRO-2')).getByText('Legal review needed')).toBeInTheDocument()
    expect(within(row('PRO-7')).queryByTestId('dummy-chip')).toBeNull()
  })

  it('an Admin reads the whole text and approves exactly that version (its hash)', async () => {
    const user = userEvent.setup()
    render(withI18n(<DataChecklistPage />))
    await user.click(within(row('PRO-7')).getByRole('button', { name: 'Read and approve…' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByTestId('wording-text').textContent).toBe(wording({}).current_text)
    expect(dialog).toHaveTextContent(SHA.slice(0, 12))
    expect(within(dialog).queryByTestId('legal-tick')).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Approve this text' }))
    expect(h.approve).toHaveBeenCalledWith({ id: 'PRO-7', content_sha256: SHA, note: undefined, legal_review_confirmed: false })
  })

  it('the terms need the legal-review tick before Approve works', async () => {
    const user = userEvent.setup()
    render(withI18n(<DataChecklistPage />))
    await user.click(within(row('PRO-2')).getByRole('button', { name: 'Read and approve…' }))
    const dialog = screen.getByRole('dialog')
    const go = within(dialog).getByRole('button', { name: 'Approve this text' })
    expect(go).toBeDisabled()
    await user.click(within(dialog).getByTestId('legal-tick'))
    await user.type(within(dialog).getByLabelText(/Note/), 'Lawyer read it on 1 Nov')
    await user.click(go)
    expect(h.approve).toHaveBeenCalledWith({ id: 'PRO-2', content_sha256: SHA, note: 'Lawyer read it on 1 Nov', legal_review_confirmed: true })
  })

  it('a text edited meanwhile is refused in plain words', async () => {
    h.approve.mockRejectedValueOnce(new ApiError(409, 'x', 'x', { code: 'text_changed', current_sha256: OLD_SHA }))
    const user = userEvent.setup()
    render(withI18n(<DataChecklistPage />))
    await user.click(within(row('PRO-7')).getByRole('button', { name: 'Read and approve…' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Approve this text' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The text changed while you were reading it')
  })

  it('after approving, the next step is named (HW-OM: send the handover link again)', async () => {
    const user = userEvent.setup()
    render(withI18n(<DataChecklistPage />))
    await user.click(within(row('HW-OM')).getByRole('button', { name: 'Read and approve again…' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve this text' }))
    expect(await screen.findByTestId('approved-notice')).toHaveTextContent('HW-OM approved. Handover packs that were waiting go out when staff send the handover link again.')
  })

  it('a lapsed text says who approved the earlier version and is approved again', async () => {
    const user = userEvent.setup()
    render(withI18n(<DataChecklistPage />))
    await user.click(within(row('HW-OM')).getByRole('button', { name: 'Read and approve again…' }))
    expect(screen.getByTestId('lapsed-note')).toHaveTextContent('admin@gridnova.in approved an earlier version')
  })

  it('revoking needs a reason and sends it', async () => {
    const user = userEvent.setup()
    render(withI18n(<DataChecklistPage />))
    await showAll(user)
    await user.click(within(row('P6')).getByRole('button', { name: 'Revoke…' }))
    const dialog = screen.getByRole('dialog')
    const go = within(dialog).getByRole('button', { name: 'Revoke approval' })
    expect(go).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Why/), 'Bank changed')
    await user.click(go)
    expect(h.revoke).toHaveBeenCalledWith({ id: 'P6', note: 'Bank changed' })
  })

  it('Management can read a draft but cannot approve or revoke', async () => {
    h.role = 'management'
    const user = userEvent.setup()
    render(withI18n(<DataChecklistPage />))
    expect(screen.getByTestId('wording-awaiting')).toHaveTextContent('Only an Admin can approve them.')
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull()
    await showAll(user)
    expect(screen.queryByRole('button', { name: 'Revoke…' })).toBeNull()
    await user.click(within(row('PRO-7')).getByRole('button', { name: 'Read' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Not approved yet')
    expect(within(dialog).queryByRole('button', { name: 'Approve this text' })).toBeNull()
  })
})

describe('wording helpers', () => {
  it('counts never-approved and lapsed texts, not approved ones or other entries', () => {
    const other = wording({ id: 'CMP-1', probe: 'yaml_contains_marker', approval_state: null })
    expect(wordingAwaitingApproval(data([wording({}), approved, lapsed, other])).map((i) => i.id)).toEqual(['PRO-7', 'HW-OM'])
  })

  it('every approve / revoke code has its own sentence', () => {
    for (const code of ['text_changed', 'legal_review_required', 'still_placeholder', 'not_approved_text', 'rate_limited']) {
      expect(approveError(new ApiError(409, 'x', 'x', { code })), code).not.toMatch(/Something went wrong/)
    }
    expect(revokeError(new ApiError(409, 'x', 'x', { code: 'not_approved' }))).toMatch(/nothing to revoke/)
  })

  it('a receipt held for its wording reads in words, and is not mistaken for dummy details', () => {
    expect(isWordingHold('wording_not_approved')).toBe(true)
    expect(isDummyReason('wording_not_approved')).toBe(false)
    expect(heldReasonText('wording_not_approved')).toBe('Held until the receipt wording is approved.')
    expect(heldReasonText('placeholder_content')).toBe('placeholder_content')
  })

  it('Studio’s content_not_ready points to the approval', () => {
    expect(studioError(new ApiError(409, 'x', 'x', { code: 'content_not_ready' })).message).toMatch(/not yet approved by an Admin/)
  })
})

describe('portal copy (en / hi / bn)', () => {
  const portal = (m: typeof en) => m.associates.portal
  it.each([['hi', hi], ['bn', bn]] as const)('%s has every new string, translated', (_l, m) => {
    const pairs = [
      [portal(m).proposal.acceptance.errors.unapproved_sections, portal(en).proposal.acceptance.errors.unapproved_sections],
      [portal(m).proposal.acceptance.errors.manual_review_required, portal(en).proposal.acceptance.errors.manual_review_required],
      [portal(m).agreement.updatingNote, portal(en).agreement.updatingNote],
      [portal(m).agreement.uploadSigned.errors.agreement_wording_not_approved, portal(en).agreement.uploadSigned.errors.agreement_wording_not_approved],
    ]
    for (const [text, english] of pairs) {
      expect(text).toBeTruthy()
      expect(text).not.toBe(english)
    }
  })
})

describe('BE-22 contract', () => {
  const spec = loadOpenApi()
  const D = '/api/v1/dashboard'
  const root = path.resolve(__dirname, '../..')
  const read = (f: string) => readFileSync(path.join(root, f), 'utf8')

  it('the approve and revoke routes exist and the bodies the screen sends validate', () => {
    const approveBody = requestSchema(spec, `${D}/placeholders/{entry_id}/approve`, 'post')
    expect(approveBody).toBeDefined()
    expect(validate(spec, approveBody!, { content_sha256: SHA, note: 'x', legal_review_confirmed: true })).toEqual([])
    expect(validate(spec, approveBody!, { content_sha256: SHA, legal_review_confirmed: false })).toEqual([])
    const revokeBody = requestSchema(spec, `${D}/placeholders/{entry_id}/revoke`, 'post')
    expect(validate(spec, revokeBody!, { note: 'why' })).toEqual([])
    const client = read('lib/dashboard/placeholders-api-client.ts')
    expect(client).toContain('/approve`')
    expect(client).toContain('/revoke`')
  })

  it('approve and mark-paid take tds_review_acknowledged', () => {
    expect(validate(spec, requestSchema(spec, `${D}/payout-batches/{batch_id}/approve`, 'post')!, { tds_review_acknowledged: true })).toEqual([])
    expect(validate(spec, requestSchema(spec, `${D}/payout-batches/{batch_id}/mark-paid`, 'post')!, { lines: [], tds_review_acknowledged: true })).toEqual([])
  })

  it('every send-hold code and hold reason the screens explain is in launch_content.md', () => {
    const doc = read('docs/api/launch_content.md')
    for (const code of [...SEND_HOLD_CODES, 'agreement_wording_not_approved', 'wording_not_approved', 'tds_review_required', 'text_changed', 'legal_review_required']) {
      expect(doc, code).toContain(code)
    }
  })
})
