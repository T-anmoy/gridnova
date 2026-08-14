import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import CTASection from "@/components/CTASection";
import ServicesContent from "@/components/ServicesContent";

export const metadata: Metadata = pageMetadata({
  title: "Solar Services",
  description:
    "Grid Nova Energy delivers solar EPC, green energy projects, grid-scale solar infrastructure, O&M and energy consulting — engineered for lifetime performance across India.",
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
    { "@type": "ListItem", position: 4, item: { "@type": "Service", name: "Operation & Maintenance", description: "Preventive and corrective solar system maintenance programs.", provider: { "@type": "Organization", name: "Grid Nova Energy" } } },
    { "@type": "ListItem", position: 5, item: { "@type": "Service", name: "Energy Consulting", description: "Feasibility studies, site assessment, system design and DISCOM regulatory support.", provider: { "@type": "Organization", name: "Grid Nova Energy" } } },
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
        <CTASection />
      </main>
    </>
  );
}
