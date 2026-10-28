import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import en from '@/messages/en.json'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import { formatInr, formatGrouped } from '@/lib/money'

// FE-19 item 2: every associate-facing string exists, filled, in Hindi and Bengali. A key
// added to en.json without its hi / bn sentence fails here.

// The namespaces the associate journey reads: careers and applying, the portals, the verify
// page, and the shared photo / location / survey / date / error wording.
const ASSOCIATE_FACING = ['careers', 'associates', 'portalErrors', 'portalFeedback', 'photoSlot', 'siteLocation', 'pricing', 'survey', 'portalEase', 'dateField', 'proposalVerify'] as const

function leaves(o: unknown, p = ''): Record<string, unknown> {
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    return Object.assign({}, ...Object.entries(o).map(([k, v]) => leaves(v, p ? `${p}.${k}` : k)))
  }
  if (Array.isArray(o)) return Object.assign({}, ...o.map((v, i) => leaves(v, `${p}[${i}]`)))
  return { [p]: o }
}

describe.each([
  ['hi', hi],
  ['bn', bn],
] as const)('%s', (_lang, messages) => {
  it.each(ASSOCIATE_FACING)('%s: no key missing, none empty', (ns) => {
    const e = leaves((en as Record<string, unknown>)[ns])
    const t = leaves((messages as Record<string, unknown>)[ns])
    const missing = Object.keys(e).filter((k) => !(k in t))
    const empty = Object.keys(e).filter((k) => typeof e[k] === 'string' && (e[k] as string).trim() !== '' && typeof t[k] === 'string' && !(t[k] as string).trim())
    expect(missing).toEqual([])
    expect(empty).toEqual([])
  })

  it('no portal sentence was left in English', () => {
    const e = leaves({ portalFeedback: en.portalFeedback, fieldErrors: en.associates.wizard.fieldErrors, verify: en.associates.verify })
    const t = leaves({ portalFeedback: messages.portalFeedback, fieldErrors: messages.associates.wizard.fieldErrors, verify: messages.associates.verify })
    const same = Object.keys(e).filter((k) => typeof e[k] === 'string' && /[a-z]{3,} [a-z]{3,}/.test(e[k] as string) && t[k] === e[k])
    expect(same).toEqual([])
  })
})

describe('the portals are given the portal’s error wording', () => {
  it.each(['associates', 'preferred'])('%s layout provides portalFeedback', (p) => {
    const src = readFileSync(path.join(__dirname, `../../app/(site)/[lang]/${p}/layout.tsx`), 'utf8')
    expect(src).toContain('portalFeedback: m.portalFeedback')
  })
})

describe('amounts use Indian grouping in every language', () => {
  it('lakh / crore grouping, Latin digits, no rounding', () => {
    expect(formatInr('12345678.90')).toBe('₹1,23,45,678.90')
    expect(formatInr('100000.00')).toBe('₹1,00,000.00')
    expect(formatGrouped('132492')).toBe('1,32,492')
  })
})

describe('no two questions on one wizard step share a name (FE-19 phone pass)', () => {
  it.each([
    ['en', en],
    ['hi', hi],
    ['bn', bn],
  ] as const)('%s: the connection step’s site type and the survey’s kind of building differ', (_l, m) => {
    expect(m.survey.connection.variantLabel).not.toBe(m.associates.portal.wizard.connection.siteTypeLabel)
  })
})
