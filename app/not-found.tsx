import Link from "next/link";
import { ArrowRight, Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-[100svh] bg-[#091c3c] blueprint-grid flex items-center justify-center px-6">
      <div className="text-center max-w-[540px]">
        <p className="font-utility text-[#f7a800] text-[11px] tracking-[0.22em] uppercase mb-8">
          Error 404
        </p>
        <div className="font-display text-white font-semibold leading-none mb-6 select-none"
          style={{ fontSize: "clamp(6rem,25vw,14rem)", opacity: 0.08 }}>
          404
        </div>
        <h1 className="font-display text-white text-3xl md:text-4xl font-medium mt-[-2rem] relative z-10 text-balance">
          This page is off-grid.
        </h1>
        <p className="mt-5 text-white/55 leading-relaxed max-w-[38ch] mx-auto">
          The URL you&rsquo;re looking for doesn&rsquo;t exist. Head back to the
          homepage or get in touch directly.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#f7a800] text-[#091c3c] font-utility font-semibold text-sm px-6 py-3.5 hover:bg-white transition-colors duration-300 active:scale-[0.97]"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 text-white font-utility text-sm px-6 py-3.5 hover:bg-white/10 transition-colors duration-300 active:scale-[0.97]"
          >
            Contact Us
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
