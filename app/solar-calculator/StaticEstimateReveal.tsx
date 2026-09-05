import { Cpu, HardHat, Wrench } from "lucide-react";
import { formatINR } from "./lib";

const CATEGORY_ICON: Record<string, React.ElementType> = {
  Equipment: Cpu,
  Installation: HardHat,
  Other: Wrench,
};

// The exact same markup as EstimateReveal.tsx, minus CountUp — used as the
// <Suspense> fallback while that (gsap-dependent) chunk loads in, so there's
// no layout shift and the real numbers are correct even before the count-up
// animation is ready to take over.
export default function StaticEstimateReveal({
  total,
  categories,
}: {
  total: number;
  categories: Record<string, number>;
}) {
  return (
    <div>
      <div className="rounded-2xl bg-[#0e2a63] p-8 text-center">
        <p className="font-utility text-xs text-white/50 uppercase tracking-[0.12em]">
          Indicative System Cost
        </p>
        <p className="mt-2 font-display text-white text-4xl md:text-5xl font-semibold">
          {formatINR(total)}
        </p>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {Object.entries(categories).map(([label, value]) => {
          const Icon = CATEGORY_ICON[label] ?? Wrench;
          return (
            <div key={label} className="rounded-xl border border-[#e4e8ee] p-4 text-center">
              <Icon className="h-4 w-4 text-[#2f5daa] mx-auto" />
              <p className="mt-2 font-utility text-xs text-[#111827]/50">{label}</p>
              <p className="font-utility text-sm font-semibold text-[#0e2a63]">{formatINR(value)}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-[#111827]/50 text-xs font-utility leading-relaxed">
        This is an indicative estimate only, not a final quote. Actual pricing depends on a
        site assessment by our engineering team.
      </p>
    </div>
  );
}
