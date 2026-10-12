'use client'

import { CheckCircle2, CircleDashed, Loader2 } from 'lucide-react'
import Link from '@/components/i18n/Link'
import { useMessages } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/types'
import { isMissingClaimsError } from '@/lib/dashboard/api-error'
import { useSurveyResults, useSurveyStatus } from '@/lib/associate/survey-api-client'
import { formatKw } from '@/lib/associate/survey'
import { MissingClaimsNotice } from '@/components/dashboard/DashboardError'

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-utility ${ok ? 'bg-[#0e2a63]/10 text-[#0e2a63]' : 'bg-amber-100 text-amber-900'}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </li>
  )
}

/**
 * Compact survey summary on a customer's detail page: status, signatures and
 * the suggested size — never a price. The owner gets a link back into the
 * survey; a territory Preferred Associate only reads it (signing is owner-only).
 */
export default function SurveyCard({ onboardingId, isOwner, editHref }: { onboardingId: number; isOwner: boolean; editHref?: string }) {
  const t = useMessages('survey')
  const c = t.card
  const status = useSurveyStatus(onboardingId)
  const results = useSurveyResults(onboardingId, !!status.data)

  return (
    <div className="rounded-2xl border border-[#e4e8ee] bg-white p-5" data-testid="survey-card">
      <p className="font-display text-base font-semibold text-[#0e2a63]">{c.title}</p>
      {status.isLoading ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-[#111827]/60" role="status">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t.status.loading}
        </p>
      ) : isMissingClaimsError(status.error) ? (
        <div className="mt-2">
          <MissingClaimsNotice />
        </div>
      ) : status.error || !status.data ? (
        <div className="mt-2" role="alert">
          <p className="text-sm text-red-700">{t.status.loadError}</p>
          <button type="button" onClick={() => void status.refetch()} className="min-h-[44px] text-sm font-semibold text-[#0e2a63] underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]">
            {t.status.retry}
          </button>
        </div>
      ) : (
        <>
          {(status.data.grandfathered || !status.data.required_to_submit) && (
            <p className="mt-1 text-sm text-[#111827]/65" data-testid="survey-card-not-required">
              {c.notRequired}
            </p>
          )}
          <ul className="mt-3 flex flex-wrap gap-2">
            <Pill ok={status.data.complete}>{status.data.complete ? c.complete : c.incomplete}</Pill>
            <Pill ok={status.data.signatures.customer.signed}>{status.data.signatures.customer.signed ? c.customerSigned : c.customerUnsigned}</Pill>
            <Pill ok={status.data.signatures.associate.signed}>{status.data.signatures.associate.signed ? c.associateSigned : c.associateUnsigned}</Pill>
          </ul>
          {results.data && (
            <p className="mt-3 text-sm text-[#111827]/80" data-testid="survey-card-kw">
              {c.suggestedLabel}:{' '}
              <span className="font-semibold text-[#0e2a63]">{results.data.suggested_kw == null ? '—' : fmt(t.results.kw, { kw: formatKw(results.data.suggested_kw) })}</span>
            </p>
          )}
          {isOwner && editHref ? (
            <Link
              href={editHref}
              className="mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-[#0e2a63] px-4 text-sm font-semibold text-[#0e2a63] font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]"
            >
              {c.continue}
            </Link>
          ) : !isOwner ? (
            <p className="mt-3 text-xs text-[#111827]/60">{c.readOnlyNote}</p>
          ) : null}
        </>
      )}
    </div>
  )
}
