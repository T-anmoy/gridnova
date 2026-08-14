"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import solarEpcPhoto from "@/public/images/SOLAR EPC.webp";
import rooftopPhoto from "@/public/images/ROOFTOP SOLAR.webp";
import utilityPhoto from "@/public/images/PM KUSUM.webp";

const OM_PILLARS = [
  { n: "Preventive", d: "Scheduled cleaning, thermographic inspection, string performance checks and inverter health monitoring." },
  { n: "Corrective", d: "Fault diagnosis, component replacement and root-cause documentation within defined response windows." },
  { n: "Performance", d: "Yield analysis against modelled generation, PR ratio tracking and degradation benchmarking." },
  { n: "Regulatory", d: "DISCOM compliance documentation, safety inspection records and warranty claim management." },
];

const CONSULTING_ITEMS = [
  { n: "01", t: "Feasibility Studies", d: "Solar resource assessment, yield projection, financial modelling and payback analysis using site-specific inputs." },
  { n: "02", t: "Site Assessment", d: "Shadow analysis, structural survey, grid interconnection capacity check and civil condition review." },
  { n: "03", t: "System Design", d: "Full electrical design package: module string layout, inverter selection, single-line diagram and protection coordination." },
  { n: "04", t: "Regulatory Support", d: "DISCOM interconnection applications, net-metering documentation, MNRE subsidy processing and state nodal agency coordination." },
];

