import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import AboutHero from "@/components/about/AboutHero";
import CompanyOverview from "@/components/about/CompanyOverview";
import CompetitiveAdvantage from "@/components/about/CompetitiveAdvantage";
import CoreValuesTimeline from "@/components/about/CoreValuesTimeline";
import TechnologyCapabilities from "@/components/about/TechnologyCapabilities";
import LeadershipPreview from "@/components/LeadershipPreview";
import CTASection from "@/components/CTASection";

export const metadata: Metadata = pageMetadata({
  title: "About Us",
  description:
    "Grid Nova Energy designs, develops and implements solar power systems across India — engineering excellence, integrity and lifecycle performance since inception.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <main>
      <AboutHero />
      <CompanyOverview />
      <CompetitiveAdvantage />
      <CoreValuesTimeline />
      <TechnologyCapabilities />
      <LeadershipPreview />
      <CTASection />
    </main>
  );
}
