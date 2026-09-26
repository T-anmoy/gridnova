import AboutHero from "@/components/about/AboutHero";
import CompanyOverview from "@/components/about/CompanyOverview";
import CompetitiveAdvantage from "@/components/about/CompetitiveAdvantage";
import CoreValuesTimeline from "@/components/about/CoreValuesTimeline";
import TechnologyCapabilities from "@/components/about/TechnologyCapabilities";
import LeadershipPreview from "@/components/LeadershipPreview";
import CTASection from "@/components/CTASection";
import { messagesFor, resolveLocale, type LangParams } from "@/lib/i18n/messages";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = localizedMetadata("about", "/about");

export default async function AboutPage({ params }: LangParams) {
  const m = messagesFor(await resolveLocale(params));
  const t = m.about;
  return (
    <main>
      <AboutHero t={t.hero} />
      <CompanyOverview t={t.overview} />
      <CompetitiveAdvantage t={t.advantage} />
      <CoreValuesTimeline t={t.values} />
      <TechnologyCapabilities t={t.capabilities} />
      <LeadershipPreview t={m.home.leadership} leaders={m.leaders} />
      <CTASection t={m.cta} />
    </main>
  );
}
