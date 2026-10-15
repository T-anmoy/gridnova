// BE-5 (grid-nova-ai-backend docs/api/handover_warranty.md) examples. Response schemas are not
// published, so these follow the contract text and are checked against lib/handover/schemas.ts by
// tests/unit/fe4-handover-contract.test.ts.
import type { Pack, PackItem, PublicHandover, ServiceRequest, Warranty } from '@/lib/handover/schemas'

const item = (key: string, over: Partial<PackItem> = {}): PackItem => ({
  key,
  label: key,
  message_key: `handover.item.${key}`,
  done: false,
  source: 'record',
  done_at: null,
  done_by: null,
  note: null,
  ...over,
})

export const PACK_ITEMS: PackItem[] = [
  item('commissioning_report', { label: 'Commissioning report', done: true, done_at: '2026-10-10T05:00:00Z' }),
  item('net_meter_report', { label: 'Net-meter report', done: true }),
  item('register_verified', { label: 'Serial register verified', done: true }),
  item('final_payment', { label: 'Final payment received', done: true, through_milestone: 3 }),
  item('orientation', { label: 'Customer orientation', source: 'manual' }),
  item('acknowledgement', { label: 'Customer acknowledgement', source: 'manual', method: null, customer_name: null }),
  item('om_contact', { label: 'O&M contact given', source: 'manual' }),
]

export const WARRANTY: Warranty = {
  handover_date: '2026-10-12',
  system: { years: 5, starts: '2026-10-12', ends: '2031-10-12', active: true },
  om: { free_months: 12, free_until: '2027-10-12', free_period_active: true, terms_after_free_period: null },
  panel_performance_life_years: null,
  units: [
    { unit_id: 1, category: 'module', serial_number: 'MOD-001', make: 'Waaree', model: 'WS-540', equipment_id: 3, warranty_start: '2026-10-12', warranty_end: '2038-10-12', source: 'register', active: true },
    { unit_id: 2, category: 'inverter', serial_number: 'INV-009', make: 'Growatt', model: 'MIN 5000', equipment_id: 4, warranty_start: null, warranty_end: null, source: 'none', active: null },
  ],
}

export const makePack = (over: Partial<Pack> = {}): Pack => ({
  onboarding_id: 12,
  project_id: 7,
  handover_recorded: false,
  pack_required: true,
  items: PACK_ITEMS,
  complete: false,
  missing: ['orientation', 'acknowledgement', 'om_contact'],
  done: 4,
  total: 7,
  warranty: null,
  pdf: { status: 'not_generated', held_reason: null, generated_at: null },
  can_act: true,
  link: { state: 'none', issued_at: null, issued_by: null, expires_at: null, revoked_at: null },
  email: { status: null, skipped_reason: null, emailed_at: null },
  ...over,
})

export const COMPLETE_PACK = makePack({
  items: PACK_ITEMS.map((i) => ({ ...i, done: true })),
  complete: true,
  missing: [],
  done: 7,
})

export const HANDED_OVER_PACK = makePack({
  ...COMPLETE_PACK,
  handover_recorded: true,
  warranty: WARRANTY,
  pdf: { status: 'ready', held_reason: null, generated_at: '2026-10-12T06:00:00Z' },
  link: { state: 'active', issued_at: '2026-10-12T06:01:00Z', issued_by: 'EMP-OPS-1', expires_at: null, revoked_at: null },
  email: { status: 'sent', skipped_reason: null, emailed_at: '2026-10-12T06:02:00Z' },
})

export const GATE_422_BODY = {
  code: 'handover_pack_incomplete',
  message: 'The handover pack is incomplete.',
  missing: ['orientation', 'acknowledgement'],
  missing_labels: ['Customer orientation', 'Customer acknowledgement'],
}

export const makeRequest = (over: Partial<ServiceRequest> = {}): ServiceRequest => ({
  request_id: 31,
  onboarding_id: 12,
  category: 'no_generation',
  description: 'The panels stopped generating after the storm.',
  status: 'open',
  raised_via: 'customer',
  within_warranty: true,
  warranty_end: '2031-10-12',
  photo_count: 1,
  created_at: '2026-11-02T05:00:00Z',
  closed_at: null,
  resolution_note: null,
  sla_due_at: null,
  overdue: false,
  raised_by: null,
  assignee_id: null,
  contact_phone: '9800000000',
  updated_at: '2026-11-02T05:00:00Z',
  photos: [{ file_ref: 'ph-1', filename: 'roof.jpg', content_type: 'image/jpeg', size_bytes: 120_000, received_at: '2026-11-02T05:00:01Z' }],
  history: [
    { kind: 'raised', actor: null, from_status: null, to_status: 'open', note: null, detail: null, at: '2026-11-02T05:00:00Z' },
    { kind: 'note', actor: 'EMP-OPS-1', from_status: null, to_status: null, note: 'Called the customer.', detail: null, at: '2026-11-02T06:00:00Z' },
  ],
  customer_name: 'Bikash Das',
  project_reference_id: 'GNE-WB-RES-2026-00012',
  can_handle: true,
  ...over,
})

export const PUBLIC_HANDOVER: PublicHandover = {
  customer_name: 'Bikash Das',
  project_reference_id: 'GNE-WB-RES-2026-00012',
  site_address: '12 Lake Road, Kolkata 700001',
  system: { installed_module_kw: '5.40', connection_phase: 'single' },
  warranty: WARRANTY,
  service: {
    phone: '+91 33 0000 0000',
    email: 'service@gridnova.in',
    sla_hours: null,
    categories: ['no_generation', 'inverter_error', 'physical_damage', 'cleaning_om', 'other'],
    max_photos: 5,
  },
  pdf_available: true,
  link_expires_at: null,
}
