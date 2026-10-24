import Image from 'next/image'
import { CheckCircle2, Clock, Download, FileX2 } from 'lucide-react'
import headerLogo from '@/public/brand/header-logo.webp'
import { API_BASE_URL } from '@/lib/config'
import { acceptPdfPath, acceptTotalInWords, type AcceptScreen, type AcceptView } from '@/lib/proposal-accept'
import { formatCurrency, formatDate } from '@/lib/dashboard/utils'
import { formatInr } from '@/lib/money'
import type { AcceptDocument } from '@/lib/proposals/document-types'
import { RetryButton } from './RetryButton'

// Presentational pieces for the customer-facing accept page. No hooks: these
// render on the server, so the customer sees the proposal in the first HTML.

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100svh] bg-[#f4f6fa] flex flex-col">
      {/* Brand band */}
      <div className="bg-[#091c3c]">
        <div className="mx-auto max-w-[680px] px-4 sm:px-6 py-5 flex items-center">
          <span className="inline-flex bg-white/95 rounded-xl px-3 py-1.5 shadow-sm">
            <Image src={headerLogo} alt="Grid Nova Energy" width={115} height={30} className="h-7 w-auto" loading="eager" fetchPriority="high" />
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 sm:px-6 py-10 md:py-16">
        <div className="w-full max-w-[560px]">{children}</div>
      </div>

      <footer className="mx-auto max-w-[680px] w-full px-4 sm:px-6 pb-8 text-center">
        <p className="font-utility text-xs text-[#111827]/65">
          © {new Date().getFullYear()} Grid Nova Energy · Kolkata, West Bengal
        </p>
      </footer>
    </main>
  )
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e4e8ee] bg-white p-6 md:p-9 shadow-[0_20px_60px_-24px_rgba(9,28,60,0.25)]">
      {children}
    </div>
  )
}

const ContactLine = ({ prefix = 'Questions? Email' }: { prefix?: string }) => (
  <p className="mt-6 font-utility text-xs text-[#111827]/65">
    {prefix}{' '}
    <a href="mailto:info@gridnova.in" className="text-[#0e2a63] font-medium hover:underline focus-visible:outline-2 focus-visible:outline-[#f7a800]">
      info@gridnova.in
    </a>
  </p>
)

export function PdfLink({ token }: { token: string }) {
  return (
    <a
      href={`${API_BASE_URL}${acceptPdfPath(token)}`}
      className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#e4e8ee] text-[#0e2a63] font-utility font-semibold text-sm px-6 py-3 min-h-11 hover:bg-[#f7f9fc] transition-colors focus-visible:outline-2 focus-visible:outline-[#f7a800]"
    >
      <Download className="h-4 w-4" /> Download proposal (PDF)
    </a>
  )
}

// Plain-language messages for the screens that carry no proposal data. The
// reverification copy deliberately says nothing about *what* is being re-checked.
const MESSAGES: Record<
  'notfound' | 'error' | 'superseded' | 'unavailable' | 'reverification' | 'expired',
  { icon: 'file' | 'clock'; title: string; body: string }
> = {
  notfound: {
    icon: 'file',
    title: 'Proposal not found',
    body: 'This proposal link is invalid or is no longer active. If you believe this is a mistake, please contact our team.',
  },
  error: {
    icon: 'file',
    title: 'Something went wrong',
    body: 'We had trouble loading this proposal. Please try again shortly.',
  },
  superseded: {
    icon: 'file',
    title: 'A newer proposal replaces this one',
    body: 'This proposal has been replaced by a newer version, so it can no longer be accepted from this link. Please contact our team and we will send you the latest one.',
  },
  unavailable: {
    icon: 'file',
    title: 'This proposal is not open for acceptance',
    body: 'This proposal is not available to accept right now. Please contact our team if you have any questions.',
  },
  reverification: {
    icon: 'clock',
    title: 'We are re-checking this proposal',
    body: 'Our team is double-checking this proposal, so it cannot be accepted right now. We will be in touch shortly — you do not need to do anything.',
  },
  expired: {
    icon: 'clock',
    title: 'This proposal has expired',
    body: 'The validity window for this proposal has passed. Please reach out and we’ll be glad to prepare an updated quote.',
  },
}

