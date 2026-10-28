'use client'

import { formatGrouped } from '@/lib/money'
import { kwpText } from '@/lib/studio/logic'
import type { StudioFigures } from '@/lib/studio/types'
import { Money } from './ui'

// What the proposal will print, exactly as the API worked it out (`figures`). Shown, never
// calculated: no sum, difference or percentage is formed here.

function Row({ label, children, strong, testId }: { label: string; children: React.ReactNode; strong?: boolean; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5" data-testid={testId}>
      <dt className={`font-utility text-sm ${strong ? 'font-semibold text-[#091c3c]' : 'text-[#111827]/70'}`}>{label}</dt>
      <dd className={`text-right font-utility ${strong ? 'text-lg font-bold text-[#091c3c]' : 'text-sm text-[#111827]'}`}>{children}</dd>
    </div>
  )
}

export function FiguresSummary({ figures, compact }: { figures: StudioFigures; compact?: boolean }) {
  const f = figures
  const subsidy = f.subsidy?.applies ? f.subsidy : null
  if (!f.total) {
    return (
      <div className="rounded-xl border border-dashed border-[#d5dbe4] p-4 font-utility text-sm text-[#111827]/60" data-testid="figures-summary">
        No price yet — the figures appear here as soon as one is set.
      </div>
    )
  }
  return (
    <section aria-label="The figures on the proposal" className="rounded-xl border border-[#e4e8ee] bg-white p-4" data-testid="figures-summary">
      <h3 className="mb-1 font-display text-base font-semibold text-[#091c3c]">On the proposal{f.capacity_kwp ? ` · ${kwpText(f.capacity_kwp)}` : ''}</h3>
      <dl className="divide-y divide-[#eef1f5]">
        {f.discount && (
          <>
            <Row label="Price before discount">
              <Money value={f.discount.price_before_discount} />
            </Row>
            <Row label={`Discount — ${f.discount.reason}`}>
              − <Money value={f.discount.amount} />
            </Row>
          </>
        )}
        <Row label="Basic price" testId="fig-basic">
          <Money value={f.basic} />
        </Row>
        <Row label="GST" testId="fig-gst">
          <Money value={f.gst} />
        </Row>
        <Row label="Total incl. GST" strong testId="fig-total">
          <Money value={f.total} />
        </Row>
      </dl>
      {f.words?.total && <p className="mt-1 font-utility text-xs italic text-[#111827]/65" data-testid="fig-words">{f.words.total}</p>}

      {subsidy && (
        <dl className="mt-3 divide-y divide-[#eef1f5] rounded-lg bg-green-50 px-3">
          <Row label={subsidy.kind === 'housing_society' ? 'Society subsidy (CFA)' : 'PM Surya Ghar subsidy'} testId="fig-subsidy">
            <Money value={subsidy.total} />
          </Row>
          <Row label="Cost after subsidy" strong testId="fig-effective">
            <Money value={subsidy.effective_cost} />
          </Row>
        </dl>
      )}

      {!compact && f.payments?.length > 0 && (
        <div className="mt-4">
          <h4 className="font-utility text-xs font-semibold uppercase tracking-wide text-[#111827]/55">Payment milestones</h4>
          <ol className="mt-1 divide-y divide-[#eef1f5]" data-testid="fig-payments">
            {f.payments.map((p, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-1.5 font-utility text-sm">
                <span className="text-[#111827]/80">
                  {p.percent}% — {p.short_label || p.label}
                </span>
                <Money value={p.amount} />
              </li>
            ))}
          </ol>
        </div>
      )}

      {!compact && f.gst_groups && f.gst_groups.length > 0 && (
        <div className="mt-4">
          <h4 className="font-utility text-xs font-semibold uppercase tracking-wide text-[#111827]/55">GST by rate</h4>
          <ul className="mt-1 font-utility text-sm">
            {f.gst_groups.map((g) => (
              <li key={g.rate} className="flex justify-between py-1">
                <span>
                  {g.percent}% on <Money value={g.taxable} />
                </span>
                <Money value={g.gst} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && f.savings && (
        <div className="mt-4 rounded-lg bg-[#f7f9fc] p-3" data-testid="fig-savings">
          <h4 className="font-utility text-xs font-semibold uppercase tracking-wide text-[#111827]/55">Savings page</h4>
          <dl className="mt-1">
            <Row label="First-year savings">
              <Money value={f.savings.year1_savings} />
            </Row>
            <Row label="Savings over 25 years">
              <Money value={f.savings.total_savings_25_years} />
            </Row>
            <Row label="Pays for itself in">{f.savings.payback_years ? `${f.savings.payback_years} years` : '—'}</Row>
            <Row label="First-year generation">{f.savings.year1_generation_units ? `${formatGrouped(f.savings.year1_generation_units)} units` : '—'}</Row>
          </dl>
        </div>
      )}

      {!compact && f.package_comparison && f.package_comparison.length > 0 && (
        <div className="mt-4">
          <h4 className="font-utility text-xs font-semibold uppercase tracking-wide text-[#111827]/55">Package comparison</h4>
          <ul className="mt-1 divide-y divide-[#eef1f5] font-utility text-sm" data-testid="fig-packages">
            {f.package_comparison.map((c) => (
              <li key={c.package} className="flex justify-between py-1.5">
                <span>
                  {c.name}
                  {c.chosen && <span className="ml-1.5 rounded-full bg-[#0e2a63] px-1.5 py-0.5 text-[10px] text-white">chosen</span>}
                </span>
                <Money value={c.total} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
