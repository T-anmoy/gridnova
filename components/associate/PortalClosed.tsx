import Link from "@/components/i18n/Link";
import type { Messages } from "@/lib/i18n/types";

// Shown in place of every /associates/* and /preferred/* route while the
// portal switch is closed, so a direct URL never lands on a form that can't
// work.
export default function PortalClosed({ t }: { t: Messages["associates"]["closed"] }) {
  return (
    <main id="main-content" className="pt-[calc(var(--header-h)+3rem)] pb-24 px-6 md:px-10 bg-[#f7f9fc] min-h-screen">
      <div className="mx-auto max-w-[640px] rounded-2xl border border-[#e4e8ee] bg-white p-8 text-center">
        <h1 className="font-display text-[#0e2a63] text-3xl font-medium">{t.title}</h1>
        <p className="mt-4 text-[#111827]/65 leading-relaxed">{t.body}</p>
        <Link href="/careers" className="btn btn-primary mt-6 inline-flex min-h-[44px]">
          {t.back}
        </Link>
      </div>
    </main>
  );
}
