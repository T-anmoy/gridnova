import { Camera, Check, QrCode } from "lucide-react";
import type { Messages } from "@/lib/i18n/types";
import StepDots from "./StepDots";

type T = Messages["careers"]["howItWorks"];
type Screen = T["steps"][number]["screen"];

// CareersEnhancer finds the strip by this id.
const LIST_ID = "how-it-works-steps";

// The Associate portal in four steps, each with a small mock screen. On
// phones and tablets the steps are a horizontal swipe strip (CSS scroll-snap,
// no carousel library) with a dot row; from lg up all four sit in one row.
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
        className="mt-8 -mx-6 md:-mx-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 md:scroll-px-10 px-6 md:px-10 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0"
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
            <p className="mt-1.5 flex-1 text-sm text-[#111827]/70 leading-relaxed">{step.body}</p>
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
    <figure className="relative mt-4 rounded-xl bg-[#f7f9fc] border border-[#e4e8ee] p-3 lg:p-2" aria-label={label}>
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
    return (
      <div className="flex items-center gap-3">
        <div className="h-16 w-12 shrink-0 rounded-md bg-[#e4e8ee] lg:hidden 2xl:block" />
        <div className="flex-1 min-w-0">
          {heading}
          <p className="mt-1 text-[#0e2a63] text-xs font-utility">{screen.name}</p>
          <p className="text-[#111827]/65 text-xs font-utility">{screen.role}</p>
          <p className="mt-1 text-[#111827]/65 text-xs font-utility">{screen.id}: ••••••</p>
        </div>
        <div className="flex flex-col items-center gap-1 text-[#0e2a63]">
          <QrCode className="h-10 w-10" />
          <span className="max-w-[5rem] text-center text-[10px] leading-tight font-utility text-[#111827]/65">{screen.qr}</span>
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
    return (
      <div>
        {heading}
        <table className="mt-2 w-full text-left text-xs lg:text-[11px] font-utility">
          <thead>
            <tr className="text-[#111827]/65">
              {screen.columns.map((c) => (
                <th key={c} className="pb-1 font-normal">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {screen.rows.map((r) => (
              <tr key={r.customer} className="border-t border-[#e4e8ee] text-[#0e2a63]">
                <td className="py-1 pr-1.5 whitespace-nowrap">{r.customer}</td>
                <td className="py-1 pr-1.5 text-[#111827]/65">{r.payment}</td>
                <td className="py-1">
                  <span className="rounded-full bg-[#f7f9fc] border border-[#e4e8ee] px-1.5 py-0.5">{r.status}</span>
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
