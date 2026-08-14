import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const LEADERS = [
  { name: "Michael Gomes", role: "Managing Partner" },
  { name: "Raju Paul", role: "Partner" },
  { name: "Srinjay Das", role: "VP — Business" },
  { name: "Moloy Das", role: "GM — Projects" },
  { name: "Arun Kumar", role: "Zonal Sales Manager" },
];

export default function LeadershipPreview() {
  return (
    <section className="relative bg-white py-24 md:py-32 border-t border-[#e4e8ee]">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
          <div>
            <span className="ref-tag text-[#2f5daa]">Leadership</span>
            <h2 className="mt-4 font-display text-[#0e2a63] text-[clamp(1.4rem,8vw,2.5rem)] xs:text-[clamp(1.5rem,6.5vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium max-w-[18ch] text-balance">
              Decades of EPC experience, one accountable team.
            </h2>
          </div>
          <Link
            href="/leadership"
            className="inline-flex items-center gap-1.5 text-[#0e2a63] font-utility text-sm font-semibold group w-fit"
          >
            Meet the full team
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-[#e4e8ee] rounded-2xl overflow-hidden">
          {LEADERS.map((l) => (
            <Link
              href="/leadership"
              key={l.name}
              className="group bg-white hover:bg-[#f0f4ff] p-4 xs:p-5 sm:p-6 transition-all duration-300"
            >
              <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#0e2a63] to-[#2f5daa] flex items-center justify-center text-white font-display text-sm font-semibold group-hover:scale-110 group-hover:shadow-[0_4px_16px_-4px_rgba(14,42,99,0.35)] transition-all duration-300">
                {l.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <p className="mt-5 font-display text-[#0e2a63] font-semibold text-[15px] group-hover:text-[#2f5daa] transition-colors duration-300">
                {l.name}
              </p>
              <p className="mt-1 text-[#111827]/50 text-xs font-utility group-hover:text-[#2f5daa]/60 transition-colors duration-300">
                {l.role}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
