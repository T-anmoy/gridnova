const MARKETS = [
  {
    mark: (
      <svg className="h-6 w-6 text-[#f7a800]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 9.5 10 2l8 7.5" />
        <path d="M5 9.5V17h10V9.5" />
        <path d="M8 17v-3h4v3" />
      </svg>
    ),
    title: "Residential",
    copy: "Housing societies and individual homeowners seeking energy independence.",
  },
  {
    mark: (
      <svg className="h-6 w-6 text-[#f7a800]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="2" width="12" height="16" rx="1" />
        <path d="M4 7h12M4 11h12" />
        <path d="M8 18v-3h4v3" />
      </svg>
    ),
    title: "Commercial",
    copy: "Offices, hospitals, hotels and educational institutions reducing operating costs.",
  },
  {
    mark: (
      <svg className="h-6 w-6 text-[#f7a800]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 17V9l5 3V9l5 3V7h4v10H2z" />
        <path d="M14 7V4" />
      </svg>
    ),
    title: "Industrial",
    copy: "Manufacturing and industrial facilities improving sustainability metrics.",
  },
  {
    mark: (
      <svg className="h-6 w-6 text-[#f7a800]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 8h16M4 17h12M6 8v9M10 8v9M14 8v9" />
        <path d="M2 6l8-4 8 4" />
      </svg>
    ),
    title: "Government & Institutional",
    copy: "Public projects aligned with national and state renewable energy targets.",
  },
];

export default function TargetMarkets() {
  return (
    <section className="relative bg-[#091c3c] py-24 md:py-32 blueprint-grid-dark overflow-hidden">
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#2f5daa]/20 blur-[120px]" />
      <div className="relative mx-auto max-w-[1280px] px-6 md:px-10">
        <span className="ref-tag text-[#f7a800]">Who We Serve</span>
        <h2 className="mt-4 font-display text-white text-[clamp(1.4rem,8vw,2.5rem)] xs:text-[clamp(1.5rem,6.5vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium max-w-[20ch] text-balance">
          Four markets. One engineering standard.
        </h2>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden">
          {MARKETS.map((m) => (
            <div
              key={m.title}
              className="group bg-[#0c2148] p-7 md:p-8 hover:bg-[#112d6e] transition-all duration-300 cursor-default"
            >
              <div className="group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-300 origin-top-left">
                {m.mark}
              </div>
              <h3 className="mt-6 font-display text-white text-lg font-semibold group-hover:text-[#f7a800] transition-colors duration-300">
                {m.title}
              </h3>
              <p className="mt-2.5 text-white/55 text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                {m.copy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
