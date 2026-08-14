"use client";

import Link from "next/link";
import Image from "next/image";
import { Phone, Globe, MapPin, Mail } from "lucide-react";
import { usePathname } from "next/navigation";
import { scrollToTop } from "@/lib/lenis";
import headerLogo from "@/public/brand/header-logo.png";

const SITEMAP = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Industries", href: "/industries" },
  { label: "Projects", href: "/projects" },
  { label: "Technology", href: "/technology" },
  { label: "Leadership", href: "/leadership" },
  { label: "Sustainability", href: "/sustainability" },
  { label: "Careers", href: "/careers" },
];

const LEGAL = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Staff Login", href: "/dashboard" },
];

export default function Footer() {
  const pathname = usePathname();

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
              aria-label="Grid Nova Energy — home"
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
              Eco-Energy Initiative — delivering India&rsquo;s clean energy
              future through expertise, innovation and a relentless
              commitment to quality.
            </p>
            <p className="mt-5 font-utility text-[11px] tracking-[0.15em] text-white/35 uppercase">
              Solar EPC · Green Energy Projects · Grid-Scale Solar · O&amp;M · Consulting
            </p>
          </div>

          <div>
            <p className="font-utility text-[11px] tracking-[0.15em] text-white/40 uppercase mb-5">
              Sitemap
            </p>
            <ul className="space-y-3">
              {SITEMAP.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="py-1 text-white/60 hover:text-white text-sm transition-all duration-200 hover:translate-x-1 inline-flex items-center gap-1.5 group"
                  >
                    <span className="w-0 group-hover:w-2.5 overflow-hidden transition-all duration-200 opacity-0 group-hover:opacity-100">
                      <span className="block h-px bg-[#f7a800]" />
                    </span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-utility text-[11px] tracking-[0.15em] text-white/40 uppercase mb-5">
              Legal
            </p>
            <ul className="space-y-3">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="py-1 text-white/60 hover:text-white text-sm transition-all duration-200 hover:translate-x-1 inline-flex items-center gap-1.5 group"
                  >
                    <span className="w-0 group-hover:w-2.5 overflow-hidden transition-all duration-200 opacity-0 group-hover:opacity-100">
                      <span className="block h-px bg-[#f7a800]" />
                    </span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-utility text-[11px] tracking-[0.15em] text-white/40 uppercase mb-5">
              Head Office
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
              <li className="flex gap-2.5 items-center">
                <Phone className="h-4 w-4 shrink-0 text-[#f7a800]" />
                <a href="tel:+919874774440" className="hover:text-white transition-colors">
                  +91 98747 74440
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
                title="Grid Nova Energy office location"
              />
            </div>
          </div>
        </div>

        <div className="mt-16 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3">
          <Link
            href="/"
            onClick={handleHomeClick}
            className="text-white/35 hover:text-white/55 text-xs font-utility transition-colors duration-200"
          >
            © {new Date().getFullYear()} Grid Nova Energy. All rights
            reserved.
          </Link>
          <div className="flex items-center gap-4">
            <p className="text-white/35 text-xs font-utility">
              Designed &amp; engineered by{" "}
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
