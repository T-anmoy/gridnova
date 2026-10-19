import '@/lib/zod-config'
import { z } from 'zod'

// Mirrors docs/api/project_archive.md and its schemas in docs/api/openapi.json.

export const provenancedSchema = z.object({
  source_table: z.string(),
  // The contract leaves value / record_id untyped (record_id is a list for aggregated values).
  value: z.unknown().optional(),
  record_id: z.unknown().optional(),
})

export const projectCardSchema = z.object({
  source: z.string(),
  ref: z.string(),
  id: z.number().int(),
  fields: z.record(z.string(), provenancedSchema),
})

export const projectDossierSchema = projectCardSchema.extend({
  sections: z.record(z.string(), z.array(provenancedSchema)),
})

export const projectPageSchema = z.object({
  items: z.array(projectCardSchema),
  page: z.number().int(),
  page_size: z.number().int(),
  total: z.number().int(),
})

const capacity = z.string()
export const archiveStatsSchema = z.object({
  total: z.object({ count: z.number().int(), capacity_kw: capacity }),
  by_scheme: z.array(z.object({ scheme: z.string(), count: z.number().int(), capacity_kw: capacity })),
  by_state: z.array(z.object({ state: z.string().nullable().optional(), count: z.number().int(), capacity_kw: capacity })),
  by_district: z.array(
    z.object({ state: z.string().nullable().optional(), district: z.string().nullable().optional(), count: z.number().int(), capacity_kw: capacity }),
  ),
  by_year: z.array(z.object({ year: z.number().int(), count: z.number().int(), capacity_kw: capacity })),
})

export const importIssueSchema = z.object({
  row: z.number().int(),
  column: z.string().nullable().optional(),
  code: z.string(),
  message: z.string(),
})

export const importNoticeSchema = z.object({
  code: z.string(),
  columns: z.array(z.string()),
  rows: z.number().int(),
  message: z.string(),
})

export const importReportSchema = z.object({
  batch_id: z.number().int().nullable().optional(),
  dry_run: z.boolean(),
  filename: z.string(),
  batch_token: z.string(),
  sha256: z.string(),
  row_count: z.number().int(),
  accepted_count: z.number().int(),
  rejected_count: z.number().int(),
  error_count: z.number().int(),
  warning_count: z.number().int(),
  counts_by_code: z.record(z.string(), z.number().int()),
  errors: z.array(importIssueSchema),
  errors_truncated: z.boolean(),
  warnings: z.array(importIssueSchema),
  warnings_truncated: z.boolean(),
  notices: z.array(importNoticeSchema),
  already_imported_batch_id: z.number().int().nullable().optional(),
})

const batchFields = {
  id: z.number().int(),
  filename: z.string(),
  sha256: z.string(),
  uploaded_by: z.string(),
  uploaded_at: z.string(),
  row_count: z.number().int(),
  accepted_count: z.number().int(),
  rejected_count: z.number().int(),
  status: z.string(),
  void_reason: z.string().nullable().optional(),
  voided_at: z.string().nullable().optional(),
  voided_by: z.string().nullable().optional(),
}
export const batchSummarySchema = z.object(batchFields)
export const batchDetailSchema = z.object({ ...batchFields, report: importReportSchema })
export const batchListSchema = z.object({ items: z.array(batchSummarySchema) })

export type Provenanced = z.infer<typeof provenancedSchema>
export type ProjectCard = z.infer<typeof projectCardSchema>
export type ProjectDossier = z.infer<typeof projectDossierSchema>
export type ProjectPage = z.infer<typeof projectPageSchema>
export type ArchiveStats = z.infer<typeof archiveStatsSchema>
export type ImportIssue = z.infer<typeof importIssueSchema>
export type ImportReport = z.infer<typeof importReportSchema>
export type BatchSummary = z.infer<typeof batchSummarySchema>
export type BatchDetail = z.infer<typeof batchDetailSchema>
