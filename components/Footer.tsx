"use client";

import Image from "next/image";
import { Phone, Globe, MapPin, Mail } from "lucide-react";
import Link from "@/components/i18n/Link";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { scrollToTop } from "@/lib/lenis";
import { useMessages } from "@/lib/i18n/client";
import { useBarePathname } from "@/lib/i18n/navigation";
import headerLogo from "@/public/brand/header-logo.webp";
import { HELPLINE_DISPLAY, HELPLINE_TEL } from "@/lib/contact";

const SITEMAP = [
  { key: "about", href: "/about" },
  { key: "services", href: "/services" },
  { key: "industries", href: "/industries" },
  { key: "projects", href: "/projects" },
  { key: "technology", href: "/technology" },
  { key: "leadership", href: "/leadership" },
  { key: "sustainability", href: "/sustainability" },
  { key: "careers", href: "/careers" },
] as const;

const LEGAL = [
  { key: "privacy", href: "/privacy" },
  { key: "terms", href: "/terms" },
  { key: "associateTerms", href: "/associate-terms" },
  { key: "commissionPolicy", href: "/commission-policy" },
  { key: "paymentPolicy", href: "/payment-policy" },
  { key: "staffLogin", href: "/dashboard" },
] as const;

export default function Footer() {
  const pathname = useBarePathname();
  const nav = useMessages("nav");
  const t = useMessages("footer");

  const handleHomeClick = (e: React.MouseEvent) => {
    if (pathname === "/") {
      e.preventDefault();
      scrollToTop();
    }
  };

  return (
    <footer className="relative bg-[#091c3c] pt-20 pb-8 border-t border-white/10">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="grid md:grid-cols-[1.3fr_0.7fr_0.7fr_1fr] gap-12">
          <div>
            <Link
              href="/"
              aria-label={t.homeLabel}
              onClick={handleHomeClick}
              className="inline-flex bg-white/95 rounded-xl px-3 py-1.5 shadow-sm transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Image
                src={headerLogo}
                alt="Grid Nova Energy"
                width={115}
                height={30}
                className="h-7 w-auto"
              />
            </Link>
            <p className="mt-5 text-white/50 text-sm leading-relaxed max-w-[38ch]">
              {t.tagline}
            </p>
            <p className="mt-5 font-utility text-[11px] tracking-[0.15em] text-white/60 uppercase">
              {t.serviceLine}
            </p>
            <div className="mt-6">
              <p className="font-utility text-[11px] tracking-[0.15em] text-white/60 uppercase mb-2.5">
                {t.language}
              </p>
              <LanguageSwitcher size="md" />
            </div>
          </div>

          <div>
            <p className="font-utility text-[11px] tracking-[0.15em] text-white/60 uppercase mb-5">
              {t.sitemap}
            </p>
            <ul className="space-y-3">
              {SITEMAP.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="py-1 text-white/60 hover:text-white text-sm transition-[color,transform] duration-200 hover:translate-x-1 motion-reduce:transition-none motion-reduce:hover:translate-x-0 inline-flex items-center gap-1.5 group"
                  >
                    <span className="w-0 group-hover:w-2.5 overflow-hidden transition-[width,opacity] duration-200 opacity-0 motion-reduce:transition-none group-hover:opacity-100">
                      <span className="block h-px bg-[#f7a800]" />
                    </span>
                    {nav.links[l.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-utility text-[11px] tracking-[0.15em] text-white/60 uppercase mb-5">
              {t.legal}
            </p>
            <ul className="space-y-3">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="py-1 text-white/60 hover:text-white text-sm transition-[color,transform] duration-200 hover:translate-x-1 motion-reduce:transition-none motion-reduce:hover:translate-x-0 inline-flex items-center gap-1.5 group"
                  >
                    <span className="w-0 group-hover:w-2.5 overflow-hidden transition-[width,opacity] duration-200 opacity-0 motion-reduce:transition-none group-hover:opacity-100">
                      <span className="block h-px bg-[#f7a800]" />
                    </span>
                    {t.legalLinks[l.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-utility text-[11px] tracking-[0.15em] text-white/60 uppercase mb-5">
              {t.kolkataOffice}
            </p>
            <ul className="space-y-3.5 text-white/60 text-sm">
              <li className="flex gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-[#f7a800]" />
                <a
                  href="https://www.google.com/maps/search/?api=1&query=22.514723,88.405869"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Plot No. 83, Kasba Industrial Estate, Phase II, Kolkata –
                  700107, West Bengal, India
                </a>
              </li>
              <li className="flex gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-[#f7a800]" />
                <a
                  href="https://www.google.com/maps/search/?api=1&query=C%2FO+Parbati+Bhawan%2C+West+Ram+Krishna+Nagar%2C+New+Bypass+Road%2C+Opposite+Metro+Pillar+No.+81%2C+New+Jaganpura%2C+Patna%2C+Bihar+800027"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  <span className="block text-white/60 text-[10px] uppercase tracking-[0.1em] mb-1">
                    {t.patnaOffice}
                  </span>
                  C/O Parbati Bhawan, West Ram Krishna Nagar, New Bypass
                  Road, Opposite Metro Pillar No. 81, P.O.- New Jaganpura,
                  Patna – 800027, Bihar
                </a>
              </li>
              <li className="flex gap-2.5 items-center">
                <Phone className="h-4 w-4 shrink-0 text-[#f7a800]" />
                <a href={HELPLINE_TEL} className="hover:text-white transition-colors">
                  {HELPLINE_DISPLAY}
                </a>
              </li>
              <li className="flex gap-2.5 items-center">
                <Phone className="h-4 w-4 shrink-0 text-[#f7a800]" />
                <a href="tel:+919199576535" className="hover:text-white transition-colors">
                  +91 91995 76535
                </a>
              </li>
              <li className="flex gap-2.5 items-center">
                <Globe className="h-4 w-4 shrink-0 text-[#f7a800]" />
                <a href="https://www.gridnova.in" className="hover:text-white transition-colors">
                  www.gridnova.in
                </a>
              </li>
              <li className="flex gap-2.5 items-center">
                <Mail className="h-4 w-4 shrink-0 text-[#f7a800]" />
                <a href="mailto:info@gridnova.in" className="hover:text-white transition-colors">
                  info@gridnova.in
                </a>
              </li>
            </ul>
            <div className="mt-4 overflow-hidden rounded-xl border border-white/10" style={{ aspectRatio: "16/9" }}>
              <iframe
                src="https://www.google.com/maps?q=22.514723,88.405869&z=17&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0, filter: "brightness(0.82) saturate(0.85)" }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={t.mapTitle}
              />
            </div>
          </div>
        </div>

        <div className="mt-16 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3">
          <Link
            href="/"
            onClick={handleHomeClick}
            className="text-white/60 hover:text-white/55 text-xs font-utility transition-colors duration-200"
          >
            © {new Date().getFullYear()} {t.copyright}
          </Link>
          <div className="flex items-center gap-4">
            <p className="text-white/60 text-xs font-utility">
              {t.credit}{" "}
              <a
                href="https://www.highlinework.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#f7a800] hover:text-[#ffd27a] underline decoration-[#f7a800]/40 hover:decoration-[#ffd27a]/60 underline-offset-2 transition-colors duration-200"
              >
                Highline Works
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
