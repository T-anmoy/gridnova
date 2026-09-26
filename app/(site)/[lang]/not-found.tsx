"use client";

import { ArrowRight, Home } from "lucide-react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/lib/i18n/client";

// not-found receives no params, so it reads the locale's text from the site
// layout's provider (notFound is one of the chrome namespaces).
export default function NotFound() {
  const t = useMessages("notFound");
  return (
    <main className="on-dark min-h-[100svh] bg-[#091c3c] blueprint-grid flex items-center justify-center px-6">
      <div className="text-center max-w-[540px]">
        <p className="font-utility text-[#f7a800] text-[11px] tracking-[0.22em] uppercase mb-8">
          {t.eyebrow}
        </p>
        <div className="font-display text-white font-semibold leading-none mb-6 select-none"
          style={{ fontSize: "clamp(6rem,25vw,14rem)", opacity: 0.08 }}>
          404
        </div>
        <h1 className="font-display text-white text-3xl md:text-4xl font-medium mt-[-2rem] relative z-10 text-balance">
          {t.title}
        </h1>
        <p className="mt-5 text-white/55 leading-relaxed max-w-[38ch] mx-auto">
          {t.body}
        </p>
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link
            href="/"
            className="btn btn-primary"
          >
            <Home className="h-4 w-4" />
            {t.home}
          </Link>
          <Link
            href="/contact"
            className="btn btn-secondary"
          >
            {t.contact}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
