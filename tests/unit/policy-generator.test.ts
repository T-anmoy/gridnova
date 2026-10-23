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
    expect(() => parseDraft(`${md}\n## UNKNOWN HEADING\n`)).toThrow(/Unrecognised top-level heading/)
  })
})

describe('published policy set', () => {
  const { policies, notices } = generate() as {
    policies: { documents: Record<string, unknown>; pendingItems: unknown }
    notices: { notices: Record<string, unknown> }
  }

  it('has no [bracketed] placeholders left in the policies or notices', () => {
    const text = JSON.stringify([policies.documents, notices.notices])
    expect(text.match(/\[[^\][\\"]+\]/g) ?? []).toEqual([])
  })

  it('has no pending-items table in the source, and pendingItems is null', () => {
    const md = readFileSync(path.resolve(root, 'content/policies/GridNova_Policies_Draft_v1.md'), 'utf8')
    expect(md).not.toMatch(/ITEMS FOR GRID NOVA TO CONFIRM/)
    expect(policies.pendingItems).toBeNull()
  })
})
