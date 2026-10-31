// FE-22b: the gaps closed after FE-22 — in-person hand-over refusals in words, the Admin reminder
// and the Launch readiness badge, the follow-up step after an approval, and who sees what for
// held receipts and the O&M terms after year one.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ApiError } from '@/lib/dashboard/api-error'
import { inPersonHold, wordingSectionName } from '@/lib/dashboard/launch-wording'
import { approvalNotice } from '@/lib/dashboard/placeholders'
import { heldReasonText } from '@/lib/dashboard/payment-ui'
import type { PlaceholderItem, PlaceholdersResponse } from '@/lib/dashboard/placeholders-api-client'
import en from '@/messages/en.json'

const h = vi.hoisted(() => ({
  role: 'admin' as string,
  data: undefined as unknown,
  enabledCalls: [] as (boolean | undefined)[],
}))
vi.mock('@/lib/access/use-permissions', async () => {
  const { permissionsValue } = await import('./helpers/permissions-bridge')
  return { usePermissions: () => permissionsValue([h.role as never]) }
})
vi.mock('@/lib/dashboard/placeholders-api-client', () => ({
  usePlaceholders: (o: { enabled?: boolean } = {}) => {
    h.enabledCalls.push(o.enabled)
    return { data: o.enabled === false ? undefined : h.data }
  },
}))

import WordingReminder from '@/components/dashboard/WordingReminder'

const item = (id: string, state: 'approved' | 'not_approved' | 'lapsed'): PlaceholderItem => ({
  id, area: 'proposals', location: 'x', description: id, dummy_value: '', needed_from_grid_nova: '', blocking: 'blocks_launch',
  probe: 'approved_text', resolved: state === 'approved', probe_error: null, resolution: null, approval_state: state,
  current_text: 'text', current_sha256: 'a'.repeat(64), legal_review_required: false, approval: null,
})
const NINE = ['PRO-2', 'PRO-7', 'PRO-8', 'PRO-10', 'PRO-11', 'PRO-12', 'ONB-5', 'P6', 'HW-OM']
const data = (states: Record<string, 'approved' | 'not_approved' | 'lapsed'>): PlaceholdersResponse => ({
  summary: { total: 9, unresolved: 0, by_blocking: {} },
  areas: [{ area: 'proposals', items: NINE.map((id) => item(id, states[id] ?? 'approved')) }],
})

const RAW_CODE = /unapproved_sections|manual_review_required|placeholder_content|missing_total_value|approved_text/

beforeEach(() => {
  h.role = 'admin'
  h.data = data({ 'PRO-2': 'not_approved', 'HW-OM': 'lapsed' })
  h.enabledCalls = []
})

describe('in-person hand-over refusals (item 1)', () => {
  const err = (detail: Record<string, unknown>) => new ApiError(409, 'x', 'x', detail)

  it('unapproved wording names the sections in words, never their codes', () => {
    const hold = inPersonHold(err({ code: 'unapproved_sections', unapproved_sections: ['standard_terms', 'utility_scale_scope'] }), 100000)!
    expect(hold.message).toBe('This proposal can’t be handed over yet. The wording for Terms and conditions (PRO-2) and Ground-mounted scope (PRO-7) is waiting for an Admin’s approval.')
    expect(hold.approvalPending).toBe(true)
    expect(hold.message).not.toMatch(RAW_CODE)
    expect(hold.message).not.toMatch(/standard_terms|utility_scale_scope/)
  })

  it('the generic-scope review and a missing price have their own sentences', () => {
    expect(inPersonHold(err({ code: 'manual_review_required' }), 1)!.message).toBe('This proposal needs a staff check before it goes out.')
    expect(inPersonHold(err({ code: 'placeholder_content' }), null)!.message).toBe('Price to be set by Grid Nova.')
    expect(inPersonHold(err({ code: 'placeholder_content' }), 5)!.message).not.toMatch(RAW_CODE)
    expect(inPersonHold(err({ code: 'expired' }), 5)).toBeNull()
    expect(inPersonHold(new Error('x'), 5)).toBeNull()
  })

  it('an unknown section id is made readable', () => {
    expect(wordingSectionName('some_new_note')).toBe('Some New Note')
  })

  it('associates get plain portal sentences, no codes or approval detail', () => {
    const errors = en.associates.portal.proposal.acceptance.errors
    for (const text of [errors.unapproved_sections, errors.manual_review_required, errors.price_to_be_set]) {
      expect(text).not.toMatch(RAW_CODE)
      expect(text).not.toMatch(/Admin|approv/i)
    }
    expect(errors.price_to_be_set).toBe('Price to be set by Grid Nova.')
  })
})

describe('Admin reminder on the home page (item 2)', () => {
  it('an Admin sees how many wordings wait, with a link to Launch readiness', () => {
    render(<WordingReminder />)
    const card = screen.getByTestId('wording-reminder')
    expect(card).toHaveTextContent('2 wordings are waiting for your approval')
    expect(screen.getByRole('link', { name: 'Open Launch readiness' })).toHaveAttribute('href', '/dashboard/data-checklist')
  })

  it('says it in the singular for one', () => {
    h.data = data({ P6: 'not_approved' })
    render(<WordingReminder />)
    expect(screen.getByTestId('wording-reminder')).toHaveTextContent('1 wording is waiting for your approval')
  })

  it('Management (who cannot approve) gets no card and makes no request', () => {
    h.role = 'management'
    render(<WordingReminder />)
    expect(screen.queryByTestId('wording-reminder')).toBeNull()
    expect(h.enabledCalls).toEqual([false])
  })

  it('disappears once all nine are approved', () => {
    h.data = data({})
    render(<WordingReminder />)
    expect(screen.queryByTestId('wording-reminder')).toBeNull()
  })
})

describe('after an approval (item 3)', () => {
  it.each([
    ['P6', 'Receipts that were waiting can now be released: Accounts → Receipts → Release held receipts.'],
    ['HW-OM', 'Handover packs that were waiting go out when staff send the handover link again.'],
    ['ONB-5', 'Agreements printed from older wording must be generated again.'],
  ])('%s names the next step', (id, hint) => {
    expect(approvalNotice(id)).toBe(`${id} approved. ${hint}`)
  })
  it('other texts just confirm', () => {
    expect(approvalNotice('PRO-7')).toBe('PRO-7 approved.')
  })
})

describe('who sees what (item 4)', () => {
  it('Accounts read the receipt hold plainly; associates are told only that it is being prepared', () => {
    expect(heldReasonText('wording_not_approved')).toBe('Held until the receipt wording is approved.')
    expect(en.associates.portal.payments.receiptPending).toBe('Receipt is being prepared')
  })
  it('missing O&M terms read as a promise of details, never as wording or approval', () => {
    const portalCopy = JSON.stringify(en).match(/"omAfterPending":\s*"([^"]+)"/)![1]
    expect(portalCopy).toBe('Details will be shared by Grid Nova.')
  })
})
