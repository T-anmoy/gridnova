import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import Step4SystemConfig from '@/app/(internal)/proposal/new/steps/Step4SystemConfig'
import { equipmentTierLabels } from '@/lib/pricing/tier-labels'
import { DEFAULT_VALUES, EQUIPMENT_TIERS } from '@/app/(internal)/proposal/new/types'
import { CATALOGUE } from './fixtures/pricing'

afterEach(() => vi.unstubAllGlobals())

describe('equipmentTierLabels', () => {
  it('maps the standard and premium tiers to the package names from the catalogue', () => {
    expect(equipmentTierLabels(CATALOGUE)).toEqual({
      Standard: 'Nova Assured',
      Premium: 'Nova Signature',
      'As recommended by Grid Nova': 'As recommended by Grid Nova',
    })
  })
  it('leaves the original text in place while the catalogue is unavailable', () => {
    expect(equipmentTierLabels(null)).toEqual({ 'As recommended by Grid Nova': 'As recommended by Grid Nova' })
  })
})

describe('Step 4 equipment tier select', () => {
  it('shows package names but keeps the stored values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(CATALOGUE), { status: 200 })))
    render(<Step4SystemConfig values={DEFAULT_VALUES} set={vi.fn()} dcrAutoSet={false} />)
    const select = screen.getByLabelText(/preferred equipment tier/i)
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Nova Assured' })).toBeInTheDocument())
    expect(within(select).getByRole('option', { name: 'Nova Signature' })).toHaveValue('Premium')
    expect(within(select).getByRole('option', { name: 'Nova Assured' })).toHaveValue('Standard')
    expect(within(select).getByRole('option', { name: 'As recommended by Grid Nova' })).toHaveValue('As recommended by Grid Nova')
    expect(EQUIPMENT_TIERS).toEqual(['Standard', 'Premium', 'As recommended by Grid Nova'])
  })
})
