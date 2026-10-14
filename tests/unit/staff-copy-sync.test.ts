import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pickStaffCopy, pickStaffLeadsCopy } from '../../scripts/extract-staff-copy.mjs'
import generated from '@/lib/dashboard/staff-copy.generated.json'
import leadsGenerated from '@/lib/dashboard/staff-leads-copy.generated.json'
import en from '@/messages/en.json'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'

describe('staff dashboard copy subset (L7)', () => {
  it('equals the live subset of messages/en.json — run `npm run staff-copy` if this fails', () => {
    expect(generated).toEqual(pickStaffCopy(en))
  })

  it('the translated Leads copy (en, hi, bn) equals the live staffLeads namespaces — run `npm run staff-copy` if this fails', () => {
    expect(leadsGenerated).toEqual(pickStaffLeadsCopy(en, hi, bn))
  })

  it('the Leads copy is a small fraction of the message files', () => {
    const root = path.resolve(__dirname, '../..')
    const full = readFileSync(path.join(root, 'messages/en.json')).length
    const leads = readFileSync(path.join(root, 'lib/dashboard/staff-leads-copy.generated.json')).length
    expect(leads).toBeLessThan(full / 4)
  })

  it('is much smaller than the full English file (it is what keeps en.json out of the dashboard bundle)', () => {
    const root = path.resolve(__dirname, '../..')
    const full = readFileSync(path.join(root, 'messages/en.json')).length
    const subset = readFileSync(path.join(root, 'lib/dashboard/staff-copy.generated.json')).length
    expect(subset).toBeLessThan(full / 3)
  })

  it('no dashboard / staff module imports messages/en.json directly', () => {
    const files = [
      'lib/dashboard/staff-copy.ts',
      'components/dashboard/SiteLocationStaff.tsx',
      'lib/dashboard/payment-ui.ts',
      'lib/dashboard/execution-errors.ts',
      'components/dashboard/StaffPaymentsSection.tsx',
      'components/dashboard/StaffRecordPayment.tsx',
      'components/dashboard/ExecutionDetailPanel.tsx',
    ]
    for (const f of files) {
      expect(readFileSync(path.resolve(__dirname, '../..', f), 'utf8'), f).not.toMatch(/from\s+['"][^'"]*messages\/en\.json['"]/)
    }
  })
})