export function MessageScreen({ screen }: { screen: keyof typeof MESSAGES }) {
  const m = MESSAGES[screen]
  const Icon = m.icon === 'clock' ? Clock : FileX2
  return (
    <Shell>
      <Card>
        <Icon className="h-10 w-10 text-[#111827]/65" aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-semibold text-[#091c3c]">{m.title}</h1>
        <p className="mt-2 font-utility text-sm text-[#111827]/60 leading-relaxed">{m.body}</p>
        {screen === 'error' && <RetryButton />}
        <ContactLine prefix={screen === 'expired' ? 'Email' : 'Questions? Email'} />
      </Card>
    </Shell>
  )
}

export function isMessageScreen(screen: AcceptScreen): screen is keyof typeof MESSAGES {
  return screen in MESSAGES
}

const LAYOUT_NAME: Record<string, string> = { compact: 'Compact', detailed: 'Detailed' }

/**
 * The figures printed on the customer's PDF (BE-13), exactly as the backend sent
 * them: nothing is added up or rounded here. Subsidy lines only when it applies.
 */
export function DocumentSummary({ doc }: { doc: AcceptDocument }) {
  const words = acceptTotalInWords(doc)
  const subsidy = doc.subsidy?.applies ? doc.subsidy : null
  return (
    <div className="mt-6 space-y-5" data-testid="accept-document">
      <dl className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 font-utility text-sm">
        <div>
          <dt className="text-xs text-[#111827]/65 uppercase tracking-wider">Reference</dt>
          <dd className="mt-0.5 font-medium text-[#091c3c]">{doc.reference ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#111827]/65 uppercase tracking-wider">Date</dt>
          <dd className="mt-0.5 font-medium text-[#091c3c]">{doc.date ? formatDate(doc.date) : '—'}</dd>
        </div>
        {doc.capacity_kwp && (
          <div>
            <dt className="text-xs text-[#111827]/65 uppercase tracking-wider">Plant</dt>
            <dd className="mt-0.5 font-medium text-[#091c3c]">{doc.capacity_kwp} kWp grid-tied solar plant</dd>
          </div>
        )}
        {doc.layout && (
          <div>
            <dt className="text-xs text-[#111827]/65 uppercase tracking-wider">Proposal</dt>
            <dd className="mt-0.5 font-medium text-[#091c3c]">{LAYOUT_NAME[doc.layout] ?? doc.layout}</dd>
          </div>
        )}
      </dl>

      <div className="rounded-xl bg-[#f7f9fc] border border-[#e4e8ee] p-4">
        <dl className="space-y-1 font-utility text-sm">
          <div className="flex justify-between gap-3"><dt className="text-[#111827]/65">Basic price</dt><dd>{formatInr(doc.basic)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[#111827]/65">GST</dt><dd>{formatInr(doc.gst)}</dd></div>
          <div className="flex justify-between gap-3 border-t border-[#e4e8ee] pt-1 font-semibold text-[#091c3c]"><dt>Total incl. GST</dt><dd data-testid="accept-total">{formatInr(doc.total)}</dd></div>
        </dl>
        {words && <p className="mt-2 font-utility text-xs text-[#111827]/70">{words}</p>}
      </div>

      {doc.payments && doc.payments.length > 0 && (
        <div>
          <p className="font-utility text-xs font-semibold uppercase tracking-wider text-[#111827]/65">Payment schedule</p>
          <ul className="mt-2 space-y-1 font-utility text-sm">
            {doc.payments.map((p, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{p.percent}% — {p.label}</span>
                <span className="font-medium">{formatInr(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {subsidy && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4" data-testid="accept-subsidy">
          <p className="font-utility text-xs font-semibold uppercase tracking-wider text-emerald-900">PM Surya Ghar subsidy</p>
          <dl className="mt-2 space-y-1 font-utility text-sm">
            <div className="flex justify-between gap-3"><dt>Subsidy</dt><dd>{formatInr(subsidy.total)}</dd></div>
            <div className="flex justify-between gap-3 font-semibold text-[#091c3c]"><dt>Your effective cost</dt><dd>{formatInr(subsidy.effective_cost)}</dd></div>
          </dl>
        </div>
      )}

      {doc.customer_scope && doc.customer_scope.length > 0 && (
        <div>
          <p className="font-utility text-xs font-semibold uppercase tracking-wider text-[#111827]/65">Customer scope</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 font-utility text-sm text-[#111827] leading-relaxed">
            {doc.customer_scope.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

export function AcceptedBody({ view, token }: { view: AcceptView | null; token: string }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden="true" />
        <h1 className="font-display text-2xl font-semibold text-[#091c3c]">Proposal accepted</h1>
      </div>
      <p className="mt-3 font-utility text-sm text-[#111827]/65 leading-relaxed">
        Thank you{view?.customerName ? `, ${view.customerName}` : ''} — your acceptance has been recorded and our
        team has been notified. We’ll be in touch shortly with the next steps.
      </p>
      {view?.acceptedAt && (
        <p className="mt-4 font-utility text-xs text-[#111827]/65">Accepted on {formatDate(view.acceptedAt)}</p>
      )}
      {view?.document ? (
        <DocumentSummary doc={view.document} />
      ) : view?.totalValue != null && (
        <div className="mt-6 rounded-xl bg-[#f7f9fc] border border-[#e4e8ee] p-4 flex items-center justify-between">
          <span className="font-utility text-sm text-[#111827]/60">Accepted value</span>
          <span className="font-display text-lg font-bold text-[#091c3c]">{formatCurrency(view.totalValue)}</span>
        </div>
      )}
      {view?.pdfAvailable && <PdfLink token={token} />}
      <ContactLine />
    </Card>
  )
}
