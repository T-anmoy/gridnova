import Link from "next/link";

// 404 for the internal tools (/dashboard, /proposal) — English only, same look
// as the public site's not-found page.
export default function InternalNotFound() {
  return (
    <main id="main-content" className="on-dark min-h-[100svh] bg-[#091c3c] blueprint-grid flex items-center justify-center px-6">
      <div className="text-center max-w-[540px]">
        <p className="font-utility text-[#f7a800] text-[11px] tracking-[0.22em] uppercase mb-8">Page not found</p>
        <h1 className="font-display text-white text-3xl md:text-4xl font-medium text-balance">
          We couldn&rsquo;t find that page
        </h1>
        <p className="mt-5 text-white/70 leading-relaxed max-w-[38ch] mx-auto">
          The link may be old or mistyped. Head back to the dashboard and pick up from there.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link href="/dashboard" className="btn btn-primary">
            Go to the dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
