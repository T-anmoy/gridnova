"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "@/components/i18n/Link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import solarEpcPhoto from "@/public/images/SOLAR EPC.webp";
import rooftopPhoto from "@/public/images/ROOFTOP SOLAR.webp";
import utilityPhoto from "@/public/images/PM KUSUM.webp";
import type { Messages } from "@/lib/i18n/types";

// Anchor ids for the government-programme pillars, in messages order
// (services.government.items). The homepage links straight to these.
const GOV_IDS = ["schools", "street-lighting", "solar-pumps"] as const;

export default function ServicesContent({ t }: { t: Messages["services"] }) {
  const OM_PILLARS = t.om.items;
  const GOV_PROGRAMMES = t.government.items.map((p, i) => ({ ...p, id: GOV_IDS[i] }));
  const CONSULTING_ITEMS = t.consulting.items.map((item, i) => ({ ...item, num: String(i + 1).padStart(2, "0") }));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      // Intro hero — page-load sequence
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .fromTo(".sv-eyebrow", { opacity: 0, y: 10, immediateRender: false }, { opacity: 1, y: 0, duration: 0.5 }, 0.15)
        .fromTo(".sv-h1", { opacity: 0, y: 22, immediateRender: false }, { opacity: 1, y: 0, duration: 0.75 }, 0.28)
        .fromTo(".sv-sub", { opacity: 0, y: 14, immediateRender: false }, { opacity: 1, y: 0, duration: 0.6 }, 0.52)
        .fromTo(".sv-tag", { opacity: 0, y: 8, immediateRender: false }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.07 }, 0.68);

      // 01 EPC — text slides from left, image fades in
      gsap.fromTo(".s01-text", { opacity: 0, x: -32, immediateRender: false }, {
        opacity: 1, x: 0, duration: 0.85, ease: "power3.out",
        scrollTrigger: { trigger: ".s01", start: "top 72%", once: true },
      });
      gsap.fromTo(".s01-img", { opacity: 0, scale: 1.05, immediateRender: false }, {
        opacity: 1, scale: 1, duration: 1, ease: "power2.out",
        scrollTrigger: { trigger: ".s01", start: "top 72%", once: true },
      });

      // 02 Green Energy — image fades up, then text below rises
      gsap.fromTo(".s02-img", { opacity: 0, immediateRender: false }, {
        opacity: 1, duration: 0.9, ease: "power2.out",
        scrollTrigger: { trigger: ".s02-img", start: "top 82%", once: true },
      });
      gsap.fromTo(".s02-eyebrow", { opacity: 0, y: 10, immediateRender: false }, {
        opacity: 1, y: 0, duration: 0.5, ease: "power3.out",
        scrollTrigger: { trigger: ".s02-body", start: "top 76%", once: true },
      });
      gsap.fromTo(".s02-h2", { opacity: 0, y: 18, immediateRender: false }, {
        opacity: 1, y: 0, duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: ".s02-body", start: "top 76%", once: true },
      });
      gsap.fromTo(".s02-col", { opacity: 0, y: 14, immediateRender: false }, {
        opacity: 1, y: 0, duration: 0.65, ease: "power3.out", stagger: 0.12,
        scrollTrigger: { trigger: ".s02-body", start: "top 76%", once: true },
      });

      // 03 Utility — counter-slide (image from left, text from right)
      gsap.fromTo(".s03-img", { opacity: 0, x: -28, immediateRender: false }, {
        opacity: 1, x: 0, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: ".s03", start: "top 72%", once: true },
      });
      gsap.fromTo(".s03-text", { opacity: 0, x: 28, immediateRender: false }, {
        opacity: 1, x: 0, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: ".s03", start: "top 72%", once: true },
      });

      // 04 Government Programmes — header fades, pillars stagger up
      gsap.fromTo(".s04gov-header", { opacity: 0, y: 16, immediateRender: false }, {
        opacity: 1, y: 0, duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: ".s04gov", start: "top 72%", once: true },
      });
      gsap.fromTo(".s04gov-pillar", { opacity: 0, y: 28, immediateRender: false }, {
        opacity: 1, y: 0, duration: 0.65, ease: "power3.out", stagger: 0.1,
        scrollTrigger: { trigger: ".s04gov-grid", start: "top 78%", once: true },
      });

      // 05 O&M — header fades, pillars stagger up
      gsap.fromTo(".s05om-header", { opacity: 0, y: 16, immediateRender: false }, {
        opacity: 1, y: 0, duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: ".s05om", start: "top 72%", once: true },
      });
      gsap.fromTo(".s05om-pillar", { opacity: 0, y: 28, immediateRender: false }, {
        opacity: 1, y: 0, duration: 0.65, ease: "power3.out", stagger: 0.1,
        scrollTrigger: { trigger: ".s05om-grid", start: "top 78%", once: true },
      });

      // 06 Consulting — intro slides from left, list items stagger up
      gsap.fromTo(".s06-intro", { opacity: 0, x: -24, immediateRender: false }, {
        opacity: 1, x: 0, duration: 0.8, ease: "power3.out",
        scrollTrigger: { trigger: ".s06", start: "top 72%", once: true },
      });
      gsap.fromTo(".s06-item", { opacity: 0, y: 16, immediateRender: false }, {
        opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.12,
        scrollTrigger: { trigger: ".s06-list", start: "top 78%", once: true },
      });

      // 07 Looking Ahead — brief fade up
      gsap.fromTo(".s07-body", { opacity: 0, y: 14, immediateRender: false }, {
        opacity: 1, y: 0, duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: ".s07", start: "top 80%", once: true },
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef}>

      {/* ── Intro hero — dark navy, blueprint-grid ── */}
      <section className="bg-[#091c3c] blueprint-grid pt-[calc(var(--header-h)+3.5rem)] pb-24 md:pb-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <span className="sv-eyebrow ref-tag text-[#f7a800] mb-6 block">{t.intro.eyebrow}</span>
          <h1
            className="sv-h1 font-display text-white font-medium leading-[0.95] text-balance max-w-[14ch]"
            style={{ fontSize: "clamp(1.75rem,8vw,7rem)" }}
          >
            {t.intro.title}<br />{t.intro.title2}
          </h1>
          <p className="sv-sub mt-8 text-white/55 max-w-[48ch] leading-relaxed text-lg">
            {t.intro.body}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            {t.intro.tags.map((s) => (
              <span key={s} className="sv-tag font-utility text-xs text-white/60 border border-white/15 rounded-full px-4 py-1.5">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 01 Solar EPC — text left, image right, light bg ── */}
      <section id="epc" className="s01 scroll-mt-28 bg-[#f7f9fc] py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-24 items-center">
            <div className="s01-text">
              <span className="font-utility text-[11px] tracking-[0.22em] text-[#2f5daa]/60 uppercase">{t.epc.label}</span>
              <h2
                className="mt-5 font-display text-[#0e2a63] font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4.5vw,3rem)" }}
              >
                {t.epc.title}
              </h2>
              <p className="mt-6 text-[#111827]/65 leading-relaxed">
                {t.epc.body}
              </p>
              <p className="mt-4 text-[#111827]/65 leading-relaxed">
                {t.epc.body2}
              </p>
              <Link
                href="/contact"
                className="mt-8 inline-flex items-center gap-2 text-[#0e2a63] font-utility font-semibold text-sm group active:scale-[0.97] transition-transform"
              >
                {t.epc.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="s01-img relative aspect-[4/3] w-full rounded-2xl overflow-hidden">
              <Image
                src={solarEpcPhoto}
                alt={t.epc.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 02 Green Energy Projects — cinematic full-width image, editorial text below ── */}
      <section id="rooftop" className="s02 scroll-mt-28 bg-white border-t border-[#e4e8ee]">
        <div className="s02-img relative aspect-[4/3] sm:aspect-[16/9] md:aspect-[21/9] w-full overflow-hidden">
          <Image
            src={rooftopPhoto}
            alt={t.green.alt}
            fill
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
        <div className="s02-body mx-auto max-w-[1280px] px-6 md:px-10 py-20 md:py-28">
          <span className="s02-eyebrow font-utility text-[11px] tracking-[0.22em] text-[#2f5daa]/60 uppercase block mb-6">{t.green.label}</span>
          <h2
            className="s02-h2 font-display text-[#0e2a63] font-semibold leading-[1.05] max-w-[14ch]"
            style={{ fontSize: "clamp(1.8rem,6vw,4rem)" }}
          >
            {t.green.title}
          </h2>
          <div className="mt-10 grid sm:grid-cols-2 gap-x-16 gap-y-6 text-[#111827]/65 leading-relaxed max-w-[80ch]">
            <p className="s02-col">
              {t.green.body}
            </p>
            <p className="s02-col">
              {t.green.body2}
            </p>
          </div>
        </div>
      </section>

      {/* ── 03 Grid-Scale Solar Infrastructure — dark navy, image left, text right ── */}
      <section id="grid-scale" className="s03 scroll-mt-28 bg-[#091c3c] py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-24 items-center">
            <div className="s03-img relative aspect-[4/3] w-full rounded-2xl overflow-hidden">
              <Image
                src={utilityPhoto}
                alt={t.gridScale.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
            </div>
            <div className="s03-text">
              <span className="font-utility text-[11px] tracking-[0.22em] text-white/60 uppercase">{t.gridScale.label}</span>
              <h2
                className="mt-5 font-display text-white font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4.5vw,3rem)" }}
              >
                {t.gridScale.title}
              </h2>
              <p className="mt-6 text-white/60 leading-relaxed">
                {t.gridScale.body}
              </p>
              <p className="mt-4 text-white/60 leading-relaxed">
                {t.gridScale.body2}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 04 Government & Community Programmes — three-pillar grid, no image ── */}
      <section id="government" className="s04gov scroll-mt-28 bg-white py-24 md:py-28 border-t border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="s04gov-header flex flex-col md:flex-row md:items-end gap-8 md:gap-20 mb-16">
            <div className="shrink-0">
              <span className="font-utility text-[11px] tracking-[0.22em] text-[#2f5daa]/60 uppercase">{t.government.label}</span>
              <h2
                className="mt-5 font-display text-[#0e2a63] font-semibold leading-[1.0]"
                style={{ fontSize: "clamp(1.8rem,4.5vw,3rem)" }}
              >
                {t.government.title}<br />{t.government.title2}
              </h2>
            </div>
            <p className="text-[#111827]/65 leading-relaxed max-w-[48ch] md:pb-1">
              {t.government.body}
            </p>
          </div>
          <div className="s04gov-grid grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#e4e8ee] rounded-2xl overflow-hidden">
            {GOV_PROGRAMMES.map((p) => (
              <div key={p.id} id={p.id} className="s04gov-pillar scroll-mt-28 bg-[#f7f9fc] p-8 md:p-9">
                <p className="font-display text-[#0e2a63] font-semibold mb-3">{p.n}</p>
                <p className="text-[#111827]/60 text-sm leading-relaxed">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 05 O&M — four-pillar grid, no image ── */}
      <section id="om" className="s05om scroll-mt-28 bg-[#0e2a63] py-24 md:py-28 border-t border-white/10">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="s05om-header flex flex-col md:flex-row md:items-end gap-8 md:gap-20 mb-16">
            <div className="shrink-0">
              <span className="font-utility text-[11px] tracking-[0.22em] text-white/60 uppercase">{t.om.label}</span>
              <h2
                className="mt-5 font-display text-white font-semibold leading-[1.0]"
                style={{ fontSize: "clamp(1.8rem,4.5vw,3rem)" }}
              >
                {t.om.title}<br />{t.om.title2}
              </h2>
            </div>
            <p className="text-white/55 leading-relaxed max-w-[48ch] md:pb-1">
              {t.om.body}
            </p>
          </div>
          <div className="s05om-grid grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden">
            {OM_PILLARS.map((p) => (
              <div key={p.n} className="s05om-pillar bg-[#0c2148] p-8 md:p-9">
                <p className="font-display text-white font-semibold mb-3">{p.n}</p>
                <p className="text-white/50 text-sm leading-relaxed">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 06 Consulting — numbered list, light bg ── */}
      <section id="consulting" className="s06 scroll-mt-28 bg-[#f7f9fc] py-24 md:py-32 border-t border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="grid lg:grid-cols-[1fr_1.5fr] gap-16 lg:gap-24 items-start">
            <div className="s06-intro">
              <span className="font-utility text-[11px] tracking-[0.22em] text-[#2f5daa]/60 uppercase">{t.consulting.label}</span>
              <h2
                className="mt-5 font-display text-[#0e2a63] font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4.5vw,3rem)" }}
              >
                {t.consulting.title}
              </h2>
              <p className="mt-6 text-[#111827]/65 leading-relaxed">
                {t.consulting.body}
              </p>
            </div>
            <div className="s06-list border-t border-[#e4e8ee]">
              {CONSULTING_ITEMS.map((item) => (
                <div key={item.num} className="s06-item grid md:grid-cols-[56px_1fr] gap-5 py-7 border-b border-[#e4e8ee] items-start">
                  <span className="font-display text-[#0e2a63]/20 text-2xl font-bold">{item.num}</span>
                  <div>
                    <p className="font-display text-[#0e2a63] font-semibold">{item.t}</p>
                    <p className="mt-2 text-[#111827]/60 text-sm leading-relaxed">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 07 Looking Ahead — brief, honestly-framed forward-looking note ── */}
      <section className="s07 bg-[#091c3c] py-16 md:py-20 border-t border-white/10">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="s07-body max-w-[70ch]">
            <span className="font-utility text-[11px] tracking-[0.22em] text-white/60 uppercase">{t.ahead.label}</span>
            <p className="mt-5 text-white/55 leading-relaxed">
              {t.ahead.body}
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
