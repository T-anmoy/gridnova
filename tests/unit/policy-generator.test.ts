import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { generate, parseDraft } from '../../scripts/build-policies.mjs'

const root = path.resolve(__dirname, '../..')
const committed = (name: string) => readFileSync(path.resolve(root, 'content/policies', name), 'utf8')

describe('policy generator (npm run policies)', () => {
  const { policies, notices, text } = generate() as {
    policies: { documents: Record<string, unknown>; pendingItems: { rows: string[][] } }
    notices: { notices: Record<string, unknown> }
    text: Record<string, string>
  }

  it('regenerates policies.en.json from the draft byte for byte', () => {
    expect(text['policies.en.json']).toBe(committed('policies.en.json'))
  })

  it('regenerates notices.en.json from the draft byte for byte', () => {
    expect(text['notices.en.json']).toBe(committed('notices.en.json'))
  })

  it('deep-equals the committed JSON (in memory, no file written)', () => {
    expect(policies).toEqual(JSON.parse(committed('policies.en.json')))
    expect(notices).toEqual(JSON.parse(committed('notices.en.json')))
  })

  it('produces the five public documents and the two notices', () => {
    expect(Object.keys(policies.documents)).toEqual(['privacy', 'terms', 'associate-terms', 'commission-policy', 'payment-policy'])
    expect(Object.keys(notices.notices)).toEqual(['associate-kyc-consent', 'customer-information-notice'])
  })

  it('refuses a draft it cannot place, instead of dropping text', () => {
    const md = readFileSync(path.resolve(root, 'content/policies/GridNova_Policies_Draft_v1.md'), 'utf8')
    expect(() => parseDraft(md.replace('## 7. CUSTOMER INFORMATION NOTICE', '## 9. SOMETHING ELSE'))).toThrow(/no slug mapping/)
    expect(() => parseDraft(md.replace('## ITEMS FOR GRID NOVA TO CONFIRM', '## UNKNOWN HEADING'))).toThrow(/Unrecognised top-level heading/)
  })
})

describe('[bracketed] values vs the draft\'s own "items to confirm" table', () => {
  // How many [bracketed] placeholders each row of the table accounts for. If a
  // placeholder is added to or removed from the draft, this fails until the
  // table (and this list) are updated — so no unconfirmed fact slips through.
  const BRACKETS_PER_ITEM = [1, 1, 5, 1, 1, 1, 2, 2, 1, 2, 4]

  it('every bracket in the policy set is accounted for by a row of the table', () => {
    const { policies, notices } = generate() as {
      policies: { documents: Record<string, unknown>; pendingItems: { rows: string[][] } }
      notices: { notices: Record<string, unknown> }
    }
    const rows = policies.pendingItems.rows
    expect(rows).toHaveLength(BRACKETS_PER_ITEM.length)
    const text = JSON.stringify([policies.documents, notices.notices])
    const found = text.match(/\[[^\][\\"]+\]/g) ?? []
    expect(found).toHaveLength(BRACKETS_PER_ITEM.reduce((a, b) => a + b, 0))
  })
})
