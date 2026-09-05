"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import headerLogo from "@/public/brand/header-logo.png";
import { scrollToTop } from "@/lib/lenis";

const NAV_LINKS = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Industries", href: "/industries" },
  { label: "Projects", href: "/projects" },
  { label: "Technology", href: "/technology" },
  { label: "Leadership", href: "/leadership" },
  { label: "Sustainability", href: "/sustainability" },
  { label: "Careers", href: "/careers" },
];

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const { scrollY } = useScroll();
  const pathname = usePathname();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 24);
  });

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const activeHref = NAV_LINKS.find(
    (l) => l.href === pathname || (l.href !== "/" && pathname.startsWith(l.href))
  )?.href ?? null;

  // Clicking the nav link for the page you're already on is a no-op in Next.js.
  // Intercept it and smoothly scroll to the top via Lenis instead.
  const handleNavClick = (e: React.MouseEvent, href: string) => {
    if (href === pathname) {
      e.preventDefault();
      scrollToTop();
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] flex justify-center px-4 xs:px-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <motion.div
        initial={false}
        animate={{
          maxWidth: scrolled ? 980 : 1180,
          paddingTop: scrolled ? 8 : 14,
          paddingBottom: scrolled ? 8 : 14,
          // A confident, near-solid navy regardless of what's behind it — the
          // site's own other glass surface (Hero's stats panel) sits at 0.80;
          // this previously sat at 0.42/0.72, which read as flat grey over
          // the light bg-[#f7f9fc] most non-homepage pages open with.
          backgroundColor: scrolled ? "rgba(9,28,60,0.94)" : "rgba(9,28,60,0.86)",
          boxShadow: scrolled
            ? "0 8px 32px -8px rgba(9,28,60,0.35)"
            : "0 4px 20px -8px rgba(9,28,60,0.15)",
        }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass relative z-20 w-full rounded-full flex items-center justify-between px-5 md:px-7"
      >
        <Link href="/" onClick={(e) => handleNavClick(e, "/")} className="flex items-center shrink-0 active:scale-[0.97] transition-transform">
          <span className="bg-white/95 rounded-xl px-2.5 py-1 inline-flex items-center shadow-sm">
            <Image
              src={headerLogo}
              alt="Grid Nova Energy"
              width={115}
              height={30}
              className="h-7 md:h-8 w-auto"
              loading="eager"
              fetchPriority="high"
            />
          </span>
        </Link>

        <nav
          className="hidden lg:flex items-center gap-1"
          onMouseLeave={() => setHovered(null)}
        >
          {NAV_LINKS.map((link) => {
            const isActive = link.href === activeHref;
            const showIndicator = hovered === link.href || (!hovered && isActive);
            return (
              <Link
                key={link.href}
                href={link.href}
                onMouseEnter={() => setHovered(link.href)}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`relative px-3.5 py-2 rounded text-[13px] font-utility transition-colors duration-200 active:scale-[0.97] ${
                  isActive ? "text-white" : "text-white/75 hover:text-white"
                }`}
              >
                {link.label}
                {showIndicator && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute left-3.5 right-3.5 bottom-1 h-px bg-[#f7a800]"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Both CTAs share the nav links' lg: breakpoint (not the old
              single-button's md:) — two buttons need more room than one, and
              this keeps one consistent "full nav appears together" threshold
              instead of the previous md/lg split. */}
          <Link
            href="/book-a-call"
            className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-white/25 text-white text-[13px] font-utility font-semibold px-4 py-2 hover:bg-white/10 hover:border-white/40 transition-colors duration-200 active:scale-[0.97]"
          >
            Book a Call
          </Link>
          <Link
            href="/solar-calculator"
            className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-[#f7a800] text-[#091c3c] text-[13px] font-utility font-semibold px-4 py-2 hover:bg-white transition-colors duration-200 active:scale-[0.97]"
          >
            Get Instant Estimate
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <button
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden flex items-center justify-center h-11 w-11 rounded-full text-white active:scale-[0.97] transition-transform"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop — tapping anywhere outside the panel closes the menu */}
            <motion.div
              key="nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
              className="fixed inset-0 z-10 lg:hidden bg-[#040e28]/40"
            />
          <motion.div
            key="nav-panel"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="glass fixed top-[84px] left-3 right-3 xs:left-4 xs:right-4 z-20 rounded-3xl p-5 xs:p-6 lg:hidden overflow-y-auto"
            style={{ backgroundColor: "rgba(9,28,60,0.92)", maxHeight: "calc(100dvh - 100px)" }}
          >
            <nav className="flex flex-col divide-y divide-white/10">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => { handleNavClick(e, link.href); setOpen(false); }}
                  className={`py-3.5 font-display text-lg flex items-center justify-between active:scale-[0.98] transition-transform ${
                    pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
                      ? "text-[#f7a800]"
                      : "text-white"
                  }`}
                >
                  {link.label}
                  <ArrowUpRight className="h-4 w-4 text-white/40" />
                </Link>
              ))}
            </nav>
            <div className="mt-5 flex flex-col gap-2.5">
              <Link
                href="/solar-calculator"
                onClick={() => setOpen(false)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#f7a800] text-[#091c3c] text-sm font-utility font-semibold px-4 py-3 active:scale-[0.97] transition-transform"
              >
                Get Instant Estimate
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="/book-a-call"
                onClick={() => setOpen(false)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/25 text-white text-sm font-utility font-semibold px-4 py-3 active:scale-[0.97] transition-transform"
              >
                Book a Call
              </Link>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
