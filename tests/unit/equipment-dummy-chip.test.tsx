import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import EquipmentPage from '@/app/(internal)/dashboard/equipment/page'
import { withI18n } from './helpers/i18n'

vi.mock('@clerk/nextjs', () => ({ useUser: () => ({ user: { publicMetadata: { role: 'admin' } } }), useAuth: () => ({ getToken: async () => 't' }) }))
vi.mock('@/lib/dashboard/api-client', async (orig) => ({
  ...(await orig<typeof import('@/lib/dashboard/api-client')>()),
  useEquipment: () => ({
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    data: [
      { id: 1, category: 'solar_panel', brand: 'RealCo', model_name: 'R-500', specification: null, is_dcr_compliant: true, procurement_price_inr: null, is_active: true, created_at: null },
      { id: 2, category: 'solar_panel', brand: 'DummyCo', model_name: 'D-500', specification: null, is_dcr_compliant: false, procurement_price_inr: null, is_active: true, created_at: null, is_placeholder: true },
    ],
  }),
  useCreateEquipment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetEquipmentActive: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('Equipment page', () => {
  it('flags only is_placeholder rows with the Dummy / pending Grid Nova chip', () => {
    render(withI18n(<EquipmentPage />))
    const chips = screen.getAllByTestId('dummy-chip')
    expect(chips).toHaveLength(1)
    expect(chips[0].closest('td')).toHaveTextContent('DummyCo')
    expect(screen.getByText('RealCo').closest('td')).not.toHaveTextContent('Dummy')
  })
})
