import { getImageProps } from "next/image";
import { ArrowRight } from "lucide-react";
import Link from "@/components/i18n/Link";
import CountUp from "./CountUp";
import MagneticButton from "./MagneticButton";
import type { Messages } from "@/lib/i18n/types";

// Figures stay in Western digits in every locale; labels are translated.
const STAT_VALUES = ["4,800+", "330+", "2,350+", "1,200+"] as const;

export default function Hero({ t }: { t: Messages["home"]["hero"] }) {
  const STATS = STAT_VALUES.map((num, i) => ({ num, label: t.stats[i] }));
  // Each locale defines its own line breaks (home.hero.headline) so every
  // line fits its clip-reveal mask; the last line carries the gold gradient.
  const lines = t.headline;
  const last = lines.length - 1;
  // Art-directed hero — one image downloads per device width
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    src: "/hero/hero-desktop.webp",
    alt: t.imageAlt,
    fill: true,
    priority: true,
    sizes: "100vw",
    quality: 85,
  });
  const {
    props: mobileImgProps,
  } = getImageProps({
    src: "/hero/hero-mobile.webp",
    alt: t.imageAlt,
    fill: true,
    priority: true,
    sizes: "100vw",
    quality: 80,
  });

  // A server component: the entrance and the parallax are CSS (globals.css:
  // .hero-*, .hero-parallax), so the hero ships no JavaScript of its own
  // beyond the count-up and the magnetic button.
  return (
    <section
      className="hero-section on-dark relative min-h-[100svh] w-full overflow-hidden flex items-center"
    >
      {/* ── Parallax container: the image drifts down as the hero scrolls
          away (~28%), driven by the scroll position on the compositor where
          CSS scroll-driven animations exist; static elsewhere and under
          reduced motion. ── */}
      <div
        className="hero-parallax absolute"
        style={{
          left: 0, right: 0,
          top: "-15%", bottom: "-15%",
        }}
      >
        {/* The photo is the LCP element: it is painted at full opacity from the first frame. */}
        <div className="hero-photo-wrap absolute inset-0">
          {/* ── Ken Burns scale (CSS keyframe, separate from both above) ── */}
          <div className="ken-burns absolute inset-0">
            {/* picture: browser picks one source — no double download */}
            <picture>
              <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
              {/* img spread carries fill styles + mobile srcSet from getImageProps */}
              <img
                {...mobileImgProps}
                alt={t.imageAlt}
                className="object-cover object-[center_28%] md:object-center"
              />
            </picture>
          </div>
        </div>
      </div>

      {/* ── Legibility scrims — tuned for WCAG AA across breakpoints ── */}
      {/* Left-to-right: text column protection at /90, fades to nothing on right */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#091c3c]/90 via-[#091c3c]/50 to-transparent pointer-events-none" />
      {/* Bottom-to-top: depth and anchor to ground */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#091c3c]/65 via-transparent to-[#091c3c]/20 pointer-events-none" />
      {/* Narrow column booster: extra protection over the left half only on large screens */}
      <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[#091c3c]/25 to-transparent pointer-events-none hidden lg:block" />

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-6 md:px-10 pt-[calc(var(--header-h)+1rem)] pb-24">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-12 items-end">
          <div>
            <span className="hero-eyebrow ref-tag text-[#f7a800]">
              {t.eyebrow}
            </span>
            <h1
              className="mt-6 font-display text-white leading-[0.98] font-medium"
              style={{ fontSize: "clamp(2rem,13vw,3.5rem)" }}
            >
              {lines.map((line, i) => (
                <span key={i} className="clip-line overflow-hidden block">
                  <span
                    className={
                      i === last
                        ? "hero-line block text-transparent bg-clip-text bg-gradient-to-r from-[#f7a800] to-[#fde68a] [filter:drop-shadow(0_2px_16px_rgba(9,28,60,0.9))]"
                        : "hero-line block"
                    }
                  >
                    {line}
                  </span>
                </span>
              ))}
            </h1>
            <p className="hero-sub mt-8 max-w-[46ch] text-white/85 text-base md:text-lg leading-relaxed [text-shadow:0_1px_8px_rgba(9,28,60,0.6)]">
              {t.sub}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <MagneticButton>
                <Link
                  href="/contact"
                  className="hero-cta group btn btn-primary"
                >
                  {t.primary}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </MagneticButton>
              <Link
                href="/projects"
                className="hero-cta btn btn-secondary"
              >
                {t.secondary}
              </Link>
            </div>
          </div>

          <div
            className="hero-panel glass rounded-3xl p-6 md:p-7"
            style={{ backgroundColor: "rgba(4,14,40,0.80)" }}
          >
            <p className="ref-tag text-white/50">{t.statsTitle}</p>
            <div className="mt-5 grid grid-cols-2 gap-x-6 xs:gap-x-8 gap-y-5">
              {STATS.map(({ num, label }) => (
                <div key={label}>
                  <div className="font-display text-white text-2xl md:text-[28px] font-semibold">
                    <CountUp value={num} />
                  </div>
                  <div className="text-white/80 text-xs font-utility mt-1 leading-snug">{label}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-white/60 text-[11px] font-utility leading-snug">
              {t.statsNote}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
