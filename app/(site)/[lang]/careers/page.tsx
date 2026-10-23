import { ArrowRight, Mail, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import Link from "@/components/i18n/Link";
import AssociateWalkthrough from "@/components/careers/AssociateWalkthrough";
import CareersEnhancer from "@/components/careers/CareersEnhancer";
import Disclosure from "@/components/careers/Disclosure";
import ProgrammeCard from "@/components/careers/ProgrammeCard";
import ProgrammeTabs from "@/components/careers/ProgrammeTabs";
import StickyApplyBar from "@/components/careers/StickyApplyBar";
import { ASSOCIATE_PORTAL_OPEN, ASSOCIATE_ROUTES } from "@/lib/associates";
import { messagesFor, resolveLocale, type LangParams } from "@/lib/i18n/messages";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { HELPLINE_DISPLAY, HELPLINE_TEL, HELPLINE_WHATSAPP } from "@/lib/contact";

export const generateMetadata = localizedMetadata("careers", "/careers");

const sectionHeading =
  "mt-3 font-display text-[#0e2a63] text-[clamp(1.5rem,6.5vw,2.25rem)] md:text-[clamp(1.75rem,2.4vw,2.75rem)] leading-[1.1] font-medium text-balance";

// Apply / sign-in entry points. While ASSOCIATE_PORTAL_OPEN is false each
// renders as a clearly labelled, non-clickable "Opening soon" button — never
// a link to a page that doesn't exist yet.
function PortalButton({
  href,
  label,
  soon,
  variant,
  className = "",
}: {
  href: string;
  label: string;
  soon: string;
  variant: "btn-primary" | "btn-secondary";
  className?: string;
}) {
  if (ASSOCIATE_PORTAL_OPEN) {
    return (
      <Link href={href} className={`btn ${variant} min-h-[44px] ${className}`}>
        {label}
      </Link>
    );
  }
  return (
    <span role="link" aria-disabled="true" className={`btn ${variant} flex-col !gap-0.5 !py-2.5 text-center ${className}`}>
      <span>{label}</span>
      <span className="font-normal text-[11px] opacity-80">{soon}</span>
    </span>
  );
}

function Bullets({ items, dot = "bg-[#f7a800]" }: { items: string[]; dot?: string }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function CareersPage({ params }: LangParams) {
  const t = (await messagesFor(await resolveLocale(params))).careers;
  const n = t.needs;
  const topFaq = t.faq.items.slice(0, 5);
  const moreFaq = t.faq.items.slice(5);

  return (
    <main id="main-content">
      {/* 1 · Hero — the two paths, and the no-fee safety message */}
      <section data-apply-bar-hide="" className="pt-[calc(var(--header-h)+1.5rem)] md:pt-[calc(var(--header-h)+4rem)] pb-10 md:pb-20 bg-white border-b border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <span className="ref-tag text-[#2f5daa]">{t.hero.eyebrow}</span>
          <h1
            className="mt-4 font-display text-[#0e2a63] font-medium leading-[1.05] text-balance max-w-[18ch]"
            style={{ fontSize: "clamp(2rem,8vw,4rem)" }}
          >
            {t.hero.title}
          </h1>
          <p className="mt-3 text-[#111827]/70 md:text-lg leading-relaxed max-w-[52ch]">{t.hero.promise}</p>

          <div className="mt-6 grid md:grid-cols-2 gap-3 md:gap-5">
            <a
              href="#associates"
              className="group flex items-center gap-4 rounded-2xl bg-[#0e2a63] p-5 md:p-7 text-white transition-transform duration-300 hover:-translate-y-1"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl md:text-2xl font-semibold">{t.hero.associateTitle}</span>
                <span className="mt-1 block text-white/75 text-sm md:text-base leading-relaxed">{t.hero.associateBody}</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-[#f7a800] transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </a>
            <a
              href="#careers"
              className="group flex items-center gap-4 rounded-2xl border border-[#e4e8ee] bg-[#f7f9fc] p-5 md:p-7 transition-transform duration-300 hover:-translate-y-1"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[#0e2a63] text-xl md:text-2xl font-semibold">{t.hero.careersTitle}</span>
                <span className="mt-1 block text-[#111827]/70 text-sm md:text-base leading-relaxed">{t.hero.careersBody}</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-[#0e2a63] transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </a>
          </div>

          <p className="mt-5 flex gap-3 max-w-[70ch] rounded-xl border-l-4 border-[#f7a800] bg-[#fffaf0] px-4 py-3 text-sm text-[#0e2a63] leading-relaxed">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#b37a00]" aria-hidden="true" />
            <span>{t.hero.noFee}</span>
          </p>
        </div>
      </section>

      {/* 2 · Associate programme — Associate | Preferred Associate */}
      <section id="associates" className="scroll-mt-24 bg-[#f7f9fc] py-10 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <span className="ref-tag text-[#2f5daa]">{t.programme.eyebrow}</span>
          <h2 className={sectionHeading}>{t.programme.title}</h2>
          <ProgrammeTabs label={t.programme.tabsLabel} tabs={t.programme.programmes.map(({ id, name }) => ({ id, name }))} />
          {t.programme.programmes.map((p, i) => (
            <ProgrammeCard key={p.id} t={t.programme} p={p} open={i === 0} />
          ))}
        </div>
      </section>

      {/* 3 · How it works — four steps, swipe strip on small screens */}
      <section className="bg-white py-10 md:py-20 border-t border-[#e4e8ee] overflow-hidden">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <span className="ref-tag text-[#2f5daa]">{t.howItWorks.eyebrow}</span>
          <h2 className={sectionHeading}>{t.howItWorks.title}</h2>
          <p className="mt-3 text-[#111827]/65 leading-relaxed max-w-[60ch]">{t.howItWorks.intro}</p>
          <AssociateWalkthrough t={t.howItWorks} />
        </div>
      </section>

      {/* 4 · What you need — one accordion group, all closed */}
      <section className="bg-[#f7f9fc] py-10 md:py-20 border-t border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10 grid lg:grid-cols-[0.8fr_1.2fr] gap-6 lg:gap-16">
          <div>
            <span className="ref-tag text-[#2f5daa]">{n.eyebrow}</span>
            <h2 className={sectionHeading}>{n.title}</h2>
          </div>
          <div className="divide-y divide-[#e4e8ee] border-y border-[#e4e8ee]">
            <Disclosure title={n.eligibility.title} summary={n.eligibility.summary}>
              <Bullets items={n.eligibility.items} dot="bg-[#0e2a63]" />
            </Disclosure>
            <Disclosure title={n.docs.title} summary={n.docs.summary}>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <h3 className="font-utility text-sm font-semibold text-[#0e2a63]">{n.docs.allTitle}</h3>
                  <div className="mt-2"><Bullets items={n.docs.all} dot="bg-[#0e2a63]" /></div>
                </div>
                <div>
                  <h3 className="font-utility text-sm font-semibold text-[#0e2a63]">{n.docs.preferredTitle}</h3>
                  <div className="mt-2"><Bullets items={n.docs.preferred} dot="bg-[#0e2a63]" /></div>
                </div>
              </div>
            </Disclosure>
            <Disclosure title={n.pay.title} summary={n.pay.summary}>
              <Bullets items={n.pay.items} />
            </Disclosure>
            <Disclosure title={n.rules.title} summary={n.rules.summary}>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                {n.rules.items.map((r) => (
                  <div key={r.title}>
                    <dt className="font-utility text-sm font-semibold text-[#0e2a63]">{r.title}</dt>
                    <dd className="mt-1 text-sm">{r.body}</dd>
                  </div>
                ))}
              </dl>
            </Disclosure>
            <Disclosure title={n.photos.title} summary={n.photos.summary}>
              <Bullets items={n.photos.items} />
            </Disclosure>
            <Disclosure title={n.suryaGhar.title} summary={n.suryaGhar.summary}>
              <ol className="space-y-2.5">
                {n.suryaGhar.steps.map((s, i) => (
                  <li key={s} className="flex gap-2.5">
                    <span className="font-utility font-semibold text-[#0e2a63] shrink-0">{i + 1}.</span>
                    {s}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-sm text-[#111827]/65">{n.suryaGhar.note}</p>
            </Disclosure>
          </div>
        </div>
      </section>

      {/* 5 · Apply / sign in */}
      <section id="apply" data-apply-bar-hide="" className="on-dark scroll-mt-24 bg-[#091c3c] py-10 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <span className="ref-tag text-[#f7a800]">{t.join.eyebrow}</span>
          <h2 className="mt-3 font-display text-white text-[clamp(1.5rem,6.5vw,2.25rem)] md:text-[clamp(1.75rem,2.4vw,2.75rem)] leading-[1.1] font-medium">
            {t.join.title}
          </h2>
          <div className="mt-7 grid md:grid-cols-2 gap-6 md:gap-10">
            <div>
              <h3 className="font-display text-white text-lg font-semibold">{t.join.applyTitle}</h3>
              <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap gap-3">
                <PortalButton href={ASSOCIATE_ROUTES.applyAssociate} label={t.join.applyAssociate} soon={t.join.openingSoon} variant="btn-primary" />
                <PortalButton href={ASSOCIATE_ROUTES.applyPreferred} label={t.join.applyPreferred} soon={t.join.openingSoon} variant="btn-primary" />
              </div>
            </div>
            <div>
              <h3 className="font-display text-white text-lg font-semibold">{t.join.loginTitle}</h3>
              <p className="mt-1 text-white/65 text-sm leading-relaxed">{t.join.loginBody}</p>
              <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap gap-3">
                <PortalButton href={ASSOCIATE_ROUTES.associateSignIn} label={t.join.loginAssociate} soon={t.join.openingSoon} variant="btn-secondary" />
                <PortalButton href={ASSOCIATE_ROUTES.preferredSignIn} label={t.join.loginPreferred} soon={t.join.openingSoon} variant="btn-secondary" />
              </div>
            </div>
          </div>
          {!ASSOCIATE_PORTAL_OPEN && (
            <p className="mt-6 text-white/65 text-sm leading-relaxed max-w-[70ch]">{t.join.openingSoonNote}</p>
          )}
        </div>
      </section>

      {/* 6 · FAQ + helpline */}
      <section className="bg-white py-10 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10 grid lg:grid-cols-[1.4fr_0.6fr] gap-8 lg:gap-16 items-start">
          <div>
            <span className="ref-tag text-[#2f5daa]">{t.faq.eyebrow}</span>
            <h2 className={sectionHeading}>{t.faq.title}</h2>
            <div className="mt-6 divide-y divide-[#e4e8ee] border-y border-[#e4e8ee]">
              {topFaq.map((item) => (
                <Disclosure key={item.q} title={item.q}>
                  <p className="max-w-[62ch]">{item.a}</p>
                </Disclosure>
              ))}
              {moreFaq.length > 0 && (
                <Disclosure title={t.faq.more} titleClassName="font-utility text-sm font-semibold text-[#2f5daa]">
                  <div className="divide-y divide-[#e4e8ee] border-t border-[#e4e8ee]">
                    {moreFaq.map((item) => (
                      <Disclosure key={item.q} title={item.q}>
                        <p className="max-w-[62ch]">{item.a}</p>
                      </Disclosure>
                    ))}
                  </div>
                </Disclosure>
              )}
            </div>
          </div>
          <aside className="rounded-2xl bg-[#f7f9fc] border border-[#e4e8ee] p-6 lg:sticky lg:top-28">
            <h3 className="font-display text-[#0e2a63] text-lg font-semibold">{t.faq.helplineTitle}</h3>
            <p className="mt-1 text-[#111827]/65 text-sm leading-relaxed">{t.faq.helplineBody}</p>
            <p className="mt-3 font-display text-[#0e2a63] text-xl font-bold">{HELPLINE_DISPLAY}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={HELPLINE_TEL} className="btn btn-primary min-h-[44px]">
                <Phone className="h-4 w-4" aria-hidden="true" /> {t.faq.call}
              </a>
              <a href={HELPLINE_WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn btn-secondary min-h-[44px]">
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> {t.faq.whatsapp}
              </a>
            </div>
            <a href="mailto:info@gridnova.in" className="mt-4 inline-flex min-h-[44px] items-center gap-2.5 font-utility text-[#0e2a63]">
              <Mail className="h-4 w-4 text-[#f7a800]" aria-hidden="true" /> info@gridnova.in
            </a>
          </aside>
        </div>
      </section>

      {/* 7 · Work at Grid Nova */}
      <section id="careers" data-apply-bar-hide="" className="scroll-mt-24 bg-[#f7f9fc] py-10 md:py-20 border-t border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <span className="ref-tag text-[#2f5daa]">{t.jobs.eyebrow}</span>
          <h2 className={sectionHeading}>{t.jobs.title}</h2>
          <p className="mt-3 text-[#111827]/70 leading-relaxed max-w-[60ch]">{t.jobs.intro}</p>
          <ul className="mt-6 grid sm:grid-cols-3 rounded-2xl border border-[#e4e8ee] bg-white divide-y sm:divide-y-0 sm:divide-x divide-[#e4e8ee]">
            {t.jobs.values.map((v) => (
              <li key={v.label} className="flex gap-3 p-4 md:p-6">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#f7a800]" aria-hidden="true" />
                <div>
                  <p className="font-display text-[#0e2a63] font-semibold">{v.label}</p>
                  <p className="mt-1 text-[#111827]/65 text-sm leading-relaxed">{v.desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-2xl border border-[#e4e8ee] bg-white p-5 md:p-8 md:flex md:items-center md:justify-between md:gap-10">
            <div>
              <h3 className="font-display text-[#0e2a63] text-xl font-semibold">{t.jobs.openingsTitle}</h3>
              <p className="mt-2 text-[#111827]/65 leading-relaxed max-w-[60ch]">{t.jobs.openingsBody}</p>
            </div>
            <div className="mt-5 md:mt-0 flex flex-wrap gap-3 shrink-0">
              <a
                href={`mailto:careers@gridnova.in?subject=${encodeURIComponent(t.jobs.mailSubject)}`}
                className="btn btn-primary min-h-[44px]"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                {t.jobs.emailCv}
              </a>
              <Link href="/about" className="btn btn-secondary min-h-[44px]">
                {t.jobs.learnAbout}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <StickyApplyBar>
        {ASSOCIATE_PORTAL_OPEN ? (
          <a href="#apply" className="btn btn-primary w-full min-h-[56px] shadow-lg">
            {t.join.barApply}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : (
          <span role="link" aria-disabled="true" className="btn btn-primary w-full min-h-[56px] flex-col !gap-0.5 !py-2 shadow-lg">
            <span>{t.join.barApply}</span>
            <span className="font-normal text-[11px] opacity-80">{t.join.openingSoon}</span>
          </span>
        )}
      </StickyApplyBar>
      <CareersEnhancer />
    </main>
  );
}
