import { ArrowRight, Mail, Phone } from "lucide-react";
import Link from "@/components/i18n/Link";
import ScrollReveal from "@/components/ScrollReveal";
import AssociateWalkthrough from "@/components/careers/AssociateWalkthrough";
import { WithPending } from "@/components/legal/Pending";
import { ASSOCIATE_PORTAL_OPEN, ASSOCIATE_ROUTES } from "@/lib/associates";
import { messagesFor, resolveLocale, type LangParams } from "@/lib/i18n/messages";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = localizedMetadata("careers", "/careers");

const sectionHeading =
  "mt-4 font-display text-[#0e2a63] text-[clamp(1.4rem,7vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium text-balance";

// Apply / sign-in entry points. Until the Phase 2 routes exist
// (ASSOCIATE_PORTAL_OPEN) each renders as a clearly labelled, non-clickable
// "Opening soon" button — never a link to a page that doesn't exist yet.
function PortalButton({
  href,
  label,
  soon,
  variant,
}: {
  href: string;
  label: string;
  soon: string;
  variant: "btn-primary" | "btn-secondary";
}) {
  if (ASSOCIATE_PORTAL_OPEN) {
    return (
      <Link href={href} className={`btn ${variant}`}>
        {label}
      </Link>
    );
  }
  return (
    <span role="link" aria-disabled="true" className={`btn ${variant} flex-col !gap-0.5 !py-2.5 text-center`}>
      <span>{label}</span>
      <span className="font-normal text-[11px] opacity-80">{soon}</span>
    </span>
  );
}

