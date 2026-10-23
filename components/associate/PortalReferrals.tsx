'use client'

import { useMemo, useState } from 'react'
import { Copy, Download, MessageCircle, Phone } from 'lucide-react'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { useLocale, useMessages } from '@/lib/i18n/client'
import { localizeHref } from '@/lib/i18n/config'
import { fmt, type Messages } from '@/lib/i18n/types'
import { SITE_URL } from '@/lib/seo'
import { indianWhatsappNumber, whatsappShareUrl, whatsappUrl } from '@/lib/contact'
import { formatDate } from '@/lib/dashboard/utils'
import { qrMatrix, qrPath, qrPngBlob } from '@/lib/associate/qr'
import { useReferralLink, useReferrals, type ReferralItem } from '@/lib/associate/referral-api-client'

type ReferralCopy = Messages['portalEase']['referral']

const PAGE_SIZE = 25
const BUTTON =
  'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 font-utility text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]'

/** The share_path from the server on the public site, in the viewer's language. */
export function absoluteShareUrl(sharePath: string, locale: ReturnType<typeof useLocale>): string {
  return `${SITE_URL}${localizeHref(sharePath, locale)}`
}

function QrCode({ url, label }: { url: string; label: string }) {
  const matrix = useMemo(() => qrMatrix(url), [url])
  const quiet = 4
  const size = matrix.length + quiet * 2
  return (
    <svg
      role="img"
      aria-label={label}
      data-testid="referral-qr"
      viewBox={`${-quiet} ${-quiet} ${size} ${size}`}
      shapeRendering="crispEdges"
      className="mx-auto h-56 w-56 rounded-xl bg-white"
    >
      <rect x={-quiet} y={-quiet} width={size} height={size} fill="#ffffff" />
      <path d={qrPath(matrix)} fill="#000000" />
    </svg>
  )
}

function LinkCard({ copy }: { copy: ReferralCopy }) {
  const locale = useLocale()
  const { data, error, isLoading, refetch } = useReferralLink()
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)

  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (isLoading || !data) return <div role="status" aria-busy="true" className="mt-6 h-80 animate-pulse rounded-2xl bg-[#eef1f6]" />

  const url = absoluteShareUrl(data.share_path, locale)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied('ok')
    } catch {
      setCopied('failed')
    }
  }

  async function downloadQr() {
    const blob = await qrPngBlob(qrMatrix(url))
    if (!blob) return
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `grid-nova-${data!.associate_id}-qr.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href)
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#e4e8ee] bg-white p-5" data-testid="referral-link-card">
      <QrCode url={url} label={copy.qrAlt} />
      <p className="mt-4 font-utility text-xs text-[#111827]/65">{copy.linkLabel}</p>
      <p className="mt-0.5 select-all break-all font-utility text-sm font-semibold text-[#0e2a63]" data-testid="referral-url">{url}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <a href={whatsappShareUrl(fmt(copy.shareText, { url }))} target="_blank" rel="noopener noreferrer" className={`${BUTTON} bg-[#0e2a63] text-white`}>
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> {copy.whatsapp}
        </a>
        <button type="button" onClick={() => void copyLink()} className={`${BUTTON} border border-[#e4e8ee] text-[#0e2a63]`}>
          <Copy className="h-4 w-4" aria-hidden="true" /> {copied === 'ok' ? copy.copied : copy.copy}
        </button>
        <button type="button" onClick={() => void downloadQr()} className={`${BUTTON} border border-[#e4e8ee] text-[#0e2a63]`}>
          <Download className="h-4 w-4" aria-hidden="true" /> {copy.downloadQr}
        </button>
      </div>
      <p role="status" className="mt-2 font-utility text-xs text-amber-800">{copied === 'failed' ? copy.copyFailed : ''}</p>
    </section>
  )
}

function ReferralRow({ item, copy }: { item: ReferralItem; copy: ReferralCopy }) {
  const mobile = item.customer_mobile
  const wa = indianWhatsappNumber(mobile)
  const place = [item.location, item.pin_code ? fmt(copy.pin, { pin: item.pin_code }) : null].filter(Boolean).join(' · ')
  return (
    <li className="rounded-2xl border border-[#e4e8ee] bg-white p-4" data-testid="referral-row">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-[#0e2a63]">{item.customer_name || '—'}</p>
          <p className="mt-0.5 font-utility text-xs text-[#111827]/65">{place || copy.noLocation}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#eef1f6] px-2.5 py-1 font-utility text-xs font-semibold text-[#0e2a63]">
          {copy.status[item.status] ?? item.status}
        </span>
      </div>
      <p className="mt-2 font-utility text-xs text-[#111827]/70">
        {copy.kind[item.enquiry_kind] ?? copy.kind.other} · {formatDate(item.created_at)}
      </p>
      {mobile ? (
        <div className="mt-3 flex gap-2">
          <a href={`tel:${wa ? `+${wa}` : mobile.replace(/[^\d+]/g, '')}`} className={`${BUTTON} border border-[#e4e8ee] text-[#0e2a63]`}>
            <Phone className="h-4 w-4" aria-hidden="true" /> {copy.callCustomer} {mobile}
          </a>
          {wa && (
            <a href={whatsappUrl(undefined, wa)} target="_blank" rel="noopener noreferrer" className={`${BUTTON} border border-[#e4e8ee] text-[#0e2a63]`}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> {copy.whatsappCustomer}
            </a>
          )}
        </div>
      ) : (
        <p className="mt-2 font-utility text-xs text-[#111827]/65">{copy.notShared}</p>
      )}
    </li>
  )
}

function ReferralPage({ page, copy, isLast, onMore }: { page: number; copy: ReferralCopy; isLast: boolean; onMore: () => void }) {
  const { data, error, isLoading, refetch } = useReferrals(page, PAGE_SIZE)
  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (isLoading || !data) return <div role="status" aria-busy="true" className="h-24 animate-pulse rounded-2xl bg-[#eef1f6]" />
  if (page === 1 && data.items.length === 0) {
    return <p className="rounded-2xl border border-dashed border-[#e4e8ee] bg-white p-6 text-center text-sm text-[#111827]/65">{copy.listEmpty}</p>
  }
  return (
    <>
      <ul className="space-y-3">
        {data.items.map((item) => (
          <ReferralRow key={item.lead_id} item={item} copy={copy} />
        ))}
      </ul>
      {isLast && page * data.page_size < data.total && (
        <button type="button" onClick={onMore} className={`${BUTTON} mt-3 border border-[#e4e8ee] text-[#0e2a63]`}>
          {copy.showMore}
        </button>
      )}
    </>
  )
}

/** "My link": the Associate's own referral link and QR, and the enquiries that came through it. */
export default function PortalReferrals() {
  const copy = useMessages('portalEase').referral
  const [pages, setPages] = useState(1)
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[#111827]/70">{copy.body}</p>
      <LinkCard copy={copy} />
      <p className="mt-3 font-utility text-xs text-[#111827]/65">{copy.attributionNote}</p>

      <h2 className="mt-8 font-display text-lg font-semibold text-[#0e2a63]">{copy.listTitle}</h2>
      <div className="mt-4 space-y-3">
        {Array.from({ length: pages }, (_, i) => (
          <ReferralPage key={i + 1} page={i + 1} copy={copy} isLast={i + 1 === pages} onMore={() => setPages((p) => p + 1)} />
        ))}
      </div>
    </div>
  )
}
