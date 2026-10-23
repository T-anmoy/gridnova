import { Camera, Check, QrCode } from "lucide-react";
import type { Messages } from "@/lib/i18n/types";
import StepDots from "./StepDots";

type T = Messages["careers"]["howItWorks"];
type Screen = T["steps"][number]["screen"];

// CareersEnhancer finds the strip by this id.
const LIST_ID = "how-it-works-steps";

// The Associate portal in four steps. On phones and tablets the steps are a
// horizontal swipe strip (CSS scroll-snap, no carousel library) with a dot
// row; from lg up all four sit in one row. Each step has a small mock screen
// from md up; below md the cards are text only, so a step stays short.
// Every screen is stamped "Illustration" and uses placeholder data
// ("Sample customer", "Your name", no amounts) — nothing here is a real
// customer, a real ID format or a real figure.
export default function AssociateWalkthrough({ t }: { t: T }) {
  return (
    <div>
      <ol
        id={LIST_ID}
        aria-label={t.title}
        tabIndex={0}
        className="mt-6 md:mt-8 -mx-6 md:-mx-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 md:scroll-px-10 px-6 md:px-10 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {t.steps.map((step, i) => (
          <li
            key={step.title}
            data-index={i}
            className="flex w-[min(84%,22rem)] shrink-0 snap-start flex-col rounded-2xl border border-[#e4e8ee] bg-white p-5 lg:p-4 transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(9,28,60,0.35)] lg:w-auto"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0e2a63] font-utility text-xs font-semibold text-[#0e2a63]">
              {i + 1}
            </span>
            <h3 className="mt-3 font-display text-[#0e2a63] text-lg font-semibold">{step.title}</h3>
            <p className="mt-1.5 md:flex-1 text-sm text-[#111827]/70 leading-relaxed">{step.body}</p>
            <MockFrame label={t.illustration}>
              <MockScreen index={i} screen={step.screen} />
            </MockFrame>
          </li>
        ))}
      </ol>
      <StepDots count={t.steps.length} />
    </div>
  );
}

function MockFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="relative mt-4 hidden md:block rounded-xl bg-[#f7f9fc] border border-[#e4e8ee] p-3 lg:p-2" aria-label={label}>
      <figcaption className="absolute -top-2.5 right-3 rounded-full bg-[#0e2a63] px-2.5 py-0.5 font-utility text-[10px] font-semibold text-white">
        {label}
      </figcaption>
      <div className="rounded-lg bg-white border border-[#e4e8ee] p-3 lg:p-2.5 text-sm" aria-hidden="true">
        {children}
      </div>
    </figure>
  );
}

function MockScreen({ index, screen }: { index: number; screen: Screen }) {
  const heading = <p className="font-display font-semibold text-[#0e2a63]">{screen.heading}</p>;

  if (index === 0 && screen.fields) {
    return (
      <div>
        {heading}
        <div className="mt-2 space-y-1.5">
          {screen.fields.map((f) => (
            <div key={f} className="rounded-md border border-[#e4e8ee] px-2.5 py-1.5 text-[#111827]/65 text-xs font-utility">{f}</div>
          ))}
        </div>
        <p className="mt-2 inline-flex rounded-full bg-[#fff1c2] px-2.5 py-1 text-[11px] font-utility text-[#6b4700]">{screen.status}</p>
      </div>
    );
  }

  if (index === 1 && screen.qr) {
    // Heading on its own line, so it never gets squeezed between the photo
    // and the QR code in a narrow card.
    return (
      <div>
        {heading}
        <div className="mt-2 flex items-center gap-3">
          <div className="h-16 w-12 shrink-0 rounded-md bg-[#e4e8ee] lg:hidden xl:block" />
          <div className="flex-1 min-w-0">
            <p className="text-[#0e2a63] text-xs font-utility">{screen.name}</p>
            <p className="text-[#111827]/65 text-xs font-utility">{screen.role}</p>
            <p className="mt-1 text-[#111827]/65 text-xs font-utility">{screen.id}: ••••••</p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1 text-[#0e2a63]">
            <QrCode className="h-10 w-10" />
            <span className="max-w-[4.5rem] text-center text-[10px] leading-tight font-utility text-[#111827]/65">{screen.qr}</span>
          </div>
        </div>
      </div>
    );
  }

  if (index === 2 && screen.notice) {
    return (
      <div>
        {heading}
        <ul className="mt-2 space-y-1.5 text-xs font-utility text-[#0e2a63]">
          {[screen.notice, screen.agreed].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#0e2a63] text-white">
                <Check className="h-3 w-3" />
              </span>
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[#e4e8ee] px-2.5 py-1.5 text-xs font-utility text-[#0e2a63]">
          <Camera className="h-3.5 w-3.5" /> {screen.photos}
        </p>
      </div>
    );
  }

  if (screen.rows && screen.columns) {
    // A list, not a table: each row is the customer and payment on the left
    // and the status pill on the right, so it fits any card width.
    const [customer, payment, status] = screen.columns;
    return (
      <div>
        {heading}
        <p className="mt-2 flex justify-between gap-2 text-[11px] font-utility text-[#111827]/65">
          <span>{customer} · {payment}</span>
          <span>{status}</span>
        </p>
        <ul className="mt-1 text-xs font-utility">
          {screen.rows.map((r) => (
            <li key={r.customer} className="flex items-center justify-between gap-2 border-t border-[#e4e8ee] py-1.5">
              <span className="min-w-0">
                <span className="block text-[#0e2a63]">{r.customer}</span>
                <span className="block text-[11px] text-[#111827]/65">{r.payment}</span>
              </span>
              <span className="shrink-0 rounded-full bg-[#f7f9fc] border border-[#e4e8ee] px-2 py-0.5 text-[11px] text-[#0e2a63]">{r.status}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return heading;
}
