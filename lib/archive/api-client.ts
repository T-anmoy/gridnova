// Project Archive (BE-8) — docs/api/project_archive.md. Base path /api/v1/dashboard/archive.
// Every staff role reads (the backend redacts fields by role); only Admin imports and voids.
import { useAuth } from '@clerk/nextjs'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiShapeError } from '@/lib/dashboard/api-error'
import { apiDownload, apiFetch, apiFetchForm, buildQS, getTokenOrThrow } from '@/lib/api/http'
import { formatZodError } from '@/lib/dashboard/schemas'
import {
  archiveStatsSchema,
  batchDetailSchema,
  batchListSchema,
  batchSummarySchema,
  importReportSchema,
  projectDossierSchema,
  projectPageSchema,
  type ArchiveStats,
  type BatchDetail,
  type BatchSummary,
  type ImportReport,
  type ProjectDossier,
  type ProjectPage,
} from '@/lib/archive/schemas'

// Sub-paths are checked by tests/unit/fe7-endpoints.test.tsx (the static drift test sees only literals).
const DASHBOARD_API = '/api/v1/dashboard'
export const ARCHIVE_BASE = `${DASHBOARD_API}/archive`
const STALE = 60_000

/** Filter query params as the API names them (see archiveFiltersToQuery), plus paging for the list. */
export type ArchiveQuery = Record<string, string | number | undefined>

export function useArchiveProjects(params: ArchiveQuery) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['archive-projects', params],
    staleTime: STALE,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<ProjectPage> => {
      const token = await getTokenOrThrow(getToken)
      return apiFetch(`${ARCHIVE_BASE}/projects${buildQS(params)}`, token, { signal }, projectPageSchema)
    },
  })
}

export function useArchiveStats(params: ArchiveQuery) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['archive-stats', params],
    staleTime: STALE,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<ArchiveStats> => {
      const token = await getTokenOrThrow(getToken)
      return apiFetch(`${ARCHIVE_BASE}/stats${buildQS(params)}`, token, { signal }, archiveStatsSchema)
    },
  })
}

export function useArchiveProject(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['archive-project', id],
    enabled: Number.isInteger(id) && id > 0,
    queryFn: async ({ signal }): Promise<ProjectDossier> => {
      const token = await getTokenOrThrow(getToken)
      return apiFetch(`${ARCHIVE_BASE}/projects/${id}`, token, { signal }, projectDossierSchema)
    },
  })
}

// ── Admin: import ────────────────────────────────────────────────────────────

export function useArchiveBatches(enabled = true) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['archive-batches'],
    enabled,
    queryFn: async ({ signal }): Promise<BatchSummary[]> => {
      const token = await getTokenOrThrow(getToken)
      return (await apiFetch(`${ARCHIVE_BASE}/imports`, token, { signal }, batchListSchema)).items
    },
  })
}

export function useArchiveBatch(id: number | null) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['archive-batch', id],
    enabled: id != null,
    queryFn: async ({ signal }): Promise<BatchDetail> => {
      const token = await getTokenOrThrow(getToken)
      return apiFetch(`${ARCHIVE_BASE}/imports/${id}`, token, { signal }, batchDetailSchema)
    },
  })
}

/** Dry run (writes nothing) or commit (needs the `batch_token` the dry run returned and the same file). */
export function useArchiveImport() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, dryRun, batchToken }: { file: File; dryRun: boolean; batchToken?: string }): Promise<ImportReport> => {
      const token = await getTokenOrThrow(getToken)
      const form = new FormData()
      form.set('file', file)
      form.set('dry_run', dryRun ? 'true' : 'false')
      if (!dryRun && batchToken) form.set('batch_token', batchToken)
      const raw = await apiFetchForm<unknown>(`${ARCHIVE_BASE}/imports`, token, form)
      const parsed = importReportSchema.safeParse(raw)
      if (!parsed.success) throw new ApiShapeError(`${ARCHIVE_BASE}/imports`, formatZodError(parsed.error))
      return parsed.data
    },
    onSuccess: (report) => {
      if (!report.dry_run) {
        void qc.invalidateQueries({ queryKey: ['archive-batches'] })
        void qc.invalidateQueries({ queryKey: ['archive-projects'] })
        void qc.invalidateQueries({ queryKey: ['archive-stats'] })
      }
    },
  })
}

export function useVoidArchiveBatch() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ batchId, reason }: { batchId: number; reason: string }): Promise<BatchSummary> => {
      const token = await getTokenOrThrow(getToken)
      return apiFetch(`${ARCHIVE_BASE}/imports/${batchId}/void`, token, { method: 'POST', body: JSON.stringify({ reason }) }, batchSummarySchema)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['archive-batches'] })
      void qc.invalidateQueries({ queryKey: ['archive-batch'] })
      void qc.invalidateQueries({ queryKey: ['archive-projects'] })
      void qc.invalidateQueries({ queryKey: ['archive-project'] })
      void qc.invalidateQueries({ queryKey: ['archive-stats'] })
    },
  })
}

export function useDownloadArchiveTemplate() {
  const { getToken } = useAuth()
  return async () => {
    const token = await getTokenOrThrow(getToken)
    await apiDownload(`${ARCHIVE_BASE}/template.csv`, token, 'archive_import_template.csv')
  }
}
