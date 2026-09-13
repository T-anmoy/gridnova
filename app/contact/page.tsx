import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import ContactForm from "./ContactForm";
import { Phone, Globe, MapPin, Mail, ArrowRight, Calendar } from "lucide-react";

export const metadata: Metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Reach Grid Nova Energy — solar EPC enquiries, site assessments and project discussions. Kolkata, West Bengal.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <main className="bg-[#f7f9fc] min-h-[100svh]">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 pt-[calc(var(--header-h)+3rem)] pb-20 md:pb-28">
        {/* Page heading — different from any other page on the site */}
        <div className="mb-14 md:mb-16">
          <h1
            className="font-display text-[#0e2a63] font-medium leading-[0.95] text-balance"
            style={{ fontSize: "clamp(2.2rem,7vw,5rem)" }}
          >
            Let&rsquo;s start with a conversation.
          </h1>
          <p className="mt-5 text-[#111827]/60 max-w-[50ch] leading-relaxed text-base md:text-lg">
            Tell us about your project — a site assessment, a feasibility
            question, or a full EPC enquiry. We&rsquo;ll respond with the
            right person, not a templated reply.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-20 items-start">
          {/* Contact info column */}
          <div className="space-y-10">
            <div>
              <p className="font-utility text-[11px] tracking-[0.22em] text-[#111827]/40 uppercase mb-6">
                Kolkata Office
              </p>
              <ul className="space-y-5">
                <li className="flex gap-3.5 text-[#111827]/70 leading-relaxed">
                  <MapPin className="h-5 w-5 text-[#f7a800] shrink-0 mt-0.5" />
                  <span>
                    Plot No. 83, Kasba Industrial Estate, Phase II<br />
                    Kolkata – 700107, West Bengal, India
                  </span>
                </li>
                <li className="flex gap-3.5 text-[#111827]/70 leading-relaxed">
                  <MapPin className="h-5 w-5 text-[#f7a800] shrink-0 mt-0.5" />
                  <span>
                    <span className="block font-utility text-[11px] tracking-[0.15em] text-[#111827]/40 uppercase mb-1">
                      Patna Office
                    </span>
                    C/O Parbati Bhawan, West Ram Krishna Nagar, New Bypass Road,<br />
                    Opposite Metro Pillar No. 81, P.O.- New Jaganpura,<br />
                    Patna – 800027, Bihar
                  </span>
                </li>
                <li className="flex gap-3.5 items-center">
                  <Phone className="h-5 w-5 text-[#f7a800] shrink-0" />
                  <a
                    href="tel:+919874774440"
                    className="text-[#0e2a63] font-utility font-semibold hover:text-[#2f5daa] transition-colors"
                  >
                    +91 98747 74440
                  </a>
                </li>
                <li className="flex gap-3.5 items-center">
                  <Globe className="h-5 w-5 text-[#f7a800] shrink-0" />
                  <a
                    href="https://www.gridnova.in"
                    className="text-[#0e2a63] font-utility hover:text-[#2f5daa] transition-colors"
                  >
                    www.gridnova.in
                  </a>
                </li>
                <li className="flex gap-3.5 items-center">
                  <Mail className="h-5 w-5 text-[#f7a800] shrink-0" />
                  <a
                    href="mailto:info@gridnova.in"
                    className="text-[#0e2a63] font-utility font-semibold hover:text-[#2f5daa] transition-colors"
                  >
                    info@gridnova.in
                  </a>
                </li>
              </ul>
            </div>

            {/* Real Google Maps — no overlay, full color */}
            <div>
              <p className="font-utility text-[11px] tracking-[0.22em] text-[#111827]/40 uppercase mb-4">
                Location
              </p>
              <div
                className="overflow-hidden rounded-2xl border border-[#e4e8ee]"
                style={{ aspectRatio: "4/3" }}
              >
                <iframe
                  src="https://www.google.com/maps?q=22.514723,88.405869&z=17&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Grid Nova Energy — Kolkata Office"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-[#e4e8ee]">
              <p className="font-utility text-[11px] tracking-[0.22em] text-[#111827]/40 uppercase mb-3">
                What to expect
              </p>
              <ul className="space-y-3 text-[#111827]/65 text-sm leading-relaxed">
                <li className="flex gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f7a800] mt-2 shrink-0" />
                  We respond to all enquiries within one business day.
                </li>
                <li className="flex gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f7a800] mt-2 shrink-0" />
                  Initial consultations are at no cost.
                </li>
                <li className="flex gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f7a800] mt-2 shrink-0" />
                  You&rsquo;ll speak with a project engineer, not a call centre.
                </li>
              </ul>
            </div>
          </div>

          {/* Booking (primary) + form (secondary) column */}
          <div>
            <div className="rounded-2xl border border-[#e4e8ee] bg-white p-7 md:p-9">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f7a800]/10">
                <Calendar className="h-5 w-5 text-[#f7a800]" />
              </div>
              <h2 className="mt-4 font-display text-[#0e2a63] text-xl font-semibold">
                Book a call with a Solar Advisor
              </h2>
              <p className="mt-2 text-[#111827]/60 leading-relaxed">
                30 minutes, no pressure. Pick a time that works and we&rsquo;ll call you —
                the fastest way to get a real person on the line.
              </p>
              <Link
                href={{ pathname: "/book-a-call", query: { source: "contact" } }}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#f7a800] text-[#091c3c] font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#0e2a63] hover:text-white transition-colors duration-300 active:scale-[0.97]"
              >
                Book a Call
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-[#e4e8ee]" />
              <p className="font-utility text-xs text-[#111827]/40 uppercase tracking-wider">
                Prefer to write instead?
              </p>
              <div className="h-px flex-1 bg-[#e4e8ee]" />
            </div>

            <div className="mt-8">
              {/* Client component for animated states */}
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
