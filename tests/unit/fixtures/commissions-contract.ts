// BE-4 (grid-nova-ai-backend docs/api/commissions.md) examples. The backend publishes no
// response schema for these routes, so the reply fixtures follow the contract text and are
// checked against the zod schemas in lib/commissions/schemas.ts; the request bodies are
// checked against openapi.json by tests/unit/fe4-contract.test.ts. Money is always a string.
import type {
  AssociateCommissions,
  AssociatePayouts,
  CommissionEntry,
  CommissionQuery,
  NetworkSummary,
  PayoutBatch,
  PayoutLine,
  RateSchedule,
  RateSchedules,
} from '@/lib/commissions/schemas'

export const RATE_KEYS = [
  'personal_sale.associate.sales',
  'personal_sale.associate.execution',
  'personal_sale.preferred_associate.state_head',
  'personal_sale.preferred_associate.district_head',
  'personal_sale.preferred_associate.block',
  'territory_state',
  'territory_district',
  'territory_block',
]

export const makeEntry = (over: Partial<CommissionEntry> = {}): CommissionEntry => ({
  entry_id: 12,
  associate: { associate_id: 'GNA-WB-26-00007', full_name: 'Asha Roy' },
  earning_role: 'personal_sale',
  kind: 'earn',
  status: 'earned',
  customer_name: 'Bikash Das',
  project_reference_id: 'GNE-WB-RES-2026-00012',
  onboarding_id: 5,
  payment_id: 9,
  basis_amount: '20000.00',
  rate_percent: '5.0000',
  holders: 1,
  amount: '1000.00',
  pending_reason: null,
  pending_message_key: null,
  schedule_version: 1,
  agreement_date: '2026-10-13',
  reverses_entry_id: null,
  reversed_by_entry_id: null,
  reason: null,
  batch: null,
  created_at: '2026-10-13T05:00:00Z',
  approved_at: null,
  paid_at: null,
  created_by: 'system',
  approved_by: null,
  rated_by: 'system',
  rated_at: '2026-10-13T05:00:00Z',
  ...over,
})

export const REVERSAL_ENTRY = makeEntry({
  entry_id: 14,
  kind: 'reversal',
  status: 'reversed',
  basis_amount: null,
  rate_percent: null,
  amount: '-1000.00',
  reverses_entry_id: 12,
  reason: 'Payment dishonoured',
})

export const RECOVERY_ENTRY = makeEntry({
  entry_id: 15,
  kind: 'recovery',
  status: 'approved',
  basis_amount: null,
  rate_percent: null,
  amount: '-250.50',
  reverses_entry_id: 11,
  reason: 'Payment dishonoured after payout',
})

export const PENDING_ENTRY = makeEntry({
  entry_id: 16,
  amount: null,
  rate_percent: null,
  pending_reason: 'placeholder_rates',
  pending_message_key: 'commission.pending.placeholder_rates',
  schedule_version: null,
})

export const TERRITORY_ENTRY = makeEntry({ entry_id: 17, earning_role: 'territory_district', holders: 2, amount: '300.00' })

const query = (open: boolean, closes = '2099-01-01T00:00:00Z') => ({ open, window_closes_at: closes })

export const ASSOCIATE_COMMISSIONS: AssociateCommissions = {
  items: [{ ...makeEntry(), query: query(false) }, { ...REVERSAL_ENTRY, query: query(false) }],
  page: 1,
  page_size: 25,
  total: 2,
  summary: {
    earned: '1000.00',
    approved: '2500.50',
    paid: '12345.67',
    pending_count: 1,
    to_recover: '250.50',
    financial_year: '2026-27',
    fy_taxable_commission: '15000.00',
    fy_tds_deducted: '300.00',
    next_payout: { period: '2026-10', expected_by: '2026-11-10' },
  },
}

export const PAYOUT_LINE: PayoutLine = {
  line_id: 3,
  gross: '25000.10',
  recoveries: '250.50',
  carried_in: '0.00',
  taxable: '24749.60',
  tds: '494.99',
  tds_rate_percent: '2.0000',
  net: '24254.61',
  carry_forward: '0.00',
  bank_account_last4: '4321',
  bank_ifsc: 'SBIN0000001',
  bank_reference: 'UTR123456',
  paid_at: '2026-11-10T06:30:00Z',
}

export const ASSOCIATE_PAYOUTS: AssociatePayouts = {
  items: [{ ...PAYOUT_LINE, batch_id: 3, period: '2026-10', financial_year: '2026-27', status: 'paid' }],
}

