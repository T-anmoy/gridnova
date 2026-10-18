import { describe, it, expect } from 'vitest'
import { ApiError } from '@/lib/dashboard/api-error'
import {
  EMPTY_ARCHIVE_FILTERS, activeArchiveFilterCount, archiveFilterApiError, archiveFiltersFromParams, archiveFiltersToParams, archiveFiltersToQuery,
  checkImportFile, describeImportError, formatFieldValue, groupDossier, mapsUrl, readDocuments, safeHttpUrl, schemeLabel, validateArchiveDraft,
} from '@/lib/archive/logic'
import { DOSSIER } from './fixtures/archive-contract'

describe('archive filters ↔ URL', () => {
  it('reads every filter by the API’s own parameter name', () => {
    const sp = new URLSearchParams(
      'q=Das&state=West+Bengal&district=Howrah&scheme=commercial&capacity_min=3&capacity_max=12.5&commissioned_from=2025-01-01&commissioned_to=2025-12-31&module_make=Adani&inverter_make=Sungrow&page=4',
    )
    expect(archiveFiltersFromParams(sp)).toEqual({
      q: 'Das', state: 'West Bengal', district: 'Howrah', scheme: 'commercial', capacityMin: '3', capacityMax: '12.5',
      commissionedFrom: '2025-01-01', commissionedTo: '2025-12-31', moduleMake: 'Adani', inverterMake: 'Sungrow',
    })
  })

  it('drops unusable values instead of forwarding them', () => {
    const f = archiveFiltersFromParams(new URLSearchParams('scheme=made_up&capacity_min=abc&commissioned_from=2025-02-31&commissioned_to=31/12/2025'))
    expect(f).toEqual(EMPTY_ARCHIVE_FILTERS)
  })

  it('writes filters back, keeps unrelated keys, and always returns to page 1', () => {
    const base = new URLSearchParams('page=3&district=Old&keep=1')
    const next = archiveFiltersToParams({ ...EMPTY_ARCHIVE_FILTERS, district: 'Howrah', capacityMin: '5' }, base)
    expect(next.get('district')).toBe('Howrah')
    expect(next.get('capacity_min')).toBe('5')
    expect(next.get('keep')).toBe('1')
    expect(next.has('page')).toBe(false)
  })

  it('round-trips', () => {
    const f = { ...EMPTY_ARCHIVE_FILTERS, q: 'Kabir', scheme: 'pm_kusum_pump', commissionedFrom: '2024-04-01' }
    expect(archiveFiltersFromParams(archiveFiltersToParams(f))).toEqual(f)
  })

  it('the API query holds only the filters that are set', () => {
    expect(archiveFiltersToQuery({ ...EMPTY_ARCHIVE_FILTERS, district: 'Howrah', commissionedTo: '2025-12-31' })).toEqual({ district: 'Howrah', commissioned_to: '2025-12-31' })
    expect(archiveFiltersToQuery(EMPTY_ARCHIVE_FILTERS)).toEqual({})
    expect(activeArchiveFilterCount({ ...EMPTY_ARCHIVE_FILTERS, district: 'x', q: 'y' })).toBe(2)
  })

  it('catches what would be a 422 before sending it', () => {
    expect(validateArchiveDraft({ ...EMPTY_ARCHIVE_FILTERS, capacityMin: '12', capacityMax: '3' })).toEqual([{ field: 'capacity_min', code: 'invalid_range' }])
    expect(validateArchiveDraft({ ...EMPTY_ARCHIVE_FILTERS, commissionedFrom: '2025-06-01', commissionedTo: '2025-01-01' })).toEqual([{ field: 'commissioned_from', code: 'invalid_range' }])
    expect(validateArchiveDraft({ ...EMPTY_ARCHIVE_FILTERS, capacityMin: 'abc' })).toEqual([{ field: 'capacity_min', code: 'invalid_number' }])
    expect(validateArchiveDraft({ ...EMPTY_ARCHIVE_FILTERS, commissionedTo: '2025-13-01' })).toEqual([{ field: 'commissioned_to', code: 'invalid_date' }])
    expect(validateArchiveDraft({ ...EMPTY_ARCHIVE_FILTERS, capacityMin: '3', capacityMax: '12' })).toEqual([])
  })

  it('reads the structured 422 for a bad filter', () => {
    const err = new ApiError(422, 'x', 'm', { code: 'invalid_range', field: 'capacity_min' })
    expect(archiveFilterApiError(err)).toEqual({ code: 'invalid_range', field: 'capacity_min' })
    expect(archiveFilterApiError(new ApiError(500, 'x'))).toBeNull()
    expect(archiveFilterApiError(new Error('x'))).toBeNull()
  })
})

