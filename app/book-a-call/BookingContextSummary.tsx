import { Zap } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import CountUp from "@/components/CountUp";

const SOURCE_LABEL: Record<string, string> = {
  calculator: "Solar Calculator",
  estimate: "Estimate Form",
  header: "site navigation",
  contact: "Contact page",
  homepage: "homepage",
};

function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

// Carries the Solar Calculator's output forward as read-only context so a
// visitor who already ran the calculator doesn't have to re-explain
// themselves on this page. Renders nothing when there's no context to show
// (e.g. arriving from the header) — this is purely additive, never required.
export default function BookingContextSummary({
  estimatedTotal,
  sizingMethod,
  sizingValue,
  source,
}: {
  estimatedTotal?: string;
  sizingMethod?: string;
  sizingValue?: string;
  source?: string;
}) {
  const total = estimatedTotal ? Number(estimatedTotal) : undefined;
  const hasTotal = total != null && Number.isFinite(total) && total > 0;
  const hasSizing = !!sizingMethod && !!sizingValue;

  if (!hasTotal && !hasSizing) return null;

  const sourceLabel = source && SOURCE_LABEL[source] ? SOURCE_LABEL[source] : "your earlier estimate";

  return (
    // One of the two highest-intent moments on the site (with the calculator
    // reveal itself) — a slightly more considered entrance than a plain
    // fade, and the total counts up the same way it did on the calculator,
    // so the two moments feel like one continuous handoff rather than a
    // second, disconnected animation.
    <ScrollReveal className="mb-8">
      <div className="rounded-2xl border border-[#e4e8ee] bg-white p-5 flex items-start gap-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f7a800]/10">
          <Zap className="h-4 w-4 text-[#f7a800]" />
        </div>
        <div>
          <p className="font-utility text-xs text-[#111827]/50">
            Carried forward from {sourceLabel}
          </p>
          <p className="mt-1 font-utility text-sm text-[#0e2a63]">
            {hasTotal && (
              <span className="font-semibold">
                <CountUp value={formatINR(total!)} /> indicative estimate
              </span>
            )}
            {hasTotal && hasSizing && " · "}
            {hasSizing && (
              <span>
                {sizingMethod === "bill" ? `₹${sizingValue}/month bill` : `${sizingValue} sq ft roof area`}
              </span>
            )}
          </p>
        </div>
      </div>
    </ScrollReveal>
  );
}