export const STAFF_LINE: PayoutLine = {
  ...PAYOUT_LINE,
  associate: { associate_id: 'GNA-WB-26-00007', full_name: 'Asha Roy' },
  account_holder_name: 'Asha Roy',
  pan_on_file: true,
  fy_taxable_before: '0.00',
  fy_tds_before: '0.00',
  bank_reference: null,
  paid_at: null,
}

export const makeBatch = (over: Partial<PayoutBatch> = {}): PayoutBatch => ({
  batch_id: 3,
  period: '2026-10',
  financial_year: '2026-27',
  status: 'draft',
  prepared_by: 'EMP-ACCOUNTS-1',
  prepared_at: '2026-11-01T05:00:00Z',
  approved_by: null,
  approved_at: null,
  approval_override_reason: null,
  paid_by: null,
  paid_at: null,
  cancelled_by: null,
  cancelled_at: null,
  cancel_reason: null,
  totals: { gross: '25000.10', recoveries: '250.50', carried_in: '0.00', taxable: '24749.60', tds: '494.99', net: '24254.61', carry_forward: '0.00' },
  line_count: 2,
  lines: [
    STAFF_LINE,
    { ...STAFF_LINE, line_id: 4, associate: { associate_id: 'GNA-WB-26-00008', full_name: 'Ravi Kumar' }, net: '0.00', tds: '0.00', gross: '100.00', taxable: '0.00', recoveries: '100.00' },
  ],
  ...over,
})

export const makeSchedule = (over: Partial<RateSchedule> = {}): RateSchedule => ({
  schedule_id: 2,
  version: 2,
  effective_from: '2026-09-01',
  is_placeholder: false,
  note: null,
  published_by: 'EMP-ADMIN-1',
  published_at: '2026-08-10T05:00:00Z',
  rates: Object.fromEntries(RATE_KEYS.map((k, i) => [k, `${i + 1}.0000`])),
  in_effect: true,
  ...over,
})

export const RATE_SCHEDULES: RateSchedules = {
  items: [
    makeSchedule({ schedule_id: 3, version: 3, effective_from: '2027-01-01', in_effect: false }),
    makeSchedule(),
    makeSchedule({ schedule_id: 1, version: 1, is_placeholder: true, effective_from: '2026-01-01', in_effect: false, note: 'Placeholder until Grid Nova confirms', rates: Object.fromEntries(RATE_KEYS.map((k) => [k, '0.0000'])) }),
  ],
  in_force_schedule_id: 2,
  rate_keys: RATE_KEYS,
  earliest_effective_from: '2026-10-29',
}

export const makeQuery = (over: Partial<CommissionQuery> = {}): CommissionQuery => ({
  query_id: 8,
  entry_id: 12,
  message: 'Why is my rate 5%?',
  status: 'open',
  response: null,
  responded_at: null,
  responded_by: null,
  due_at: '2026-11-04T12:29:59Z',
  created_at: '2026-10-14T05:00:00Z',
  overdue: false,
  associate: { associate_id: 'GNA-WB-26-00007', full_name: 'Asha Roy' },
  entry: makeEntry(),
  ...over,
})

export const NETWORK_SUMMARY: NetworkSummary = {
  period: { date_from: '2026-10-01', date_to: '2026-10-13' },
  generated_at: '2026-10-13T10:00:00Z',
  associates: [
    { associate_type: 'preferred_associate', capability: null, level: 'state_head', status: 'active', count: 1 },
    { associate_type: 'associate', capability: 'sales', level: null, status: 'active', count: 7 },
    { associate_type: 'associate', capability: 'execution', level: null, status: 'suspended', count: 2 },
  ],
  seats: [{ state_lgd_code: 19, state_name: 'West Bengal', state_heads: { held: 1, max: 2 }, districts: { with_head: 1, total: 23 }, blocks: { with_associate: 1, total: 345 } }],
  onboardings: { by_status: { draft: 0, submitted: 2, verified: 1, closed: 0 }, by_current_stage: { agreement_signed: 1, installed: 3 } },
  verified_revenue: { credits: '21780.00', reversals: '0.00', net: '21780.00' },
  commissions: { earned: '1600.00', reversed: '0.00', approved: '0.00', paid_net: '0.00', paid_tds: '0.00', pending_count: 0 },
  overdue: { verification_calls: 2, survey_reviews: 1, payments_awaiting_verification: 3, commission_queries: 4 },
}