describe('showing fields', () => {
  it('money from decimal strings, dates in IST, units', () => {
    expect(formatFieldValue('contract_value_inr', '250000.00')).toBe('₹2,50,000.00')
    expect(formatFieldValue('commissioning_date', '2025-03-15')).toBe('15 Mar 2025')
    expect(formatFieldValue('capacity_kw', '3.000')).toBe('3.000 kW')
    expect(formatFieldValue('pump_hp', '5')).toBe('5 HP')
    expect(formatFieldValue('scheme_or_segment', 'pm_kusum_pump')).toBe('PM-KUSUM pump')
    expect(formatFieldValue('system_type', 'on_grid')).toBe('On grid')
    expect(formatFieldValue('block', null)).toBe('—')
    expect(schemeLabel('something_new')).toBe('Something new')
  })

  it('groups only what is present: Project, Location, Equipment, Dates, Warranty, Documents, Data quality', () => {
    const groups = groupDossier(DOSSIER.fields, DOSSIER.sections)
    expect(groups.map((g) => g.title)).toEqual(['Project', 'Location', 'Equipment', 'Dates', 'Warranty', 'Documents', 'Data quality flags'])
    const project = groups[0].keys
    expect(project).toContain('customer_name')
    expect(project).not.toContain('customer_phone')
    expect(groups.find((g) => g.id === 'equipment')!.sections).toEqual(['equipment'])
    expect(groups.find((g) => g.id === 'dates')!.sections).toEqual(['stages'])
  })

  it('a role that does not get a field simply has no row for it (Sales: no block, no customer)', () => {
    const fields = { ...DOSSIER.fields }
    delete fields.block
    delete fields.customer_name
    delete fields.address_text
    delete fields.pincode
    delete fields.latitude
    delete fields.longitude
    const keys = groupDossier(fields, {}).flatMap((g) => g.keys)
    for (const gone of ['block', 'customer_name', 'address_text', 'latitude', 'longitude']) expect(keys).not.toContain(gone)
    expect(groupDossier(fields, {}).find((g) => g.id === 'location')!.keys).toEqual(['state', 'district'])
  })

  it('a field the contract does not name still shows, under Other', () => {
    const groups = groupDossier({ brand_new_field: { source_table: 't', value: 'x' } }, { odd_section: [{ source_table: 't', value: 1 }] })
    expect(groups).toEqual([{ id: 'other', title: 'Other', keys: ['brand_new_field'], sections: ['odd_section'] }])
  })

  it('the map link comes only from stored coordinates', () => {
    expect(mapsUrl('22.6500', '88.3400')).toBe('https://www.google.com/maps?q=22.65,88.34')
    expect(mapsUrl(22.65, 88.34)).toBe('https://www.google.com/maps?q=22.65,88.34')
    expect(mapsUrl(null, 88.34)).toBeNull()
    expect(mapsUrl('', '')).toBeNull()
    expect(mapsUrl('  ', ' ')).toBeNull()
    expect(mapsUrl('0', '0')).toBe('https://www.google.com/maps?q=0,0')
    expect(mapsUrl('abc', '1')).toBeNull()
    expect(mapsUrl('95', '10')).toBeNull()
    expect(mapsUrl('10', '190')).toBeNull()
  })

  it('stored document links are http(s) only', () => {
    expect(safeHttpUrl('https://files.example.com/a.pdf')).toBe('https://files.example.com/a.pdf')
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('data:text/html,<script>')).toBeNull()
    expect(safeHttpUrl('not a url')).toBeNull()
    expect(readDocuments([{ label: 'Report', url: 'https://x.test/r.pdf' }, { label: 'Bad', url: 'javascript:1' }, 'plain text', 7])).toEqual([
      { label: 'Report', url: 'https://x.test/r.pdf', raw: 'https://x.test/r.pdf' },
      { label: 'Bad', url: null, raw: 'javascript:1' },
      { label: 'plain text', url: null, raw: 'plain text' },
    ])
  })
})

describe('import errors and file check', () => {
  const err = (status: number, code: string) => new ApiError(status, 'x', 'server words', { code })
  it.each([
    [413, 'file_too_large', '10 MB'],
    [413, 'too_many_rows', '20,000'],
    [422, 'invalid_encoding', 'UTF-8'],
    [422, 'batch_token_required', 'dry run first'],
    [409, 'batch_token_mismatch', 'dry run again'],
    [409, 'already_imported', 'Void that batch'],
    [422, 'nothing_to_import', 'No row'],
    [409, 'import_conflict', 'dry run again'],
    [409, 'already_voided', 'already been voided'],
  ])('%s %s is explained in our words', (status, code, fragment) => {
    expect(describeImportError(err(status, code))).toContain(fragment)
  })
  it('403 says only an Admin can; unknown errors fall back to the server detail; network is its own sentence', () => {
    expect(describeImportError(new ApiError(403, 'x', 'Forbidden'))).toContain('Only an Admin')
    expect(describeImportError(new ApiError(400, 'x', 'server words'))).toBe('server words')
    expect(describeImportError(new ApiError(0, 'x'))).toContain('Can’t reach')
  })
  it('refuses a bad file before upload: empty, over 10 MB, not a CSV', () => {
    expect(checkImportFile({ name: 'a.csv', size: 0 })).toContain('empty')
    expect(checkImportFile({ name: 'a.csv', size: 10 * 1024 * 1024 + 1 })).toContain('10 MB')
    expect(checkImportFile({ name: 'a.xlsx', size: 100 })).toContain('.csv')
    expect(checkImportFile({ name: 'A.CSV', size: 10 * 1024 * 1024 })).toBeNull()
  })
})
