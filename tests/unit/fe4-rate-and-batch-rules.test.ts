import { describe, it, expect } from 'vitest'
import { effectiveFromProblem, formatRate, isValidRate, rateKeyLabel } from '@/lib/commissions/rates'
import { approvalMode, canDownloadBankFile, payableLines } from '@/lib/commissions/batch-rules'
import { commissionErrorMessage, isApprovable, isReversible } from '@/lib/commissions/labels'
import { formatInr, isNegativeAmount, isPositiveAmount } from '@/lib/money'
import { ApiError } from '@/lib/dashboard/api-error'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { STAFF_LINE } from './fixtures/commissions-contract'

describe('rates', () => {
  it('accepts 0–100 with at most 4 decimals and nothing else', () => {
    for (const ok of ['0', '5', '2.5', '12.3456', '100', '100.0000', '0.0001']) expect(isValidRate(ok), ok).toBe(true)
    for (const bad of ['', 'abc', '-1', '100.0001', '101', '1.23456', '1,5', '5%', '.5', '1e2']) expect(isValidRate(bad), bad).toBe(false)
  })

  it('formats a rate by trimming zeros of the string, never through a number', () => {
    expect(formatRate('5.0000')).toBe('5%')
    expect(formatRate('2.5000')).toBe('2.5%')
    expect(formatRate('12.3456')).toBe('12.3456%')
    expect(formatRate('100')).toBe('100%')
    expect(formatRate(null)).toBe('—')
  })

  it('labels the contract’s rate keys readably', () => {
    expect(rateKeyLabel('personal_sale.preferred_associate.state_head')).toBe('Personal sale · Preferred Associate · State Head')
    expect(rateKeyLabel('territory_block')).toBe('Territory — block')
    expect(rateKeyLabel('brand_new.key')).toBe('brand new · key')
  })
})

describe('notice rule (contract: today IST + 15 days for a real schedule, not in the past for a placeholder)', () => {
  const base = { earliestEffectiveFrom: '2026-10-29', todayIst: '2026-10-14' }
  it('refuses a real schedule that starts before the earliest date', () => {
    expect(effectiveFromProblem({ ...base, effectiveFrom: '2026-10-28', isPlaceholder: false })).toBe('notice_period')
    expect(effectiveFromProblem({ ...base, effectiveFrom: '2026-10-14', isPlaceholder: false })).toBe('notice_period')
  })
  it('accepts a real schedule on or after the earliest date', () => {
    expect(effectiveFromProblem({ ...base, effectiveFrom: '2026-10-29', isPlaceholder: false })).toBeNull()
    expect(effectiveFromProblem({ ...base, effectiveFrom: '2027-01-01', isPlaceholder: false })).toBeNull()
  })
  it('lets a placeholder start today but not in the past', () => {
    expect(effectiveFromProblem({ ...base, effectiveFrom: '2026-10-14', isPlaceholder: true })).toBeNull()
    expect(effectiveFromProblem({ ...base, effectiveFrom: '2026-10-13', isPlaceholder: true })).toBe('effective_in_past')
  })
  it('needs a date', () => {
    expect(effectiveFromProblem({ ...base, effectiveFrom: '', isPlaceholder: false })).toBe('required')
  })
})

describe('approver ≠ preparer', () => {
  const draft = { status: 'draft', preparedBy: 'EMP-1' }
  it('Accounts who prepared the batch cannot approve it', () => {
    expect(approvalMode({ ...draft, role: 'accounts', employeeId: 'EMP-1' })).toBe('preparer-blocked')
  })
  it('a different Accounts user can approve', () => {
    expect(approvalMode({ ...draft, role: 'accounts', employeeId: 'EMP-2' })).toBe('approve')
  })
  it('an Admin who prepared it may only approve with a reason (override)', () => {
    expect(approvalMode({ ...draft, role: 'admin', employeeId: 'EMP-1' })).toBe('override')
    expect(approvalMode({ ...draft, role: 'admin', employeeId: 'EMP-9' })).toBe('approve')
  })
  it('Management never approves; nothing to approve once it is not a draft', () => {
    expect(approvalMode({ ...draft, role: 'management', employeeId: 'EMP-2' })).toBe('none')
    expect(approvalMode({ status: 'approved', preparedBy: 'EMP-1', role: 'accounts', employeeId: 'EMP-2' })).toBe('none')
  })
  it('does not guess until it knows who is signed in', () => {
    expect(approvalMode({ ...draft, role: 'accounts', employeeId: undefined })).toBe('loading')
  })
})

