'use client'

import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { humanize } from '@/lib/archive/logic'
import type { ImportIssue, ImportReport } from '@/lib/archive/schemas'

function IssueTable({ title, issues, truncated, tone }: { title: string; issues: ImportIssue[]; truncated: boolean; tone: 'red' | 'amber' }) {
  if (issues.length === 0) return null
  return (
    <section aria-label={title} className="rounded-lg border border-[#e4e8ee] bg-white" data-testid={`issues-${tone}`}>
      <h4 className="flex flex-wrap items-center gap-2 border-b border-[#e4e8ee] px-3 py-2 text-sm font-semibold text-[#091c3c]">
        {title}
        <Badge variant={tone}>{issues.length}</Badge>
      </h4>
      <div className="max-h-80 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Row</TableHead>
              <TableHead scope="col">Column</TableHead>
              <TableHead scope="col">Code</TableHead>
              <TableHead scope="col">Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((i, n) => (
              <TableRow key={n}>
                <TableCell className="whitespace-nowrap tabular-nums">{i.row}</TableCell>
                <TableCell className="whitespace-nowrap">{i.column ?? '—'}</TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs">{i.code}</TableCell>
                <TableCell className="min-w-[16rem] break-words">{i.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {truncated && <p className="border-t border-[#e4e8ee] px-3 py-2 text-xs text-gray-600">Only the first {issues.length} are listed. The counts above cover every row.</p>}
    </section>
  )
}

/** The dry-run (or committed) import report: counts, per-code totals, notices, errors and warnings. */
export function ImportReportView({ report }: { report: ImportReport }) {
  const codes = Object.entries(report.counts_by_code)
  return (
    <div className="space-y-3" data-testid="import-report">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ['Rows', report.row_count],
          ['Will import', report.accepted_count],
          ['Rejected', report.rejected_count],
          ['Errors', report.error_count],
          ['Warnings', report.warning_count],
        ].map(([label, n]) => (
          <div key={label as string} className="rounded-lg bg-[#f7f9fc] px-3 py-2">
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="font-display text-lg font-semibold text-[#091c3c]" data-testid={`count-${(label as string).toLowerCase().replace(/ /g, '-')}`}>{n}</dd>
          </div>
        ))}
      </dl>

      {report.already_imported_batch_id != null && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="already-imported">
          This exact file is already imported as batch #{report.already_imported_batch_id}. Void that batch first if you need to import it again.
        </p>
      )}

      {report.notices.map((n) => (
        <p key={n.code} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {n.message} ({n.rows} {n.rows === 1 ? 'row' : 'rows'}: {n.columns.join(', ')})
        </p>
      ))}

      {codes.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Counts by code">
          {codes.map(([code, n]) => (
            <li key={code} className="rounded-full bg-[#f7f9fc] px-3 py-1 text-xs text-gray-700">
              {humanize(code)}: <span className="font-semibold">{n}</span>
            </li>
          ))}
        </ul>
      )}

      <IssueTable title="Errors (these rows are skipped)" issues={report.errors} truncated={report.errors_truncated} tone="red" />
      <IssueTable title="Warnings (these rows are still imported)" issues={report.warnings} truncated={report.warnings_truncated} tone="amber" />
    </div>
  )
}
