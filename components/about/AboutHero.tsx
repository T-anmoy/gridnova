"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import Image from "next/image";
import companyPhoto from "@/public/images/COMPANY PROFILE.webp";

export default function AboutHero() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".ah-reveal",
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: "power3.out", delay: 0.1 }
      );
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ref}
      className="relative bg-[#f7f9fc] pt-[calc(var(--header-h)+2.5rem)] pb-20 md:pb-28 blueprint-grid"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-end">
          <div>
            <span className="ah-reveal ref-tag text-[#2f5daa]">
              Company Profile
            </span>
            <h1 className="ah-reveal mt-6 font-display text-[#0e2a63] text-[clamp(2rem,11vw,3.5rem)] xs:text-[clamp(2.1rem,9vw,3.5rem)] md:text-[clamp(2.5rem,4.6vw,5.5rem)] leading-[1.0] font-medium text-balance">
              Built to engineer India&rsquo;s clean energy grid —
              <span className="text-[#f7a800]"> project by project.</span>
            </h1>
            <p className="ah-reveal mt-7 max-w-[54ch] text-[#111827]/65 leading-relaxed text-base md:text-lg">
              Grid Nova Energy designs, develops and implements solar power
              systems for residential, commercial, industrial and
              institutional clients — combining technical expertise, quality
              engineering and a customer-centric approach across every
              engagement.
            </p>
          </div>
          <div className="ah-reveal relative aspect-[4/3] w-full rounded-2xl overflow-hidden">
            <Image
              src={companyPhoto}
              alt="Grid Nova Energy team on site"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
