"use client";

import { Cpu, HardHat, Wrench, Building2, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { formatINR, type InstantEstimateResult } from "./lib";
import { useMessages } from "@/lib/i18n/client";

const CATEGORY_ICON: Record<string, React.ElementType> = {
  equipment: Cpu,
  installation: HardHat,
  balance_of_system: Wrench,
  civil: Building2,
  regulatory: ClipboardCheck,
};


function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: "gold" | "bold" }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="font-utility text-sm text-[#111827]/60">{label}</span>
      <span
        className={
          emphasis === "gold"
            ? "font-utility text-sm font-semibold text-[#b8790a]"
            : emphasis === "bold"
              ? "font-display text-base font-semibold text-[#0e2a63]"
              : "font-utility text-sm font-semibold text-[#0e2a63]"
        }
      >
        {value}
      </span>
    </div>
  );
}

// The exact same markup as EstimateReveal.tsx, minus CountUp — used as the
// <Suspense> fallback while that (gsap-dependent) chunk loads in, so there's
// no layout shift and the real numbers are correct even before the count-up
// animation is ready to take over.
export default function StaticEstimateReveal({ result }: { result: InstantEstimateResult }) {
  const {
    recommendedSizeKw,
    baseCost,
    accessDifficultyAdder,
    componentBreakdown,
    subtotalBeforeTax,
    gstAmount,
    subsidyInr,
    netCost,
    isIndicativeRange,
    netCostRangeMin,
    netCostRangeMax,
    note,
  } = result;
  const t = useMessages("calculator").reveal;
  // Category keys come from the pricing engine; unknown keys show as-is.
  const CATEGORY_LABEL: Record<string, string> = t.categories;

  return (
    <div>
      <div className="rounded-2xl bg-[#0e2a63] p-8 text-center">
        <p className="font-utility text-xs text-white/50 uppercase tracking-[0.12em]">
          {isIndicativeRange ? t.netRange : t.net}
        </p>
        {isIndicativeRange ? (
          <p className="mt-2 font-display text-white text-3xl md:text-4xl font-semibold">
            {formatINR(netCostRangeMin ?? 0)}
            <span className="mx-2 text-white/40">&ndash;</span>
            {formatINR(netCostRangeMax ?? 0)}
          </p>
        ) : (
          <p className="mt-2 font-display text-white text-4xl md:text-5xl font-semibold">
            {formatINR(netCost ?? 0)}
          </p>
        )}
        <p className="mt-3 font-utility text-xs text-white/60">
          {t.size} {recommendedSizeKw} kW
        </p>
      </div>

      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] px-4 py-3.5">
        <CheckCircle2 className="h-4 w-4 text-[#2f5daa] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-[#111827]/70 font-utility leading-relaxed">
          {t.equipmentNote}
        </p>
      </div>

      {isIndicativeRange && note && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <p className="text-sm text-amber-800 font-utility leading-relaxed">{note}</p>
        </div>
      )}

      <div className="mt-5 rounded-xl border border-[#e4e8ee] divide-y divide-[#e4e8ee]">
        <Row label={t.base} value={formatINR(baseCost)} />
        {accessDifficultyAdder > 0 && (
          <Row label={t.accessAdder} value={formatINR(accessDifficultyAdder)} />
        )}
        <Row label={t.subtotal} value={formatINR(subtotalBeforeTax)} />
        <Row label={t.gst} value={formatINR(gstAmount)} />
        <Row label={t.subsidy} value={`− ${formatINR(subsidyInr)}`} emphasis="gold" />
        {!isIndicativeRange && <Row label={t.netRow} value={formatINR(netCost ?? 0)} emphasis="bold" />}
      </div>

      <p className="mt-5 font-utility text-xs text-[#111827]/50">
        {t.included}
      </p>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(componentBreakdown).map(([key, value]) => {
          const Icon = CATEGORY_ICON[key] ?? Wrench;
          return (
            <div key={key} className="rounded-xl border border-[#e4e8ee] p-4 text-center">
              <Icon className="h-4 w-4 text-[#2f5daa] mx-auto" />
              <p className="mt-2 font-utility text-xs text-[#111827]/50">{CATEGORY_LABEL[key] ?? key}</p>
              <p className="font-utility text-sm font-semibold text-[#0e2a63]">{formatINR(value)}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-[#111827]/50 text-xs font-utility leading-relaxed">
        {t.disclaimer}
      </p>
    </div>
  );
}
