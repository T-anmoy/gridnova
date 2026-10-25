"use client";

import NextLink from "next/link";
import { useMessages } from "@/lib/i18n/client";
import { rememberLocale } from "@/lib/i18n/cookie";
import { useBarePathname } from "@/lib/i18n/navigation";

/**
 * Shown on every page of a locale whose message file is still flagged
 * `_review_status: "machine-draft"`, so an unreviewed translation is never
 * shipped silently. Disappears on its own once a native speaker's reviewed
 * file changes the flag.
 */
export default function DraftTranslationNotice({ draft }: { draft: boolean }) {
  const t = useMessages("draftNotice");
  const path = useBarePathname();
  if (!draft) return null;
  return (
    <aside
      role="note"
      className="bg-[#fff7e0] border-t border-[#f7a800]/40 text-[#5c3d00]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-3.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-sm">
        <p className="leading-relaxed">{t.text}</p>
        <NextLink
          href={path}
          lang="en"
          onClick={() => rememberLocale("en")}
          className="inline-flex min-h-11 shrink-0 items-center font-utility font-semibold underline underline-offset-2 whitespace-nowrap"
        >
          {t.readInEnglish}
        </NextLink>
      </div>
    </aside>
  );
}
