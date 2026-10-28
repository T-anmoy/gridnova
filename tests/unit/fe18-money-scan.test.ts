// FE-18: the browser never calculates money. Every amount, GST, total, word form, milestone,
// subsidy and saving on a Studio screen comes from the API's `figures`; the screens only
// format it. This scan fails on any number-making or arithmetic that touches an amount in the
// Studio's code (the staff screens, the customer's page and the verification page).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const SCANNED = [
  'components/dashboard/studio',
  'lib/studio',
  'app/(internal)/dashboard/studio',
  'app/(internal)/proposal/[token]',
  'components/studio-public',
  'app/(site)/[lang]/verify/p',
]

function files(rel: string): string[] {
  const abs = path.join(root, rel)
  if (statSync(abs).isFile()) return [rel]
  return readdirSync(abs).flatMap((f) => files(path.join(rel, f)))
}

const MONEY = '(?:total|basic|gst|amount|price|discount|subsidy|saving|cost|unit_rate|rate_per_kwp|tariff|bill|payment|effective|taxable|value)'
const RULES: { name: string; re: RegExp }[] = [
  { name: 'parseFloat / parseInt', re: /\bparse(?:Float|Int)\s*\(/ },
  { name: 'a number made from an amount', re: new RegExp(`\\b(?:Number|BigInt|Math\\.\\w+)\\s*\\([^)]*${MONEY}`, 'i') },
  { name: 'unary plus on an amount', re: new RegExp(`(?:^|[^\\w\\s)\\]])\\s*\\+\\s*[\\w.?]*${MONEY}`, 'i') },
  { name: 'arithmetic on an amount', re: new RegExp(`[\\w.?\\]]*${MONEY}\\w*\\]?\\)?\\s*[-*/%]\\s*[\\w(]|[\\w)\\]]\\s*[-*/%]\\s*[\\w.?]*${MONEY}`, 'i') },
  { name: 'adding amounts', re: new RegExp(`[\\w.?\\]]*${MONEY}\\w*\\]?\\)?\\s*\\+\\s*[\\w.(]*${MONEY}|\\.reduce\\(`, 'i') },
  { name: 'toFixed / toPrecision', re: /\.to(?:Fixed|Precision)\(/ },
]

/** Lines that break a rule, ignoring comments, imports, strings in JSX text and CSS classes. */
export function moneyMath(source: string, file: string): string[] {
  return source.split('\n').flatMap((line, i) => {
    const code = line
      .replace(/\/\/.*$/, '')
      .replace(/^\s*(\*|\/\*).*$/, '')
      .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, '""') // string literals (incl. class names and copy)
      // Template literals: the text is dropped, the ${…} expressions are kept and checked.
      .replace(/`[^`]*`/g, (m) => (m.match(/\$\{[^}]*\}/g) ?? []).join(' ') || '""')
    if (/^\s*import\b/.test(code)) return []
    return RULES.filter((r) => r.re.test(code)).map((r) => `${file}:${i + 1}: ${r.name}: ${line.trim()}`)
  })
}

describe('no Studio screen calculates money', () => {
  const sources = SCANNED.flatMap(files).filter((f) => /\.(ts|tsx)$/.test(f))

  it('scans the Studio code (sanity)', () => {
    expect(sources.length).toBeGreaterThan(20)
    expect(sources).toContain('components/dashboard/studio/FiguresSummary.tsx')
    expect(sources).toContain('app/(internal)/proposal/[token]/OnlineProposal.tsx')
  })

  it('finds no arithmetic on amount fields', () => {
    const hits = sources.flatMap((f) => moneyMath(readFileSync(path.join(root, f), 'utf8'), f))
    expect(hits).toEqual([])
  })

  it('the scan really catches money arithmetic (guards the guard)', () => {
    const bad = [
      'const t = parseFloat(view.total)',
      'const gst = Number(figures.basic) * 0.089',
      'const due = payment.amount * 2',
      'const net = figures.total - subsidy.total',
      'const sum = a.amount + b.amount',
      'const all = payments.reduce((s, p) => s + p, 0)',
      'const x = +figures.total',
      'const r = (Number(f.total) / 3).toFixed(2)',
      'const pct = discount_amount / list_basic',
      'const s = `${figures.total * 2}`',
    ]
    for (const b of bad) expect(moneyMath(b, 'x.ts'), b).not.toEqual([])
    const fine = [
      "const label = 'Total incl. GST'",
      '<Money value={figures.total} />',
      'formatInr(view.total)',
      'compareDecimalStrings(a.total, b.total)',
      'const i = stepIndex - 1',
      '{p.percent}% — {p.label}',
    ]
    for (const f of fine) expect(moneyMath(f, 'x.ts'), f).toEqual([])
  })
})
