import { Camera, Check, QrCode } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import { WithPending } from "@/components/legal/Pending";
import type { Messages } from "@/lib/i18n/types";

type T = Messages["careers"]["howItWorks"];
type Screen = T["steps"][number]["screen"];

// Step-by-step walkthrough of the Associate portal, told through small mock
// screens. Every screen is stamped "Illustration" and uses placeholder data
// ("Sample customer", "Your name", no amounts) — nothing here is a real
// customer, a real ID format or a real figure.
export default function AssociateWalkthrough({
  t,
  journey,
  pendingLabel,
}: {
  t: T;
  journey: Messages["home"]["journey"]["steps"];
  pendingLabel: string;
}) {
  return (
    <ol className="mt-12 space-y-6">
      {t.steps.map((step, i) => (
        <ScrollReveal key={step.title} delay={0.04}>
          <li className="grid md:grid-cols-[1fr_1.1fr] gap-6 md:gap-10 items-center rounded-2xl border border-[#e4e8ee] bg-white p-5 md:p-8">
            <div className={i % 2 === 1 ? "md:order-2" : ""}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0e2a63] font-utility text-xs font-semibold text-[#0e2a63]">
                {i + 1}
              </span>
              <h3 className="mt-4 font-display text-[#0e2a63] text-xl md:text-2xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-[#111827]/65 leading-relaxed max-w-[48ch]">
                <WithPending text={step.body} label={pendingLabel} />
              </p>
            </div>
            <MockFrame label={t.illustration}>
              <MockScreen index={i} screen={step.screen} journey={journey} />
            </MockFrame>
          </li>
        </ScrollReveal>
      ))}
    </ol>
  );
}

function MockFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="relative rounded-2xl bg-[#f7f9fc] border border-[#e4e8ee] p-4 md:p-5" aria-label={label}>
      <figcaption className="absolute -top-2.5 right-4 rounded-full bg-[#0e2a63] px-2.5 py-0.5 font-utility text-[10px] font-semibold text-white">
        {label}
      </figcaption>
      <div className="rounded-xl bg-white border border-[#e4e8ee] shadow-[0_12px_30px_-18px_rgba(9,28,60,0.35)] p-4 text-sm" aria-hidden="true">
        {children}
      </div>
    </figure>
  );
}

function MockScreen({
  index,
  screen,
  journey,
}: {
  index: number;
  screen: Screen;
  journey: Messages["home"]["journey"]["steps"];
}) {
  const heading = <p className="font-display font-semibold text-[#0e2a63]">{screen.heading}</p>;

  if (index === 0 && screen.fields) {
    return (
      <div>
        {heading}
        <div className="mt-3 space-y-2">
          {screen.fields.map((f) => (
            <div key={f} className="rounded-lg border border-[#e4e8ee] px-3 py-2 text-[#111827]/45 text-xs font-utility">{f}</div>
          ))}
        </div>
        <p className="mt-3 inline-flex rounded-full bg-[#fff1c2] px-2.5 py-1 text-[11px] font-utility text-[#6b4700]">{screen.status}</p>
      </div>
    );
  }

  if (index === 1 && screen.qr) {
    return (
      <div className="flex items-center gap-4">
        <div className="h-20 w-16 shrink-0 rounded-lg bg-[#e4e8ee]" />
        <div className="flex-1 min-w-0">
          {heading}
          <p className="mt-1 text-[#0e2a63] text-xs font-utility">{screen.name}</p>
          <p className="text-[#111827]/50 text-xs font-utility">{screen.role}</p>
          <p className="mt-1 text-[#111827]/50 text-xs font-utility">{screen.id}: ••••••</p>
        </div>
        <div className="flex flex-col items-center gap-1 text-[#0e2a63]">
          <QrCode className="h-12 w-12" />
          <span className="text-[10px] font-utility text-[#111827]/50">{screen.qr}</span>
        </div>
      </div>
    );
  }

  if (index === 2 && screen.notice) {
    return (
      <div>
        {heading}
        <ul className="mt-3 space-y-2 text-xs font-utility text-[#0e2a63]">
          {[screen.notice, screen.agreed].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#0e2a63] text-white">
                <Check className="h-3 w-3" />
              </span>
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#e4e8ee] px-3 py-2 text-xs font-utility text-[#0e2a63]">
          <Camera className="h-3.5 w-3.5" /> {screen.photos}
        </p>
      </div>
    );
  }

  if (index === 3) {
    // Mirrors the customer journey the homepage explains (same step list).
    const current = 5;
    return (
      <div>
        {heading}
        <ol className="mt-3 grid grid-cols-4 gap-1.5">
          {journey.map((s, i) => (
            <li key={s.id} className="min-w-0">
              <span className={`block h-1.5 rounded-full ${i < current ? "bg-[#f7a800]" : i === current ? "bg-[#2f5daa]" : "bg-[#e4e8ee]"}`} />
              <span className={`mt-1 block text-[10px] leading-tight font-utility ${i === current ? "text-[#0e2a63] font-semibold" : "text-[#111827]/45"}`}>
                {s.title}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (screen.rows && screen.columns) {
    return (
      <div>
        {heading}
        <table className="mt-3 w-full text-left text-xs font-utility">
          <thead>
            <tr className="text-[#111827]/45">
              {screen.columns.map((c) => (
                <th key={c} className="pb-1.5 font-normal">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {screen.rows.map((r) => (
              <tr key={r.customer} className="border-t border-[#e4e8ee] text-[#0e2a63]">
                <td className="py-1.5 pr-2">{r.customer}</td>
                <td className="py-1.5 pr-2 text-[#111827]/55">{r.payment}</td>
                <td className="py-1.5">
                  <span className="rounded-full bg-[#f7f9fc] border border-[#e4e8ee] px-2 py-0.5">{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return heading;
}
