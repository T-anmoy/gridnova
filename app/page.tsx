import type { Metadata } from "next";
import Hero from "@/components/Hero";
import ServicesGrid from "@/components/ServicesGrid";
import Mission from "@/components/Mission";
import TargetMarkets from "@/components/TargetMarkets";
import FeaturedProject from "@/components/FeaturedProject";
import Sustainability from "@/components/Sustainability";
import LeadershipPreview from "@/components/LeadershipPreview";
import CTASection from "@/components/CTASection";

export const metadata: Metadata = {
  title: "Grid Nova Energy | Engineering India's Clean Energy Future",
  description:
    "Grid Nova Energy delivers solar EPC, rooftop solar, utility-scale and O&M solutions across India — 4,800+ street lamps, 330+ schools, 2,350+ PM-KUSUM pumps commissioned.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <main>
      <Hero />
      <ServicesGrid />
      <Mission />
      <TargetMarkets />
      <FeaturedProject />
      <Sustainability />
      <LeadershipPreview />
      <CTASection />
    </main>
  );
}
