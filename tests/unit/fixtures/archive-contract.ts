// Shapes copied from docs/api/project_archive.md (BE-8). fe7-contract.test.ts checks them against docs/api/openapi.json.
import type { ArchiveStats, BatchSummary, ImportReport, ProjectCard, ProjectDossier } from '@/lib/archive/schemas'

const prov = (value: unknown, id = 41) => ({ value, source_table: 'archived_projects', record_id: id })

export const CARD: ProjectCard = {
  source: 'archive',
  ref: 'GN-0001',
  id: 41,
  fields: {
    scheme_or_segment: prov('pm_surya_ghar_residential'),
    system_type: prov('on_grid'),
    capacity_kw: prov('3.000'),
    state: prov('West Bengal'),
    district: prov('Howrah'),
    block: prov('Bally'),
    commissioning_date: prov('2025-03-15'),
    module_make: prov('Adani'),
    inverter_make: prov('Sungrow'),
    customer_name: prov('Kabir Das'),
  },
}

/** What a Sales caller gets: no block, no customer (location_detail / customer_identity are not theirs). */
export const CARD_FOR_SALES: ProjectCard = {
  ...CARD,
  id: 42,
  ref: 'GN-0002',
  fields: Object.fromEntries(Object.entries(CARD.fields).filter(([k]) => !['block', 'customer_name'].includes(k))),
}

export const PAGE = (items: ProjectCard[], over: Partial<{ page: number; page_size: number; total: number }> = {}) => ({
  items,
  page: 1,
  page_size: 25,
  total: items.length,
  ...over,
})

export const DOSSIER: ProjectDossier = {
  ...CARD,
  fields: {
    ...CARD.fields,
    address_text: prov('12 Lake Road, Bally'),
    pincode: prov('711201'),
    latitude: prov('22.6500'),
    longitude: prov('88.3400'),
    contract_value_inr: prov('250000.00'),
    module_wattage_wp: prov('540.00'),
    module_count: prov(6),
    commissioning_date: prov('2025-03-15'),
    warranty_end_modules: prov('2037-03-15'),
    om_status: prov('Annual visit due'),
    documents: prov([{ label: 'Commissioning report', url: 'https://files.example.com/report.pdf' }, { label: 'Bad link', url: 'javascript:alert(1)' }]),
    data_quality_flags: prov(['unknown_block', 'date_order']),
  },
  sections: {
    equipment: [prov({ category: 'module', make: 'Adani', model: 'ASP-540', rating: '540.00', count: 6, dcr: 'yes' })],
    stages: [prov({ stage: 'commissioned', date: '2025-03-15' })],
    warranty: [],
    service_requests: [],
    documents: [],
  },
}

export const STATS: ArchiveStats = {
  total: { count: 117, capacity_kw: '412.500' },
  by_scheme: [
    { scheme: 'pm_surya_ghar_residential', count: 100, capacity_kw: '300.000' },
    { scheme: 'commercial', count: 17, capacity_kw: '112.500' },
  ],
  by_state: [{ state: 'West Bengal', count: 117, capacity_kw: '412.500' }],
  by_district: [{ state: 'West Bengal', district: 'Howrah', count: 40, capacity_kw: '120.000' }],
  by_year: [{ year: 2025, count: 90, capacity_kw: '300.000' }, { year: 2024, count: 27, capacity_kw: '112.500' }],
}

export const DRY_RUN: ImportReport = {
  batch_id: null,
  dry_run: true,
  filename: 'projects.csv',
  batch_token: '9f2c' + 'a'.repeat(60),
  sha256: '9f2c' + 'a'.repeat(60),
  row_count: 120,
  accepted_count: 117,
  rejected_count: 3,
  error_count: 3,
  warning_count: 9,
  counts_by_code: { duplicate_grid_nova_ref: 1, missing_required: 2, unknown_district: 9 },
  errors: [{ row: 14, column: 'state', code: 'missing_required', message: 'state is required.' }],
  errors_truncated: false,
  warnings: [{ row: 7, column: 'district', code: 'unknown_district', message: 'District not in the territory master.' }],
  warnings_truncated: true,
  notices: [{ code: 'personal_data_present', columns: ['customer_phone'], rows: 40, message: 'personal data imported — visible to Admin/Management only' }],
  already_imported_batch_id: null,
}

export const COMMITTED: ImportReport = { ...DRY_RUN, batch_id: 7, dry_run: false }

export const BATCH_ACTIVE: BatchSummary = {
  id: 7,
  filename: 'projects.csv',
  sha256: DRY_RUN.sha256,
  uploaded_by: 'emp-admin-1',
  uploaded_at: '2026-10-17T10:00:00+00:00',
  row_count: 120,
  accepted_count: 117,
  rejected_count: 3,
  status: 'imported',
  void_reason: null,
  voided_at: null,
  voided_by: null,
}

export const BATCH_VOIDED: BatchSummary = {
  ...BATCH_ACTIVE,
  id: 6,
  filename: 'old.csv',
  status: 'voided',
  void_reason: 'Wrong file',
  voided_at: '2026-10-17T12:00:00+00:00',
  voided_by: 'emp-admin-1',
}
