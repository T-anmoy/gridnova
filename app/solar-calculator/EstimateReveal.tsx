"use client";

import { Cpu, HardHat, Wrench } from "lucide-react";
import CountUp from "@/components/CountUp";
import { formatINR } from "./lib";

const CATEGORY_ICON: Record<string, React.ElementType> = {
  Equipment: Cpu,
  Installation: HardHat,
  Other: Wrench,
};

// Split out from SolarCalculator.tsx and loaded via next/dynamic there —
// CountUp pulls in gsap + ScrollTrigger, which otherwise has no reason to be
// part of every visitor's initial /solar-calculator bundle when most of them
// haven't reached a result yet. The dynamic() loading fallback in
// SolarCalculator.tsx renders this exact markup without CountUp so there's
// no layout shift while this chunk loads in.
export default function EstimateReveal({
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
          <CountUp value={formatINR(total)} />
        </p>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {Object.entries(categories).map(([label, value]) => {
          const Icon = CATEGORY_ICON[label] ?? Wrench;
          return (
            <div key={label} className="rounded-xl border border-[#e4e8ee] p-4 text-center">
              <Icon className="h-4 w-4 text-[#2f5daa] mx-auto" />
              <p className="mt-2 font-utility text-xs text-[#111827]/50">{label}</p>
              <p className="font-utility text-sm font-semibold text-[#0e2a63]">
                <CountUp value={formatINR(value)} />
              </p>
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
