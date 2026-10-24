'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useAuth } from '@clerk/nextjs'
import { AlertCircle, Download, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTokenOrThrow } from '@/lib/api/http'
import { documentError, type DocumentErrorInfo } from '@/lib/proposals/document-logic'
import { fetchPreviewPdf } from '@/lib/proposals/document-api-client'

// Renders GET …/preview.pdf of the SAVED draft (never what is typed but not
// saved). The PDF is fetched with the staff token and shown from a blob URL,
// which is revoked whenever it is replaced or the pane unmounts.

export const PREVIEW_DEBOUNCE_MS = 800
const RATE_LIMIT_RETRY_S = 5
// Inline frame from tablet width up; phones get an "Open preview" button.
const INLINE_QUERY = '(min-width: 768px)'

function subscribe(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(INLINE_QUERY)
  mq.addEventListener?.('change', cb)
  return () => mq.removeEventListener?.('change', cb)
}

export function useInlinePreview(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(INLINE_QUERY).matches : true),
    () => true,
  )
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error'; info: DocumentErrorInfo }

export function ProposalPreview({
  proposalId,
  refreshKey,
  approved,
  onMissing,
}: {
  proposalId: number
  /** Changes after each successful save (the document revision); triggers a debounced re-render. */
  refreshKey: string | number
  approved: boolean
  /** 409 missing_required on the preview (no price yet) — the list goes to the editor's links. */
  onMissing?: (missing: DocumentErrorInfo['missing']) => void
}) {
  const { getToken } = useAuth()
  const inline = useInlinePreview()
  const [state, setState] = useState<State>({ status: 'idle' })
  const urlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [retryIn, setRetryIn] = useState(0)
  // Refs, so a new callback identity (from the parent, or a getToken that is not
  // memoised) never re-triggers a render of the PDF — only a save does.
  const onMissingRef = useRef(onMissing)
  const getTokenRef = useRef(getToken)
  useEffect(() => {
    onMissingRef.current = onMissing
    getTokenRef.current = getToken
  }, [onMissing, getToken])

  const replaceUrl = (next: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = next
  }

  const load = useCallback(async (): Promise<string | null> => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState({ status: 'loading' })
    try {
      const token = await getTokenOrThrow(() => getTokenRef.current())
      const blob = await fetchPreviewPdf(proposalId, token, ctrl.signal)
      if (ctrl.signal.aborted) return null
      const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'application/pdf' }))
      replaceUrl(url)
      setState({ status: 'ready', url })
      return url
    } catch (err) {
      if (ctrl.signal.aborted) return null
      const info = documentError(err)
      if (info.code === 'missing_required') onMissingRef.current?.(info.missing)
      if (info.code === 'rate_limited') setRetryIn(info.retryAfterSeconds ?? RATE_LIMIT_RETRY_S)
      setState({ status: 'error', info })
      return null
    }
  }, [proposalId])

  // Debounced refresh after each save; inline only (phones fetch on demand).
  useEffect(() => {
    if (!inline) return
    const t = setTimeout(() => void load(), PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [inline, load, refreshKey])

  // 429: count down, then try once more.
  useEffect(() => {
    if (retryIn <= 0) return
    const t = setTimeout(() => {
      if (retryIn === 1 && inline) void load()
      setRetryIn((s) => s - 1)
    }, 1000)
    return () => clearTimeout(t)
  }, [retryIn, inline, load])

  useEffect(
    () => () => {
      abortRef.current?.abort()
      replaceUrl(null)
    },
    [],
  )

  async function openInTab() {
    // Open the tab inside the click (pop-up blockers), then point it at the PDF.
    const win = window.open('', '_blank')
    const url = state.status === 'ready' ? state.url : await load()
    if (url && win) win.location.href = url
    else win?.close()
  }

  const filename = `proposal-${proposalId}${approved ? '' : '-draft'}.pdf`
  const title = approved ? 'Customer PDF' : 'Draft preview'

  return (
    <section aria-label={title} className="rounded-xl border border-[#e4e8ee] bg-white" data-testid="proposal-preview">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e8ee] px-4 py-3">
        <div>
          <h3 className="font-display text-base font-semibold text-[#091c3c]">{title}</h3>
          <p className="font-utility text-xs text-[#111827]/60">
            {approved ? 'Exactly what the customer receives.' : 'The saved draft, with the “DRAFT — NOT FOR CUSTOMER” stamp. Unsaved changes are not shown.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {inline && (
            <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void load()} disabled={state.status === 'loading' || retryIn > 0}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          )}
          {state.status === 'ready' && (
            <a
              href={state.url}
              download={filename}
              className="inline-flex min-h-11 items-center rounded-lg border border-[#e4e8ee] px-3 font-utility text-sm font-medium text-[#0e2a63] hover:bg-[#f7f9fc]"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download
            </a>
          )}
        </div>
      </header>

      <div className="p-3">
        {state.status === 'error' && (
          <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 font-utility text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p>
                {state.info.code === 'missing_required'
                  ? 'The preview appears once the proposal has a price.'
                  : state.info.code === 'rate_limited'
                    ? retryIn > 0
                      ? `Too many previews in a minute — trying again in ${retryIn} s.`
                      : 'Too many previews in a minute — try again in a few seconds.'
                    : state.info.message}
              </p>
            </div>
          </div>
        )}

        {inline ? (
          <div className="relative h-[70vh] min-h-[480px] overflow-hidden rounded-lg border border-[#e4e8ee] bg-[#f4f6fa]">
            {state.status === 'ready' && (
              <iframe key={state.url} src={state.url} title={`${title} of proposal ${proposalId}`} className="h-full w-full" />
            )}
            {state.status === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/70 font-utility text-sm text-[#111827]/70">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Rendering the PDF…
              </div>
            )}
          </div>
        ) : (
          <Button type="button" className="min-h-11 w-full" onClick={() => void openInTab()} disabled={state.status === 'loading'}>
            {state.status === 'loading' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-1.5 h-4 w-4" />} Open preview
          </Button>
        )}
        <p className="mt-2 font-utility text-[11px] text-[#111827]/55">Use the PDF viewer’s own controls to move between pages and zoom.</p>
      </div>
    </section>
  )
}
