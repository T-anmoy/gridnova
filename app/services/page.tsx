import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import CTASection from "@/components/CTASection";
import ServicesContent from "@/components/ServicesContent";

export const metadata: Metadata = pageMetadata({
  title: "Solar Services",
  description:
    "Grid Nova Energy delivers solar EPC, rooftop and ground-mounted solar, government & institutional solar, street lighting, water pumps, O&M and energy consulting — engineered for lifetime performance across India.",
  path: "/services",
});

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Grid Nova Energy — Solar Services",
  itemListElement: [
    { "@type": "ListItem", position: 1, item: { "@type": "Service", name: "Solar EPC Services", description: "End-to-end engineering, procurement and construction of grid-connected and off-grid solar power plants.", provider: { "@type": "Organization", name: "Grid Nova Energy" } } },
    { "@type": "ListItem", position: 2, item: { "@type": "Service", name: "Green Energy Projects", description: "Distributed and rooftop solar systems for residential, commercial and industrial buildings.", provider: { "@type": "Organization", name: "Grid Nova Energy" } } },
    { "@type": "ListItem", position: 3, item: { "@type": "Service", name: "Grid-Scale Solar Infrastructure", description: "Design and execution support for ground-mounted, large-scale solar power plants.", provider: { "@type": "Organization", name: "Grid Nova Energy" } } },
    { "@type": "ListItem", position: 4, item: { "@type": "Service", name: "Government & Institutional Solar", description: "Grid-connected rooftop solar for schools and public institutions, delivered to government programme quality and documentation standards.", provider: { "@type": "Organization", name: "Grid Nova Energy" } } },
    { "@type": "ListItem", position: 5, item: { "@type": "Service", name: "Solar Street Lighting", description: "Standalone solar street lighting systems supplied, installed and commissioned under government rural electrification programmes.", provider: { "@type": "Organization", name: "Grid Nova Energy" } } },
    { "@type": "ListItem", position: 6, item: { "@type": "Service", name: "Solar Water Pumps", description: "Solarisation of agricultural pump sets under PM-KUSUM Component C.", provider: { "@type": "Organization", name: "Grid Nova Energy" } } },
    { "@type": "ListItem", position: 7, item: { "@type": "Service", name: "Operation & Maintenance", description: "Preventive and corrective solar system maintenance programs.", provider: { "@type": "Organization", name: "Grid Nova Energy" } } },
    { "@type": "ListItem", position: 8, item: { "@type": "Service", name: "Energy Consulting", description: "Feasibility studies, site assessment, system design and DISCOM regulatory support.", provider: { "@type": "Organization", name: "Grid Nova Energy" } } },
  ],
};

export default function ServicesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <main>
        <ServicesContent />

        {/* Solar EPC / rooftop enquirers — route to the dedicated estimate form
            rather than the general contact form. "Get a Quote" in the header
            still points to /contact, unchanged. */}
        <section className="bg-white py-16 md:py-20 border-t border-[#e4e8ee]">
          <div className="mx-auto max-w-[1280px] px-6 md:px-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="font-display text-[#0e2a63] text-xl md:text-2xl font-semibold">
                Considering rooftop or ground-mounted solar?
              </h2>
              <p className="mt-2 text-[#111827]/60 leading-relaxed max-w-[52ch]">
                Tell us about your site and our team will follow up to discuss
                a system suited to your needs.
              </p>
            </div>
            <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
              <Link
                href="/estimate"
                className="inline-flex items-center gap-2 rounded-full bg-[#f7a800] text-[#091c3c] font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#0e2a63] hover:text-white transition-colors duration-300 active:scale-[0.97] w-fit"
              >
                Get Your Solar Estimate
                <ArrowRight className="h-4 w-4" />
              </Link>
              {/* Additional entry point alongside (not replacing) the estimate
                  form above — a faster path for a visitor who wants an
                  instant indicative number before leaving contact details,
                  rather than a form that only promises human follow-up. */}
              <Link
                href="/solar-calculator"
                className="inline-flex items-center gap-1.5 font-utility text-sm font-semibold text-[#0e2a63] hover:text-[#2f5daa] transition-colors duration-300"
              >
                Or try our instant Solar Calculator
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>

        <CTASection />
      </main>
    </>
  );
}