describe('bank file', () => {
  it('Accounts only — an Admin is refused by the server, so the control is not shown', () => {
    expect(canDownloadBankFile('accounts', 'approved')).toBe(true)
    expect(canDownloadBankFile('accounts', 'paid')).toBe(true)
    expect(canDownloadBankFile('admin', 'approved')).toBe(false)
    expect(canDownloadBankFile('management', 'approved')).toBe(false)
    expect(canDownloadBankFile('accounts', 'draft')).toBe(false)
  })
})

describe('money is read from the string, never added or compared as a float', () => {
  it('payable lines are those whose net is strictly positive', () => {
    const lines = [STAFF_LINE, { ...STAFF_LINE, net: '0.00' }, { ...STAFF_LINE, net: '-5.00' }, { ...STAFF_LINE, net: '0.01' }]
    expect(payableLines(lines).map((l) => l.net)).toEqual(['24254.61', '0.01'])
  })
  it('sign tests do not lose precision on a 20-digit amount', () => {
    expect(isNegativeAmount('-99999999999999999999.99')).toBe(true)
    expect(isPositiveAmount('0.00000000000000000001')).toBe(true)
    expect(isNegativeAmount('-0.00')).toBe(false)
    expect(isNegativeAmount(null)).toBe(false)
    expect(isPositiveAmount('abc')).toBe(false)
  })
  it('the classic float trap stays exact because nothing is summed', () => {
    expect(formatInr('0.30')).toBe('₹0.30')
    expect(formatInr('-1000.00')).toBe('-₹1,000.00')
  })
})

describe('entry helpers', () => {
  it('only a rated, still-earned earning can be approved', () => {
    expect(isApprovable({ kind: 'earn', status: 'earned', amount: '10.00' })).toBe(true)
    expect(isApprovable({ kind: 'earn', status: 'earned', amount: null })).toBe(false)
    expect(isApprovable({ kind: 'earn', status: 'approved', amount: '10.00' })).toBe(false)
    expect(isApprovable({ kind: 'reversal', status: 'earned', amount: '-10.00' })).toBe(false)
  })
  it('only an unreversed earning can be reversed', () => {
    expect(isReversible({ kind: 'earn', status: 'paid', reversed_by_entry_id: null })).toBe(true)
    expect(isReversible({ kind: 'earn', status: 'reversed', reversed_by_entry_id: 9 })).toBe(false)
    expect(isReversible({ kind: 'recovery', status: 'approved' })).toBe(false)
  })
})

describe('commissionErrorMessage', () => {
  const err = (status: number, detail: string, d?: Record<string, unknown>) => new ApiError(status, 'x', detail, d)
  it('explains placeholder_rates with the count', () => {
    expect(commissionErrorMessage(err(409, 'x', { code: 'placeholder_rates', pending_entries: 7 }))).toMatch(/7 entries .* no amount/)
  })
  it('lists why entries were not approvable', () => {
    const m = commissionErrorMessage(err(409, 'x', { code: 'entries_not_approvable', entries: [{ entry_id: 3, reason: 'not_rated' }, { entry_id: 4, reason: 'not_earned' }] }))
    expect(m).toContain('#3 has no rate yet')
    expect(m).toContain('#4 is not in the Earned state')
  })
  it('never renders an object', () => {
    expect(commissionErrorMessage(err(422, 'x', { fieldErrors: [{ loc: ['body'], msg: 'bad' }] }))).not.toMatch(/object|\{/)
    expect(commissionErrorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.')
    expect(commissionErrorMessage(err(0, 'Network request failed'))).toMatch(/reach the server/)
  })
})

describe('no float arithmetic on money anywhere in the FE-4 money code', () => {
  const root = path.resolve(__dirname, '../..')
  const files = [
    'lib/commissions/rates.ts',
    'lib/commissions/batch-rules.ts',
    'lib/commissions/labels.ts',
    'lib/commissions/network.ts',
    'lib/money.ts',
    'components/associate/PortalEarnings.tsx',
    'components/dashboard/commissions/CommissionEntries.tsx',
    'components/dashboard/commissions/PayoutBatchDetail.tsx',
    'components/dashboard/commissions/PayoutBatches.tsx',
    'components/dashboard/commissions/RateSchedules.tsx',
    'components/dashboard/commissions/CommissionQueries.tsx',
    'components/dashboard/NetworkCommandCentre.tsx',
  ]
  it.each(files)('%s never parses or sums an amount as a float', (file) => {
    const src = readFileSync(path.join(root, file), 'utf8')
    // parseFloat / toFixed / Number(<money>) / reduce-sums are how a decimal string would turn into a float.
    expect(src).not.toMatch(/parseFloat\(|\.toFixed\(|Number\((?:[^)]*\b(?:amount|net|gross|tds|total|earned|approved|paid|credits|reversals|recoveries|taxable)\b)/i)
    expect(src).not.toMatch(/\.reduce\([^)]*\b(?:amount|net|gross|tds|total)\b/i)
  })
})
