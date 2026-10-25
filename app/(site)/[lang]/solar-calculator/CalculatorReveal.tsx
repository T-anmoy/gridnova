"use client";

import type { ReactNode } from "react";
import Link from "@/components/i18n/Link";
import { Loader2 } from "lucide-react";
import { CustomQuoteNotice, PriceListSummary } from "@/components/pricing/PackageCards";
import SolarEstimateResult from "@/components/pricing/SolarEstimateResult";
import { usePackageCatalogue } from "@/lib/pricing/usePackageCatalogue";
import { isSolarEstimate, type SolarEstimate } from "@/lib/pricing/solar-estimate";
import { useMessages } from "@/lib/i18n/client";

// The calculator's result, loaded only when the results step is reached (it is
// not part of the page's first-load JavaScript). A BE-14 estimate is drawn by
// the shared SolarEstimateResult — the same component the associate and the
// survey results use. An older response (no `estimate_version`) keeps the
// price-list-only display. A custom quote never shows a price.
export default function CalculatorReveal({
  result,
  phasePrompt,
  housesPrompt,
}: {
  result: SolarEstimate;
  phasePrompt?: ReactNode;
  housesPrompt?: ReactNode;
}) {
  const p = useMessages("pricing");
  const { catalogue, status } = usePackageCatalogue();
  const hidePrices = catalogue?.price_display === "hidden";
  const solar = isSolarEstimate(result);
  // While the phase question stands in for the custom-quote notice, answering it is the next step, not a call.
  const askingPhase = solar && !!phasePrompt && result.custom_quote_reasons.join() === "phase_unknown";
  const showBook = result.price_status === "custom_quote" && !askingPhase;

  return (
    <div className="space-y-4">
      {status === "loading" && result.price_status === "list_price" && (
        <p role="status" className="flex items-center gap-2 font-utility text-xs text-[#111827]/65">
          <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" /> {p.packages.loading}
        </p>
      )}
      {solar ? (
        <SolarEstimateResult estimate={result} catalogue={catalogue} hidePrices={hidePrices} phasePrompt={phasePrompt} housesPrompt={housesPrompt} />
      ) : result.price_status === "custom_quote" ? (
        <CustomQuoteNotice reasons={result.custom_quote_reasons} />
      ) : (
        <PriceListSummary fields={result} catalogue={catalogue} hidePrices={hidePrices} />
      )}
      {!solar && <p className="font-utility text-xs leading-relaxed text-[#111827]/65">{p.estimate.footer}</p>}
      {showBook && (
        <Link
          href="/book-a-call?source=calculator"
          className="inline-flex min-h-[44px] items-center font-utility text-sm font-semibold text-[#0e2a63] underline"
        >
          {p.customQuote.book}
        </Link>
      )}
    </div>
  );
}