export default async function CareersPage({ params }: LangParams) {
  const m = messagesFor(await resolveLocale(params));
  const t = m.careers;
  const pending = (text: string) => <WithPending text={text} label={t.pendingLabel} />;

  return (
    <main>
      {/* Opening — two paths */}
      <section className="pt-[calc(var(--header-h)+4rem)] pb-16 md:pb-24 bg-white border-b border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
            <span className="ref-tag text-[#2f5daa]">{t.hero.eyebrow}</span>
            <h1
              className="mt-5 font-display text-[#0e2a63] font-medium leading-[1.0] text-balance max-w-[16ch]"
              style={{ fontSize: "clamp(2.2rem,8vw,4.5rem)" }}
            >
              {t.hero.title}
            </h1>
            <p className="mt-6 text-[#111827]/65 text-lg leading-relaxed max-w-[58ch]">{t.hero.intro}</p>
          </ScrollReveal>
          <div className="mt-12 grid md:grid-cols-2 gap-5">
            <ScrollReveal delay={0.05} className="h-full">
              <a href="#associates" className="group flex flex-col h-full rounded-2xl bg-[#0e2a63] p-7 md:p-9 text-white">
                <h2 className="font-display text-2xl font-semibold">{t.hero.associateTitle}</h2>
                <p className="mt-3 text-white/70 leading-relaxed flex-1">{t.hero.associateBody}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 font-utility text-sm font-semibold text-[#f7a800]">
                  {t.hero.associateCta}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </a>
            </ScrollReveal>
            <ScrollReveal delay={0.12} className="h-full">
              <a href="#careers" className="group flex flex-col h-full rounded-2xl border border-[#e4e8ee] bg-[#f7f9fc] p-7 md:p-9">
                <h2 className="font-display text-[#0e2a63] text-2xl font-semibold">{t.hero.careersTitle}</h2>
                <p className="mt-3 text-[#111827]/65 leading-relaxed flex-1">{t.hero.careersBody}</p>
                <span className="btn-text mt-6">
                  {t.hero.careersCta}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </a>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Associate programme */}
      <section id="associates" className="scroll-mt-28 bg-[#f7f9fc] py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
            <span className="ref-tag text-[#2f5daa]">{t.programme.eyebrow}</span>
            <h2 className={`${sectionHeading} max-w-[22ch]`}>{t.programme.title}</h2>
            <p className="mt-6 max-w-[62ch] rounded-xl border-l-4 border-[#f7a800] bg-white px-5 py-4 text-[#0e2a63] leading-relaxed">
              {t.programme.noFee}
            </p>
          </ScrollReveal>

          <div className="mt-10 grid lg:grid-cols-2 gap-5">
            {t.programme.programmes.map((prog, i) => (
              <ScrollReveal key={prog.id} delay={i * 0.08} className="h-full">
                <article className="h-full rounded-2xl border border-[#e4e8ee] bg-white p-7 md:p-8">
                  <h3 className="font-display text-[#0e2a63] text-2xl font-semibold">{prog.name}</h3>
                  <p className="mt-1.5 text-[#2f5daa] font-utility text-sm">{prog.tagline}</p>
                  <ul className="mt-5 space-y-3">
                    {prog.points.map((pt) => (
                      <li key={pt} className="flex gap-3 text-[#111827]/70 leading-relaxed">
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f7a800]" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </article>
              </ScrollReveal>
            ))}
          </div>

          <div className="mt-5 grid lg:grid-cols-3 gap-5">
            <ScrollReveal className="h-full">
              <div className="h-full rounded-2xl border border-[#e4e8ee] bg-white p-7">
                <h3 className="font-display text-[#0e2a63] text-lg font-semibold">{t.programme.eligibilityTitle}</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-[#111827]/70 leading-relaxed">
                  {t.programme.eligibility.map((e) => (
                    <li key={e} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0e2a63]" />{e}</li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.06} className="h-full lg:col-span-2">
              <div className="h-full rounded-2xl border border-[#e4e8ee] bg-white p-7 grid sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-display text-[#0e2a63] text-lg font-semibold">{t.programme.docsTitle}</h3>
                  <ul className="mt-4 space-y-2.5 text-sm text-[#111827]/70 leading-relaxed">
                    {t.programme.docs.map((doc) => (
                      <li key={doc} className="flex gap-2.5">
                        <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[#0e2a63]/40" aria-hidden="true" />
                        {doc}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-display text-[#0e2a63] text-lg font-semibold">{t.programme.docsPreferredTitle}</h3>
                  <ul className="mt-4 space-y-2.5 text-sm text-[#111827]/70 leading-relaxed">
                    {t.programme.docsPreferred.map((doc) => (
                      <li key={doc} className="flex gap-2.5">
                        <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[#0e2a63]/40" aria-hidden="true" />
                        {doc}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal>
            <div className="mt-5 rounded-2xl bg-[#0e2a63] p-7 md:p-9 text-white">
              <h3 className="font-display text-xl md:text-2xl font-semibold">{t.programme.earningsTitle}</h3>
              <ol className="mt-5 grid md:grid-cols-2 gap-x-10 gap-y-4">
                {t.programme.earnings.map((e, i) => (
                  <li key={e} className="flex gap-3.5 text-white/80 leading-relaxed">
                    <span className="font-display text-[#f7a800] font-semibold shrink-0">{i + 1}.</span>
                    <span>{pending(e)}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-white/55 text-sm">{t.programme.earningsNote}</p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* How it works — illustrated walkthrough */}
      <section className="bg-white py-20 md:py-28 border-t border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
            <span className="ref-tag text-[#2f5daa]">{t.howItWorks.eyebrow}</span>
            <h2 className={`${sectionHeading} max-w-[20ch]`}>{t.howItWorks.title}</h2>
            <p className="mt-5 text-[#111827]/60 leading-relaxed max-w-[60ch]">{t.howItWorks.intro}</p>
          </ScrollReveal>
          <AssociateWalkthrough t={t.howItWorks} journey={m.home.journey.steps} pendingLabel={t.pendingLabel} />
        </div>
      </section>

      {/* Guidelines */}
      <section className="bg-[#f7f9fc] py-20 md:py-28 border-t border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
            <span className="ref-tag text-[#2f5daa]">{t.guidelines.eyebrow}</span>
            <h2 className={`${sectionHeading} max-w-[20ch]`}>{t.guidelines.title}</h2>
          </ScrollReveal>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {t.guidelines.items.map((g, i) => (
              <ScrollReveal key={g.title} delay={i * 0.06} className="h-full">
                <div className="h-full rounded-2xl border border-[#e4e8ee] bg-white p-6">
                  <h3 className="font-display text-[#0e2a63] text-lg font-semibold">{g.title}</h3>
                  <p className="mt-2 text-[#111827]/65 text-sm leading-relaxed">{g.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <div className="mt-5 grid lg:grid-cols-2 gap-5">
            <ScrollReveal className="h-full">
              <div className="h-full rounded-2xl border border-[#e4e8ee] bg-white p-7">
                <h3 className="font-display text-[#0e2a63] text-lg font-semibold">{t.guidelines.photoTitle}</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-[#111827]/70 leading-relaxed">
                  {t.guidelines.photoTips.map((tip) => (
                    <li key={tip} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f7a800]" />{tip}</li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.06} className="h-full">
              <div className="h-full rounded-2xl border border-[#e4e8ee] bg-white p-7">
                <h3 className="font-display text-[#0e2a63] text-lg font-semibold">{t.guidelines.portalTitle}</h3>
                <ol className="mt-4 space-y-2.5 text-sm text-[#111827]/70 leading-relaxed">
                  {t.guidelines.portalSteps.map((s, i) => (
                    <li key={s} className="flex gap-2.5">
                      <span className="font-utility font-semibold text-[#0e2a63] shrink-0">{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs text-[#111827]/50">{t.guidelines.portalNote}</p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Apply / sign in */}
      <section className="on-dark bg-[#091c3c] py-20 md:py-24">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
            <span className="ref-tag text-[#f7a800]">{t.join.eyebrow}</span>
            <h2 className="mt-4 font-display text-white text-[clamp(1.4rem,7vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium">
              {t.join.title}
            </h2>
          </ScrollReveal>
          <div className="mt-10 grid md:grid-cols-2 gap-5">
            <ScrollReveal className="h-full">
              <div className="h-full rounded-2xl bg-white/5 border border-white/10 p-7">
                <h3 className="font-display text-white text-xl font-semibold">{t.join.applyTitle}</h3>
                <div className="mt-5 flex flex-wrap gap-3">
                  <PortalButton href={ASSOCIATE_ROUTES.applyAssociate} label={t.join.applyAssociate} soon={t.join.openingSoon} variant="btn-primary" />
                  <PortalButton href={ASSOCIATE_ROUTES.applyPreferred} label={t.join.applyPreferred} soon={t.join.openingSoon} variant="btn-primary" />
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.06} className="h-full">
              <div className="h-full rounded-2xl bg-white/5 border border-white/10 p-7">
                <h3 className="font-display text-white text-xl font-semibold">{t.join.loginTitle}</h3>
                <p className="mt-2 text-white/60 text-sm leading-relaxed">{t.join.loginBody}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <PortalButton href={ASSOCIATE_ROUTES.associateSignIn} label={t.join.loginAssociate} soon={t.join.openingSoon} variant="btn-secondary" />
                  <PortalButton href={ASSOCIATE_ROUTES.preferredSignIn} label={t.join.loginPreferred} soon={t.join.openingSoon} variant="btn-secondary" />
                </div>
              </div>
            </ScrollReveal>
          </div>
          {!ASSOCIATE_PORTAL_OPEN && (
            <p className="mt-6 text-white/60 text-sm leading-relaxed max-w-[70ch]">{t.join.openingSoonNote}</p>
          )}
        </div>
      </section>

      {/* FAQ + helpline */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10 grid lg:grid-cols-[1.4fr_0.6fr] gap-10 lg:gap-16 items-start">
          <div>
            <span className="ref-tag text-[#2f5daa]">{t.faq.eyebrow}</span>
            <h2 className={sectionHeading}>{t.faq.title}</h2>
            <div className="mt-8 divide-y divide-[#e4e8ee] border-y border-[#e4e8ee]">
              {t.faq.items.map((item) => (
                <details key={item.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-display text-[#0e2a63] text-lg font-semibold">
                    {item.q}
                    <span className="mt-1 text-[#2f5daa] transition-transform duration-300 group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-3 text-[#111827]/65 leading-relaxed max-w-[62ch]">{pending(item.a)}</p>
                </details>
              ))}
            </div>
          </div>
          <aside className="rounded-2xl bg-[#f7f9fc] border border-[#e4e8ee] p-7 lg:sticky lg:top-28">
            <h3 className="font-display text-[#0e2a63] text-lg font-semibold">{t.faq.helplineTitle}</h3>
            <p className="mt-2 text-[#111827]/60 text-sm leading-relaxed">{t.faq.helplineBody}</p>
            <a href="tel:+919874774440" className="mt-5 flex items-center gap-2.5 font-display text-[#0e2a63] text-xl font-bold">
              <Phone className="h-4 w-4 text-[#f7a800]" /> +91 98747 74440
            </a>
            <a href="mailto:info@gridnova.in" className="mt-2 flex items-center gap-2.5 font-utility text-[#0e2a63]">
              <Mail className="h-4 w-4 text-[#f7a800]" /> info@gridnova.in
            </a>
          </aside>
        </div>
      </section>

      {/* Careers — the existing content, kept */}
      <section id="careers" className="scroll-mt-28 bg-[#f7f9fc] py-20 md:py-28 border-t border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
            <span className="ref-tag text-[#2f5daa]">{t.jobs.eyebrow}</span>
            <h2 className="mt-4 font-display text-[#0e2a63] font-medium leading-[1.0] text-balance" style={{ fontSize: "clamp(2rem,6vw,3.75rem)" }}>
              {t.jobs.title}
            </h2>
            <p className="mt-6 text-[#111827]/65 text-lg leading-relaxed max-w-[56ch]">{t.jobs.intro}</p>
          </ScrollReveal>

          <ScrollReveal y={28}>
            <div className="mt-14 grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16 items-start">
              <div>
                <h3 className="font-display text-[#0e2a63] text-2xl md:text-3xl font-semibold leading-snug">{t.jobs.thriveTitle}</h3>
                <p className="mt-5 text-[#111827]/60 leading-relaxed">{t.jobs.thrive1}</p>
                <p className="mt-4 text-[#111827]/60 leading-relaxed">{t.jobs.thrive2}</p>
              </div>
              <div className="space-y-6">
                {t.jobs.values.map((v) => (
                  <div key={v.label} className="flex gap-5 items-start">
                    <div className="mt-1 h-2 w-2 rounded-full bg-[#f7a800] shrink-0" />
                    <div>
                      <p className="font-display text-[#0e2a63] font-semibold">{v.label}</p>
                      <p className="mt-1 text-[#111827]/60 text-sm leading-relaxed">{v.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal y={28}>
            <div className="mt-16 max-w-[640px] rounded-2xl border border-[#e4e8ee] bg-white p-7 md:p-9">
              <p className="font-utility text-[11px] tracking-[0.18em] text-[#111827]/40 uppercase mb-4">{t.jobs.openingsLabel}</p>
              <h3 className="font-display text-[#0e2a63] text-2xl font-semibold">{t.jobs.openingsTitle}</h3>
              <p className="mt-4 text-[#111827]/60 leading-relaxed max-w-[50ch]">{t.jobs.openingsBody}</p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href={`mailto:careers@gridnova.in?subject=${encodeURIComponent(t.jobs.mailSubject)}`}
                  className="btn btn-primary group"
                >
                  <Mail className="h-4 w-4" />
                  {t.jobs.emailCv}
                </a>
                <Link href="/about" className="btn btn-secondary">
                  {t.jobs.learnAbout}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
