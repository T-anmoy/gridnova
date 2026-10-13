import type { Metadata } from "next";
import Hero from "@/components/Hero";
import ServicesGrid from "@/components/ServicesGrid";
import Mission from "@/components/Mission";
import TargetMarkets from "@/components/TargetMarkets";
import ProjectJourney from "@/components/ProjectJourney";
import ProjectStrip from "@/components/ProjectStrip";
import LeadershipPreview from "@/components/LeadershipPreview";
import AssociateBand from "@/components/AssociateBand";
import CTASection from "@/components/CTASection";
import { messagesFor, resolveLocale, type LangParams } from "@/lib/i18n/messages";
import { localizeHref } from "@/lib/i18n/config";
import { languageAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { title, description } = (await messagesFor(locale)).meta.pages.home;
  return {
    title,
    description,
    alternates: { canonical: localizeHref("/", locale), languages: languageAlternates("/") },
  };
}

// Section order alternates light and dark surfaces and varies how each one
// opens (split header, photo-first, centred) so the page doesn't read as one
// repeated template.
export default async function Home({ params }: LangParams) {
  const m = (await messagesFor(await resolveLocale(params)));
  return (
    <main id="main-content">
      <Hero t={m.home.hero} />
      <ServicesGrid t={m.home.services} />
      <TargetMarkets t={m.home.markets} />
      <ProjectJourney t={m.home.journey} />
      <Mission t={m.home.mission} />
      <ProjectStrip t={m.home.projects} districts={m.projects.districts.names} />
      <LeadershipPreview t={m.home.leadership} leaders={m.leaders} />
      <AssociateBand t={m.home.associate} />
      <CTASection t={m.cta} />
    </main>
  );
}
