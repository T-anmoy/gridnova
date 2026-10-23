// BE-12 examples (grid-nova-ai-backend docs/api/commission_rates_individual.md), word for word.
// The routes publish no response schema, so these are checked against the zod schemas in
// lib/commissions/schemas.ts by tests/unit/fe12-rate-logic.test.ts.
import type { AssociatePerformance, AssociateRate, MyRate } from '@/lib/commissions/schemas'

export const RATE: AssociateRate = {
  associate_id: 'GNA-WB-26-00007',
  full_name: 'Asha Roy',
  rate_key: 'personal_sale.associate.sales',
  today: '2026-10-23',
  standard: { rate_percent: '7.5000', schedule_id: 1, schedule_version: 1, effective_from: '2026-10-23' },
  individual: { individual_rate_id: 4, rate_percent: '8.0000', effective_from: '2026-10-23' },
  effective: { rate_percent: '8.0000', source: 'individual', effective_from: '2026-10-23', pending_reason: null },
  scheduled_changes: [{ effective_from: '2026-11-07', rate_percent: '7.5000', source: 'standard' }],
  history: [
    {
      individual_rate_id: 5,
      rate_key: 'personal_sale.associate.sales',
      rate_percent: null,
      effective_from: '2026-11-07',
      reason: 'Quarterly review: back to standard',
      set_by: 'emp-admin-1',
      created_at: '2026-10-23T06:10:00+00:00',
      status: 'scheduled',
    },
    {
      individual_rate_id: 4,
      rate_key: 'personal_sale.associate.sales',
      rate_percent: '8.0000',
      effective_from: '2026-10-23',
      reason: 'Twelve installs this quarter, all on time',
      set_by: 'emp-admin-1',
      created_at: '2026-10-23T06:00:00+00:00',
      status: 'in_force',
    },
  ],
  notice: { increase_earliest_effective_from: '2026-10-23', reduction_earliest_effective_from: '2026-11-07', increase_needs_notice: false, notice_days: 15 },
  bounds: { min_percent: null, max_percent: null },
}

export const PERFORMANCE: AssociatePerformance = {
  associate_id: 'GNA-WB-26-00007',
  period: { date_from: '2026-10-01', date_to: '2026-10-23' },
  customers: { onboarded: 4, verified: 3, commissioned: 1 },
  verified_payments: { credits: '87120.00', reversals: '0.00', net: '87120.00' },
  commission: { earned: '4000.00', earned_personal_sale: '4000.00', reversed: '0.00', pending_count: 0 },
}

export const MY_RATE: MyRate = {
  rate_key: 'personal_sale.associate.sales',
  today: '2026-10-23',
  effective: { rate_percent: '8.0000', source: 'individual', effective_from: '2026-10-23', pending_reason: null },
  scheduled_changes: [{ effective_from: '2026-11-07', rate_percent: '7.5000', source: 'standard' }],
}
