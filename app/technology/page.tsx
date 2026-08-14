import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import TechPageContent from "@/components/technology/TechPageContent";

export const metadata: Metadata = pageMetadata({
  title: "Technology & Capabilities",
  description:
    "The engineering process behind every Grid Nova Energy installation — from feasibility to long-term O&M, built on certified components and MNRE-compliant design.",
  path: "/technology",
});

export default function TechnologyPage() {
  return (
    <main>
      <TechPageContent />
    </main>
  );
}
