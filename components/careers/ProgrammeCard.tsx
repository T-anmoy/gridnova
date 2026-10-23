import type { Messages } from "@/lib/i18n/types";
import Disclosure from "./Disclosure";
import { panelId, tabId } from "./programme-ids";

type T = Messages["careers"]["programme"];

// One programme's tab panel: who it is for, what you do, how you earn, and
// the fuller role detail behind a disclosure. CareersEnhancer flips `hidden`
// when another tab is chosen.
export default function ProgrammeCard({ t, p, open }: { t: T; p: T["programmes"][number]; open: boolean }) {
  return (
    <section
      id={panelId(p.id)}
      role="tabpanel"
      aria-labelledby={tabId(p.id)}
      hidden={!open}
      data-nojs-show=""
      tabIndex={0}
      className="mt-4 rounded-2xl border border-[#e4e8ee] bg-white p-6 md:p-8 transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgba(9,28,60,0.35)]"
    >
      {/* The tab already names the panel; this heading is only for no-JS readers, who see both panels. */}
      <h3 className="nojs-only mb-5 font-display text-[#0e2a63] text-2xl font-semibold">{p.name}</h3>
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <div>
          <p className="font-utility text-xs font-semibold uppercase tracking-[0.14em] text-[#2f5daa]">{t.forLabel}</p>
          <p className="mt-1.5 text-[#111827]/75 leading-relaxed">{p.forWho}</p>
          <p className="mt-5 font-utility text-xs font-semibold uppercase tracking-[0.14em] text-[#2f5daa]">{t.doLabel}</p>
          <ul className="mt-2 space-y-2">
            {p.does.map((d) => (
              <li key={d} className="flex gap-3 text-[#111827]/75 leading-relaxed">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f7a800]" aria-hidden="true" />
                {d}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="rounded-xl bg-[#0e2a63] p-5 text-white">
            <p className="font-utility text-xs font-semibold uppercase tracking-[0.14em] text-[#f7a800]">{t.earnLabel}</p>
            <p className="mt-1.5 leading-relaxed text-white/90">{p.earn}</p>
          </div>
          <div className="mt-2 border-b border-[#e4e8ee]">
            <Disclosure title={t.moreLabel} titleClassName="font-utility text-sm font-semibold text-[#0e2a63]">
              <ul className="space-y-2.5 text-sm">
                {p.more.map((m) => (
                  <li key={m} className="flex gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0e2a63]" aria-hidden="true" />
                    {m}
                  </li>
                ))}
              </ul>
            </Disclosure>
          </div>
        </div>
      </div>
    </section>
  );
}
