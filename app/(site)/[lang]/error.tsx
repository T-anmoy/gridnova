"use client";

import { useEffect } from "react";
import { Home, RotateCcw } from "lucide-react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/lib/i18n/client";
import { reportError } from "@/lib/monitoring";

// Error boundary for every public page and both field portals (it sits below
// the locale layout, so the language provider and the site chrome stay
// mounted). A crash shows this instead of a blank screen; "Try again" re-runs
// the failed render without a full reload.
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useMessages("common");

  useEffect(() => {
    // Only the digest is logged — never the message, which may echo form data.
    console.error("Page error", error.digest ?? "");
    reportError(error, { area: "site", digest: error.digest });
  }, [error]);

  return (
    <main
      id="main-content"
      className="on-dark min-h-[100svh] bg-[#091c3c] blueprint-grid flex items-center justify-center px-6"
    >
      <div role="alert" className="text-center max-w-[540px]">
        <h1 className="font-display text-white text-3xl md:text-4xl font-medium text-balance">{t.errorTitle}</h1>
        <p className="mt-5 text-white/70 leading-relaxed max-w-[42ch] mx-auto">{t.errorBody}</p>
        {error.digest && <p className="mt-3 font-utility text-xs text-white/55">Ref: {error.digest}</p>}
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <button type="button" onClick={() => reset()} className="btn btn-primary">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t.errorRetry}
          </button>
          <Link href="/" className="btn btn-secondary">
            <Home className="h-4 w-4" aria-hidden="true" />
            {t.errorHome}
          </Link>
        </div>
      </div>
    </main>
  );
}