export default function ServicesContent() {
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

      // 04 O&M — header fades, pillars stagger up
      gsap.fromTo(".s04-header", { opacity: 0, y: 16, immediateRender: false }, {
        opacity: 1, y: 0, duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: ".s04", start: "top 72%", once: true },
      });
      gsap.fromTo(".s04-pillar", { opacity: 0, y: 28, immediateRender: false }, {
        opacity: 1, y: 0, duration: 0.65, ease: "power3.out", stagger: 0.1,
        scrollTrigger: { trigger: ".s04-grid", start: "top 78%", once: true },
      });

      // 05 Consulting — intro slides from left, list items stagger up
      gsap.fromTo(".s05-intro", { opacity: 0, x: -24, immediateRender: false }, {
        opacity: 1, x: 0, duration: 0.8, ease: "power3.out",
        scrollTrigger: { trigger: ".s05", start: "top 72%", once: true },
      });
      gsap.fromTo(".s05-item", { opacity: 0, y: 16, immediateRender: false }, {
        opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.12,
        scrollTrigger: { trigger: ".s05-list", start: "top 78%", once: true },
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef}>

      {/* ── Intro hero — dark navy, blueprint-grid ── */}
      <section className="bg-[#091c3c] blueprint-grid pt-[calc(var(--header-h)+3.5rem)] pb-24 md:pb-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <span className="sv-eyebrow ref-tag text-[#f7a800] mb-6 block">Our Capabilities</span>
          <h1
            className="sv-h1 font-display text-white font-medium leading-[0.95] text-balance max-w-[14ch]"
            style={{ fontSize: "clamp(1.75rem,8vw,7rem)" }}
          >
            Five disciplines.<br />One accountable team.
          </h1>
          <p className="sv-sub mt-8 text-white/55 max-w-[48ch] leading-relaxed text-lg">
            Grid Nova delivers every service below in-house — not
            subcontracted, not templated. Each engagement is engineered for
            the specific site, client and budget.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            {["EPC", "Green Energy", "Grid-Scale", "O&M", "Consulting"].map((s) => (
              <span key={s} className="sv-tag font-utility text-xs text-white/60 border border-white/15 rounded-full px-4 py-1.5">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 01 Solar EPC — text left, image right, light bg ── */}
      <section className="s01 bg-[#f7f9fc] py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-24 items-center">
            <div className="s01-text">
              <span className="font-utility text-[11px] tracking-[0.22em] text-[#2f5daa]/60 uppercase">01 / EPC</span>
              <h2
                className="mt-5 font-display text-[#0e2a63] font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4.5vw,3rem)" }}
              >
                Solar EPC Services
              </h2>
              <p className="mt-6 text-[#111827]/65 leading-relaxed">
                We manage the full Engineering, Procurement and Construction
                lifecycle for grid-connected and off-grid solar power plants.
                From initial site survey through system design, equipment
                sourcing, civil works, module installation, cabling, inverter
                commissioning and DISCOM grid synchronisation — every activity
                sits under one accountable contract.
              </p>
              <p className="mt-4 text-[#111827]/65 leading-relaxed">
                Our EPC scope includes technical due diligence, shadow analysis,
                structural loading assessment, protection relay coordination,
                and documentation packages for state electricity regulatory
                body approvals. We do not begin construction until the design
                is signed off in full.
              </p>
              <Link
                href="/contact"
                className="mt-8 inline-flex items-center gap-2 text-[#0e2a63] font-utility font-semibold text-sm group active:scale-[0.97] transition-transform"
              >
                Discuss an EPC project
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="s01-img relative aspect-[4/3] w-full rounded-2xl overflow-hidden">
              <Image
                src={solarEpcPhoto}
                alt="Grid Nova Energy Solar EPC — large-scale installation"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 02 Green Energy Projects — cinematic full-width image, editorial text below ── */}
      <section className="s02 bg-white border-t border-[#e4e8ee]">
        <div className="s02-img relative aspect-[4/3] sm:aspect-[16/9] md:aspect-[21/9] w-full overflow-hidden">
          <Image
            src={rooftopPhoto}
            alt="Green Energy Project — distributed solar installation, Grid Nova Energy"
            fill
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
        <div className="s02-body mx-auto max-w-[1280px] px-6 md:px-10 py-20 md:py-28">
          <span className="s02-eyebrow font-utility text-[11px] tracking-[0.22em] text-[#2f5daa]/60 uppercase block mb-6">02 / Green Energy</span>
          <h2
            className="s02-h2 font-display text-[#0e2a63] font-semibold leading-[1.05] max-w-[14ch]"
            style={{ fontSize: "clamp(1.8rem,6vw,4rem)" }}
          >
            Green Energy Projects
          </h2>
          <div className="mt-10 grid sm:grid-cols-2 gap-x-16 gap-y-6 text-[#111827]/65 leading-relaxed max-w-[80ch]">
            <p className="s02-col">
              We design and install solar systems precisely matched to each
              building&rsquo;s load profile, roof geometry, structural capacity
              and grid-interconnection point. Residential, commercial and
              industrial profiles each demand different engineering assumptions —
              we model every one specifically.
            </p>
            <p className="s02-col">
              Our delivery includes net-metering applications, DISCOM approval
              management, roof waterproofing assessment and post-installation
              performance monitoring. We handle PM Surya Ghar subsidy
              documentation for eligible residential customers — a process that
              requires careful coordination between the installer, DISCOM and
              the national portal.
            </p>
          </div>
        </div>
      </section>

      {/* ── 03 Grid-Scale Solar Infrastructure — dark navy, image left, text right ── */}
      <section className="s03 bg-[#091c3c] py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-24 items-center">
            <div className="s03-img relative aspect-[4/3] w-full rounded-2xl overflow-hidden">
              <Image
                src={utilityPhoto}
                alt="Utility-scale ground-mounted solar farm — Grid Nova Energy"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
            </div>
            <div className="s03-text">
              <span className="font-utility text-[11px] tracking-[0.22em] text-white/40 uppercase">03 / Grid-Scale</span>
              <h2
                className="mt-5 font-display text-white font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4.5vw,3rem)" }}
              >
                Grid-Scale Solar Infrastructure
              </h2>
              <p className="mt-6 text-white/60 leading-relaxed">
                For large ground-mounted installations, we provide design and
                execution support covering land suitability, irradiance
                modelling, single-line diagram development, inverter and
                transformer specification, substation design, grid evacuation
                planning and full project management through commissioning.
              </p>
              <p className="mt-4 text-white/60 leading-relaxed">
                Grid Nova&rsquo;s team and branch network has delivered projects
                aligned with PM-KUSUM component C — 2,350+ solar pump
                installations across rural districts in Bihar and West Bengal —
                representing large-scale rural deployment capability under
                government programme constraints.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 04 O&M — four-pillar grid, no image ── */}
      <section className="s04 bg-[#0e2a63] py-24 md:py-28 border-t border-white/10">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="s04-header flex flex-col md:flex-row md:items-end gap-8 md:gap-20 mb-16">
            <div className="shrink-0">
              <span className="font-utility text-[11px] tracking-[0.22em] text-white/40 uppercase">04 / O&amp;M</span>
              <h2
                className="mt-5 font-display text-white font-semibold leading-[1.0]"
                style={{ fontSize: "clamp(1.8rem,4.5vw,3rem)" }}
              >
                Operation &amp;<br />Maintenance
              </h2>
            </div>
            <p className="text-white/55 leading-relaxed max-w-[48ch] md:pb-1">
              A solar system performs precisely as well as it is maintained.
              Our O&amp;M programmes are structured around the principle that
              annual yield degradation is a management problem, not an
              inevitability.
            </p>
          </div>
          <div className="s04-grid grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden">
            {OM_PILLARS.map((p) => (
              <div key={p.n} className="s04-pillar bg-[#0c2148] p-8 md:p-9">
                <p className="font-display text-white font-semibold mb-3">{p.n}</p>
                <p className="text-white/50 text-sm leading-relaxed">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 05 Consulting — numbered list, light bg ── */}
      <section className="s05 bg-[#f7f9fc] py-24 md:py-32 border-t border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="grid lg:grid-cols-[1fr_1.5fr] gap-16 lg:gap-24 items-start">
            <div className="s05-intro">
              <span className="font-utility text-[11px] tracking-[0.22em] text-[#2f5daa]/60 uppercase">05 / Consulting</span>
              <h2
                className="mt-5 font-display text-[#0e2a63] font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4.5vw,3rem)" }}
              >
                Energy Consulting
              </h2>
              <p className="mt-6 text-[#111827]/65 leading-relaxed">
                Not every client needs a full EPC contract from day one. Our
                consulting scope is available as a standalone engagement for
                clients who need rigorous technical input before committing
                to a project.
              </p>
            </div>
            <div className="s05-list border-t border-[#e4e8ee]">
              {CONSULTING_ITEMS.map((item) => (
                <div key={item.n} className="s05-item grid md:grid-cols-[56px_1fr] gap-5 py-7 border-b border-[#e4e8ee] items-start">
                  <span className="font-display text-[#0e2a63]/20 text-2xl font-bold">{item.n}</span>
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

    </div>
  );
}
