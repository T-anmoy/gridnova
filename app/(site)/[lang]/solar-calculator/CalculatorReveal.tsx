"use client";

import Link from "@/components/i18n/Link";
import { Loader2 } from "lucide-react";
import { CustomQuoteNotice, PriceListSummary } from "@/components/pricing/PackageCards";
import { usePackageCatalogue } from "@/lib/pricing/usePackageCatalogue";
import type { PriceListFields } from "@/lib/pricing/price-list";
import { useMessages } from "@/lib/i18n/client";

// The calculator's result: Grid Nova's two packages side by side with the
// list prices exactly as the backend sent them — or, when the backend gives no
// list price, a plain reason and the lead-capture path. A custom quote never
// shows a number.
export default function CalculatorReveal({ result }: { result: PriceListFields }) {
  const t = useMessages("calculator");
  const p = useMessages("pricing");
  const { catalogue, status } = usePackageCatalogue();

  if (result.price_status === "custom_quote") {
    return (
      <div className="space-y-4">
        <CustomQuoteNotice reasons={result.custom_quote_reasons} />
        <Link
          href="/book-a-call?source=calculator"
          className="inline-flex min-h-[44px] items-center font-utility text-sm font-semibold text-[#0e2a63] underline"
        >
          {p.customQuote.book}
        </Link>
      </div>
    );
  }

  const hidePrices = catalogue?.price_display === "hidden";
  return (
    <div className="space-y-4">
      {status === "loading" && (
        <p role="status" className="flex items-center gap-2 font-utility text-xs text-[#111827]/65">
          <Loader2 className="h-3 w-3 animate-spin" /> {p.packages.loading}
        </p>
      )}
      <PriceListSummary fields={result} catalogue={catalogue} hidePrices={hidePrices} />
      <p className="font-utility text-xs leading-relaxed text-[#111827]/65">{t.reveal.disclaimer}</p>
    </div>
  );
}
