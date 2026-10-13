import type { Messages } from "@/lib/i18n/types";

export default function CompetitiveAdvantage({ t }: { t: Messages["about"]["advantage"] }) {
  const ADVANTAGES = t.items.map((a, i) => ({ ...a, n: String(i + 1).padStart(2, "0") }));
  return (
    <section className="relative bg-[#091c3c] py-24 md:py-28 blueprint-grid-dark">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <span className="ref-tag text-[#f7a800]">{t.eyebrow}</span>
        <h2 className="mt-4 font-display text-white text-[clamp(1.4rem,8vw,2.5rem)] xs:text-[clamp(1.5rem,6.5vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium max-w-[22ch] text-balance">
          {t.title}
        </h2>

        <div className="mt-14 border-t border-white/10">
          {ADVANTAGES.map((a) => (
            <div
              key={a.n}
              className="group grid md:grid-cols-[100px_1fr_1.4fr] gap-4 md:gap-10 py-8 md:py-10 border-b border-white/10 items-baseline"
            >
              <span className="font-display text-white/55 text-2xl group-hover:text-[#f7a800] transition-colors duration-300">
                {a.n}
              </span>
              <h3 className="font-display text-white text-xl md:text-2xl font-semibold">
                {a.title}
              </h3>
              <p className="text-white/55 leading-relaxed max-w-[56ch]">
                {a.copy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
