'use client'

import { useRef, useState } from 'react'
import { Download, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import ReasonDialog from '@/components/dashboard/ReasonDialog'
import { ImportReportView } from '@/components/dashboard/archive/ImportReportView'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { checkImportFile, describeImportError } from '@/lib/archive/logic'
import { useArchiveBatch, useArchiveBatches, useArchiveImport, useDownloadArchiveTemplate, useVoidArchiveBatch } from '@/lib/archive/api-client'
import type { ImportReport } from '@/lib/archive/schemas'
import { formatDatetime } from '@/lib/dashboard/utils'

function BatchReport({ batchId }: { batchId: number }) {
  const { data, isLoading, error } = useArchiveBatch(batchId)
  if (isLoading) return <p className="text-sm text-gray-500" role="status">Loading the report…</p>
  if (error || !data) return <p role="alert" className="text-sm text-red-600">Couldn’t load this batch’s report.</p>
  return <ImportReportView report={data.report} />
}

export function ArchiveImport() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [committed, setCommitted] = useState<ImportReport | null>(null)
  const [voidTarget, setVoidTarget] = useState<number | null>(null)
  const [openReport, setOpenReport] = useState<number | null>(null)

  const importer = useArchiveImport()
  const batches = useArchiveBatches()
  const voidBatch = useVoidArchiveBatch()
  const downloadTemplate = useDownloadArchiveTemplate()
  const [downloading, setDownloading] = useState(false)

  function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setReport(null)
    setCommitted(null)
    setError(null)
    if (!f) {
      setFile(null)
      setFileError(null)
      return
    }
    const problem = checkImportFile(f)
    setFileError(problem)
    setFile(problem ? null : f)
  }

  async function dryRun() {
    if (!file) return
    setError(null)
    setCommitted(null)
    try {
      setReport(await importer.mutateAsync({ file, dryRun: true }))
    } catch (err) {
      setReport(null)
      setError(describeImportError(err))
    }
  }

  async function commit() {
    if (!file || !report) return
    setError(null)
    try {
      const done = await importer.mutateAsync({ file, dryRun: false, batchToken: report.batch_token })
      setCommitted(done)
      setReport(null)
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      toast.success(`Imported ${done.accepted_count} projects`)
    } catch (err) {
      setError(describeImportError(err))
    }
  }

  async function runDownload() {
    setDownloading(true)
    setError(null)
    try {
      await downloadTemplate()
    } catch (err) {
      setError(describeImportError(err))
    } finally {
      setDownloading(false)
    }
  }

  // Nothing can be imported if every row was rejected, or the same file is already a batch.
  const canCommit = !!report && report.accepted_count > 0 && report.already_imported_batch_id == null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-[#091c3c] md:text-2xl">Import archived projects</h1>
        <p className="mt-1 text-sm text-gray-600">Upload a CSV of completed projects. A dry run checks every row and writes nothing; you confirm the import afterwards.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1 · Choose a file</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" variant="outline" className="min-h-[44px]" disabled={downloading} onClick={() => void runDownload()}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            Download template
          </Button>
          <div>
            <label htmlFor="archive-file" className="mb-1 block text-sm font-medium text-gray-700">CSV file (up to 10 MB)</label>
            <input
              ref={fileInput}
              id="archive-file"
              type="file"
              accept=".csv,text/csv"
              onChange={choose}
              className="block min-h-[44px] w-full text-base file:mr-3 file:min-h-[44px] file:rounded-lg file:border file:border-[#e4e8ee] file:bg-white file:px-4"
            />
            {fileError && <p role="alert" className="mt-1 text-sm text-red-600">{fileError}</p>}
          </div>
          <Button type="button" className="min-h-[44px]" disabled={!file || importer.isPending} onClick={() => void dryRun()}>
            {importer.isPending && importer.variables?.dryRun ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            Run dry run
          </Button>
        </CardContent>
      </Card>

      {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="import-error">{error}</p>}

      {report && (
        <Card>
          <CardHeader><CardTitle className="text-base">2 · Dry-run report — {report.filename}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ImportReportView report={report} />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" className="min-h-[44px]" disabled={!canCommit || importer.isPending} onClick={() => void commit()}>
                {importer.isPending && !importer.variables?.dryRun && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Confirm import of {report.accepted_count} {report.accepted_count === 1 ? 'project' : 'projects'}
              </Button>
              {report.accepted_count === 0 && <p className="text-sm text-gray-600">No row can be imported. Fix the errors and run the dry run again.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {committed && (
        <Card data-testid="import-done">
          <CardHeader><CardTitle className="text-base">Imported</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-800">Batch #{committed.batch_id} · {committed.accepted_count} projects imported, {committed.rejected_count} rows skipped.</p>
            <ImportReportView report={committed} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Import batches</CardTitle></CardHeader>
        <CardContent>
          {batches.isLoading ? (
            <p className="text-sm text-gray-500" role="status">Loading batches…</p>
          ) : batches.error ? (
            <div role="alert" className="space-y-2 text-sm text-red-600">
              <p>Couldn’t load the batches.</p>
              <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={() => void batches.refetch()}>Retry</Button>
            </div>
          ) : (batches.data ?? []).length === 0 ? (
            <p className="text-sm text-gray-500" data-testid="batches-empty">No batches imported yet.</p>
          ) : (
            <div className="overflow-auto">
              <Table aria-label="Import batches">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Batch</TableHead>
                    <TableHead scope="col">File</TableHead>
                    <TableHead scope="col">Uploaded</TableHead>
                    <TableHead scope="col" className="text-right">Rows</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(batches.data ?? []).map((b) => {
                    const voided = b.status === 'voided'
                    return (
                      <TableRow key={b.id} data-testid="batch-row">
                        <TableCell className="whitespace-nowrap font-medium">#{b.id}</TableCell>
                        <TableCell className="max-w-[14rem] break-words">{b.filename}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatDatetime(b.uploaded_at)}<span className="block text-xs text-gray-500">{b.uploaded_by}</span></TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums text-sm">{b.accepted_count} / {b.row_count}</TableCell>
                        <TableCell>
                          <Badge variant={voided ? 'gray' : 'green'}>{b.status}</Badge>
                          {voided && b.void_reason && <p className="mt-1 max-w-[14rem] break-words text-xs text-gray-600">{b.void_reason}</p>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" className="min-h-[44px]" aria-expanded={openReport === b.id} onClick={() => setOpenReport(openReport === b.id ? null : b.id)}>
                              Report
                            </Button>
                            {!voided && (
                              <Button type="button" variant="outline" size="sm" className="min-h-[44px] text-red-700" onClick={() => setVoidTarget(b.id)}>
                                Void
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {openReport != null && (
            <div className="mt-4 border-t border-[#e4e8ee] pt-4">
              <BatchReport batchId={openReport} />
            </div>
          )}
        </CardContent>
      </Card>

      <ReasonDialog
        open={voidTarget != null}
        onOpenChange={(o) => {
          if (!o) setVoidTarget(null)
        }}
        title={`Void batch #${voidTarget ?? ''}?`}
        description="Every project of this batch disappears from the archive, its statistics, search and Nova. Nothing is deleted, and the same file can be imported again."
        label="Reason (3–1000 characters)"
        required
        destructive
        confirmLabel="Void batch"
        onConfirm={async (reason) => {
          if (reason.length < 3) throw new Error('short')
          if (reason.length > 1000) throw new Error('long')
          await voidBatch.mutateAsync({ batchId: voidTarget as number, reason })
          toast.success('Batch voided')
        }}
        describeError={(err) =>
          err instanceof Error && err.message === 'short'
            ? 'Give a reason of at least 3 characters.'
            : err instanceof Error && err.message === 'long'
              ? 'Keep the reason under 1000 characters.'
              : describeImportError(err)
        }
      />
    </div>
  )
}
