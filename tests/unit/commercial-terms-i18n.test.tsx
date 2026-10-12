import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import en from '@/messages/en.json'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import { I18nProvider } from '@/lib/i18n/client'
import { PackageEquipment } from '@/components/pricing/PackageCards'
import { localizeLifeSpan, localizeMilestoneLabel, localizeOandM, localizeWarranty } from '@/lib/pricing/terms'
import type { CataloguePackage } from '@/lib/pricing/price-list'

const LOCALES = { en, hi, bn } as const

// The facts the backend's price list sends today (config/price_list.yaml).
const TERMS = { standard_warranty: '5 years from handover', o_and_m: 'First year free', solar_panel_life_span: '20–25 years' }
const PKG = { id: 'NOVA_ASSURED', display_name: 'Nova Assured', equipment: {} } as unknown as CataloguePackage

const digits = (s: string) => s.replace(/\D/g, '')

describe.each(Object.entries(LOCALES))('commercial terms — %s', (locale, messages) => {
  const t = messages.pricing.terms

  it('keeps every number identical to the backend text', () => {
    expect(digits(localizeWarranty('5 years from handover', t))).toBe('5')
    expect(digits(localizeLifeSpan('20–25 years', t))).toBe('2025')
    expect(localizeLifeSpan('20–25 years', t)).toContain('20–25')
  })

  it('translates the wording (not for English), without touching unknown terms', () => {
    if (locale !== 'en') {
      expect(localizeWarranty('5 years from handover', t)).not.toMatch(/years|handover/i)
      expect(localizeOandM('First year free', t)).not.toMatch(/first|free/i)
      expect(localizeMilestoneLabel('Against Material Bill', t)).not.toMatch(/material/i)
    }
    // A shape we do not recognise is shown as the backend sent it.
    expect(localizeWarranty('Lifetime on request', t)).toBe('Lifetime on request')
    expect(localizeOandM('Two visits a year', t)).toBe('Two visits a year')
    expect(localizeMilestoneLabel('Site mobilisation', t)).toBe('Site mobilisation')
  })

  it('renders the package card terms in the page language', () => {
    render(
      <I18nProvider locale={locale as 'en'} messages={{ pricing: messages.pricing }}>
        <PackageEquipment pkg={PKG} terms={TERMS} />
      </I18nProvider>
    )
    expect(screen.getByText(localizeWarranty(TERMS.standard_warranty, t))).toBeInTheDocument()
    expect(screen.getByText(localizeOandM(TERMS.o_and_m, t))).toBeInTheDocument()
    expect(screen.getByText(localizeLifeSpan(TERMS.solar_panel_life_span, t))).toBeInTheDocument()
    if (locale !== 'en') {
      expect(screen.queryByText('5 years from handover')).toBeNull()
      expect(screen.queryByText('First year free')).toBeNull()
    }
  })
})

describe('English is exactly the backend wording', () => {
  const t = en.pricing.terms
  it('round-trips', () => {
    expect(localizeWarranty('5 years from handover', t)).toBe('5 years from handover')
    expect(localizeWarranty('1 year from handover', t)).toBe('1 year from handover')
    expect(localizeOandM('First year free', t)).toBe('First year free')
    expect(localizeLifeSpan('20–25 years', t)).toBe('20–25 years')
    expect(localizeLifeSpan('25 years', t)).toBe('25 years')
    expect(localizeMilestoneLabel('On Order', t)).toBe('On Order')
    expect(localizeMilestoneLabel('  before   commissioning ', t)).toBe('Before Commissioning')
  })
})
