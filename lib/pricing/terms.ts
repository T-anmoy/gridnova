// The commercial terms (warranty, O&M, panel life, payment instalments) come
// from the backend as English sentences ("5 years from handover"). On the hi /
// bn pages they are shown in the visitor's language by recognising the known
// shapes and re-composing them from messages/*.json: only the WORDING is
// translated — every number is taken from the backend's own text, never from a
// copy of it. A term in any other shape is shown exactly as the backend sent
// it (English) rather than guessed at.
import { fmt, type Messages } from '@/lib/i18n/types'

export type TermsCopy = Messages['pricing']['terms']

const norm = (s: string) => s.trim().replace(/\s+/g, ' ')

export function localizeWarranty(text: string, t: TermsCopy): string {
  const m = /^(\d+) years? from handover$/i.exec(norm(text))
  if (!m) return text
  return fmt(m[1] === '1' ? t.warrantyYear : t.warrantyYears, { years: m[1] })
}

export function localizeOandM(text: string, t: TermsCopy): string {
  return /^first year free$/i.test(norm(text)) ? t.firstYearFree : text
}

export function localizeLifeSpan(text: string, t: TermsCopy): string {
  const n = norm(text)
  const range = /^(\d+)\s*[–—-]\s*(\d+) years?$/i.exec(n)
  if (range) return fmt(t.lifeSpanRange, { from: range[1], to: range[2] })
  const single = /^(\d+) years?$/i.exec(n)
  return single ? fmt(t.lifeSpanYears, { years: single[1] }) : text
}

const MILESTONE_KEYS: Record<string, keyof TermsCopy['milestones']> = {
  'on order': 'onOrder',
  'against material bill': 'againstMaterialBill',
  'before commissioning': 'beforeCommissioning',
}

/** The three default instalment names; a staff-edited label is shown as typed. */
export function localizeMilestoneLabel(label: string, t: TermsCopy): string {
  const key = MILESTONE_KEYS[norm(label).toLowerCase()]
  return key ? t.milestones[key] : label
}
