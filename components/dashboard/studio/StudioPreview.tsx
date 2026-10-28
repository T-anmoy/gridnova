'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AlertCircle, Download, FileText, Loader2, Maximize2, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/dashboard/utils'
import { useInlinePreview } from '@/components/dashboard/proposal-document/ProposalPreview'
import { studioApi, useStudioToken } from '@/lib/studio/api'
import { studioError } from '@/lib/studio/logic'

// GET …/preview.pdf of the SAVED draft, re-rendered a moment after each save (the document
// revision changes). Shown from a blob URL that is revoked when replaced. Pages are reached
// with the PDF viewer's #page= fragment; the page count is read from the file itself. Phones
// open the preview in a full-height sheet.

export const STUDIO_PREVIEW_DEBOUNCE_MS = 1200
const RETRY_AFTER_S = 5

/** Pages in a PDF, counted from its /Type /Page objects; null when the file hides them. */
export function countPdfPages(bytes: Uint8Array): number | null {
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  const n = (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length
  return n > 0 ? n : null
}

type State = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; url: string; pages: number | null } | { status: 'error'; message: string; code: string | null }

export function StudioPreview({
  proposalId,
  version,
  refreshKey,
  issued,
  className,
}: {
  proposalId: number
  version?: number
  /** Changes after every save (the document revision). */
  refreshKey: string | number
  issued?: boolean
  className?: string
}) {
  const token = useStudioToken()
  const tokenRef = useRef(token)
  useEffect(() => {
    tokenRef.current = token
  })
  const inline = useInlinePreview()
  const [state, setState] = useState<State>({ status: 'idle' })
  const [page, setPage] = useState(1)
  const [full, setFull] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [retryIn, setRetryIn] = useState(0)
  const urlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState({ status: 'loading' })
    try {
      const blob = await studioApi.previewPdf(() => tokenRef.current(), proposalId, version, ctrl.signal)
      if (ctrl.signal.aborted) return
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = url
      const pages = countPdfPages(bytes)
      setPage((p) => (pages && p > pages ? 1 : p))
      setState({ status: 'ready', url, pages })
    } catch (e) {
      if (ctrl.signal.aborted) return
      const info = studioError(e)
      if (info.code === 'rate_limited') setRetryIn(RETRY_AFTER_S)
      setState({
        status: 'error',
        code: info.code,
        message: info.code === 'missing_required' ? 'The preview appears once the proposal has a price (step “Price”).' : info.message,
      })
    }
  }, [proposalId, version])

  const visible = inline || sheet
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => void load(), STUDIO_PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [visible, load, refreshKey])

  useEffect(() => {
    if (retryIn <= 0) return
    const t = setTimeout(() => {
      if (retryIn === 1) void load()
      setRetryIn((s) => s - 1)
    }, 1000)
    return () => clearTimeout(t)
  }, [retryIn, load])

  useEffect(
    () => () => {
      abortRef.current?.abort()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  const title = issued ? 'Issued version' : 'Live preview'
  const src = state.status === 'ready' ? `${state.url}#page=${page}&view=FitH` : null

  const frame = (tall: string) => (
    <div className={cn('relative overflow-hidden rounded-lg border border-[#e4e8ee] bg-[#eef1f5]', tall)}>
      {src && <iframe key={src} src={src} title={`${title} of proposal ${proposalId}`} className="h-full w-full" data-testid="preview-frame" />}
      {state.status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/70 font-utility text-sm text-[#111827]/70">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Making the PDF…
        </div>
      )}
      {state.status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <p role="alert" className="flex max-w-xs items-start gap-2 font-utility text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {state.code === 'rate_limited' && retryIn > 0 ? `Too many previews in a minute — trying again in ${retryIn} s.` : state.message}
          </p>
        </div>
      )}
    </div>
  )

  const pageStrip =
    state.status === 'ready' && state.pages && state.pages > 1 ? (
      <nav aria-label="Pages" className="flex flex-wrap gap-1.5" data-testid="preview-pages">
        {Array.from({ length: state.pages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPage(n)}
            aria-current={page === n ? 'page' : undefined}
            aria-label={`Page ${n}`}
            className={cn(
              'flex h-11 w-9 flex-col items-center justify-center rounded border font-utility text-[11px] md:h-12',
              page === n ? 'border-[#0e2a63] bg-[#0e2a63] text-white' : 'border-[#d5dbe4] bg-white text-[#0e2a63] hover:border-[#0e2a63]',
            )}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {n}
          </button>
        ))}
      </nav>
    ) : null

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={state.status === 'loading' || retryIn > 0}>
        <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
      </Button>
      {state.status === 'ready' && (
        <a
          href={state.url}
          download={`proposal-${proposalId}${issued ? '' : '-draft'}.pdf`}
          className="inline-flex h-11 items-center rounded-md border border-[#e4e8ee] bg-white px-3 font-utility text-xs font-medium text-[#0e2a63] hover:bg-[#f7f9fc] md:h-8"
        >
          <Download className="mr-1 h-3.5 w-3.5" /> Download
        </a>
      )}
    </div>
  )

  return (
    <section aria-label={title} className={cn('rounded-xl border border-[#e4e8ee] bg-white', className)} data-testid="studio-preview">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e8ee] px-4 py-3">
        <div>
          <h2 className="font-display text-base font-semibold text-[#091c3c]">{title}</h2>
          <p className="font-utility text-xs text-[#111827]/60">{issued ? 'Drawn from the issued version. Use “Download PDF” for the customer’s own file.' :'Updates a moment after each change is saved. Stamped “DRAFT” until issued.'}</p>
        </div>
        {inline && (
          <div className="flex flex-wrap gap-2">
            {toolbar}
            <Button type="button" variant="outline" size="sm" onClick={() => setFull(true)} disabled={state.status !== 'ready'} data-testid="preview-full-screen">
              <Maximize2 className="mr-1 h-3.5 w-3.5" /> Full screen
            </Button>
          </div>
        )}
      </header>
      <div className="space-y-3 p-3">
        {inline ? (
          <>
            {pageStrip}
            {frame('h-[72vh] min-h-[480px]')}
          </>
        ) : (
          <Button type="button" className="min-h-11 w-full" onClick={() => setSheet(true)} data-testid="open-preview-sheet">
            <FileText className="mr-1.5 h-4 w-4" /> See the PDF
          </Button>
        )}
      </div>

      {/* Full screen (tablet and desktop) and the phone sheet share one dialog. */}
      <DialogPrimitive.Root open={full || sheet} onOpenChange={(o) => { if (!o) { setFull(false); setSheet(false) } }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 top-[env(safe-area-inset-top)] z-50 flex flex-col rounded-t-2xl bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:inset-4 md:rounded-2xl"
            data-testid="preview-dialog"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <DialogPrimitive.Title className="font-display text-base font-semibold text-[#091c3c]">{title}</DialogPrimitive.Title>
              <div className="flex items-center gap-2">
                {!inline && toolbar}
                <DialogPrimitive.Close className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[#f7f9fc]" aria-label="Close the preview">
                  <X className="h-5 w-5" />
                </DialogPrimitive.Close>
              </div>
            </div>
            {pageStrip && <div className="mb-2">{pageStrip}</div>}
            {frame('flex-1 min-h-0')}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </section>
  )
}
