'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { studioApi, useStudioToken } from '@/lib/studio/api'
import { studioError } from '@/lib/studio/logic'
import type { ImportCreated, ImportError } from '@/lib/studio/types'
import { Notice, Panel } from './ui'

// Many proposals at once from Grid Nova's Excel sheet: one draft per filled "Proposal…"
// sheet. All or nothing — any error and nothing is created; every error names its cell.

const MAX_BYTES = 2 * 1024 * 1024

export default function Import() {
  const token = useStudioToken()
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [created, setCreated] = useState<ImportCreated[] | null>(null)
  const [errors, setErrors] = useState<ImportError[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const wrongType = !!file && !/\.xlsx$/i.test(file.name)
  const tooBig = !!file && file.size > MAX_BYTES

  async function upload() {
    if (!file) return
    setProgress(0)
    setCreated(null)
    setErrors(null)
    setMessage(null)
    try {
      const res = await studioApi.importSheet(token, file)
      setCreated(res.created)
      void qc.invalidateQueries({ queryKey: ['studio'] })
    } catch (e) {
      const info = studioError(e)
      const list = Array.isArray(info.detail.errors) ? (info.detail.errors as ImportError[]) : null
      setErrors(list)
      setMessage(info.message)
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">Import from Excel</h1>
        <p className="mt-1 font-utility text-sm text-[#111827]/65">Fill Grid Nova’s sheet — one sheet per proposal — and upload it. Each becomes a draft you can check and issue.</p>
      </div>

      <Panel title="1. Get the sheet">
        <p className="mb-3 font-utility text-sm text-[#111827]/75">It has a “Read me”, a blank “Proposal” sheet with drop-downs, and a filled “Example”. Copy the Proposal sheet for each customer (keep the name starting with “Proposal”).</p>
        <Button type="button" variant="outline" className="min-h-11" disabled={downloading} onClick={async () => {
          setDownloading(true)
          try {
            await studioApi.downloadImportTemplate(token)
          } catch (e) {
            setMessage(studioError(e).message)
          } finally {
            setDownloading(false)
          }
        }} data-testid="download-template">
          {downloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />} Download the Excel sheet
        </Button>
      </Panel>

      <Panel title="2. Upload it">
        <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" id="import-file" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setCreated(null); setErrors(null); setMessage(null) }} data-testid="import-file" />
        <label htmlFor="import-file" className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#d5dbe4] bg-[#f7f9fc] p-4 text-center hover:border-[#2f5daa]">
          <FileSpreadsheet className="h-6 w-6 text-[#0e2a63]" aria-hidden="true" />
          <span className="font-utility text-sm font-medium text-[#091c3c]">{file ? file.name : 'Choose the filled .xlsx file'}</span>
          <span className="font-utility text-xs text-[#111827]/60">Excel (.xlsx), at most 2 MB, no macros</span>
        </label>
        {wrongType && <p role="alert" className="mt-2 font-utility text-xs text-red-700">Choose an Excel .xlsx file.</p>}
        {tooBig && <p role="alert" className="mt-2 font-utility text-xs text-red-700">The file is larger than 2 MB.</p>}
        <Button type="button" className="mt-3 min-h-11" disabled={!file || wrongType || tooBig || progress !== null} onClick={() => void upload()} data-testid="import-upload">
          {progress !== null ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
          {progress !== null ? 'Importing…' : 'Import'}
        </Button>
      </Panel>

      {created && (
        <Panel title={`${created.length} draft${created.length === 1 ? '' : 's'} created`}>
          <ul className="divide-y divide-[#eef1f5]" data-testid="import-created">
            {created.map((c) => (
              <li key={c.proposal_id} className="flex flex-wrap items-center gap-2 py-2">
                <Link href={`/dashboard/studio/proposals/${c.proposal_id}`} className="font-utility text-sm font-medium text-[#0e2a63] hover:underline">{c.code}</Link>
                <span className="font-utility text-sm text-[#111827]/75">{c.title}</span>
                {c.duplicate_customers.length > 0 && <span className="rounded bg-amber-100 px-1.5 font-utility text-xs text-amber-800">customer may already exist</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {message && <Notice tone="error" testId="import-message">{message}</Notice>}
      {errors && errors.length > 0 && (
        <Panel title="Fix these cells, then upload again">
          <div className="overflow-x-auto">
            <table className="w-full font-utility text-sm" data-testid="import-errors">
              <thead>
                <tr className="text-left text-xs text-[#111827]/60">
                  <th className="py-1 pr-3 font-medium">Sheet</th>
                  <th className="py-1 pr-3 font-medium">Cell</th>
                  <th className="py-1 pr-3 font-medium">What</th>
                  <th className="py-1 font-medium">Problem</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e, i) => (
                  <tr key={i} className="border-t border-[#eef1f5] align-top">
                    <td className="py-1.5 pr-3">{e.sheet}</td>
                    <td className="py-1.5 pr-3 font-mono font-semibold">{e.cell}</td>
                    <td className="py-1.5 pr-3">{e.field}</td>
                    <td className="py-1.5 text-red-800">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  )
}
