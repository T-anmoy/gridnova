import TechPageContent from "@/components/technology/TechPageContent";
import CTASection from "@/components/CTASection";
import { messagesFor, resolveLocale, type LangParams } from "@/lib/i18n/messages";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = localizedMetadata("technology", "/technology");

export default async function TechnologyPage({ params }: LangParams) {
  const m = messagesFor(await resolveLocale(params));
  const t = m.technology;
  return (
    <main>
      <TechPageContent t={t} />
      <CTASection t={m.cta} />
    </main>
  );
}
