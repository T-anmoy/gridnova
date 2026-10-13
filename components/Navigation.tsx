"use client";

import { useEffect, useRef, useState } from "react";
import { m, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "@/components/i18n/Link";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import headerLogo from "@/public/brand/header-logo.webp";
import { getLenis, scrollToTop } from "@/lib/lenis";
import { useMessages } from "@/lib/i18n/client";
import { useBarePathname } from "@/lib/i18n/navigation";

// Labels come from messages (nav.links.<key>); order and hrefs live here.
type NavKey = "about" | "services" | "industries" | "projects" | "technology" | "leadership" | "sustainability" | "careers";
const NAV_LINKS: { key: NavKey; href: string }[] = [
  { key: "about", href: "/about" },
  { key: "services", href: "/services" },
  { key: "industries", href: "/industries" },
  { key: "projects", href: "/projects" },
  { key: "technology", href: "/technology" },
  { key: "leadership", href: "/leadership" },
  { key: "sustainability", href: "/sustainability" },
  { key: "careers", href: "/careers" },
];

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const { scrollY } = useScroll();
  // Locale-free path, so `/hi/about` still marks "About" active.
  const pathname = useBarePathname();
  const t = useMessages("nav");

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 24);
  });

  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Scroll lock while the drawer is open: the body (native scroll) and Lenis
  // (which drives its own scroll) must both be paused, and resumed on close.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const lenis = getLenis();
    if (open) lenis?.stop();
    return () => {
      document.body.style.overflow = "";
      lenis?.start();
    };
  }, [open]);

  // Focus moves into the drawer on open and back to the toggle on close;
  // Escape closes it.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      panelRef.current?.querySelector<HTMLElement>("a")?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      toggleRef.current?.focus();
    }
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
      <m.div
        initial={false}
        animate={{
          // Real content need (logo + 8 nav links + language switcher +
          // primary CTA) is kept under the ~1232px of room the header has at
          // xl: (1280px). "Book a Call" joins the bar from 2xl: (1536px), where
          // the wider cap below gives it space; below that it lives in the
          // drawer. Hindi/Bengali labels were measured at xl: too.
          maxWidth: scrolled ? 1340 : 1400,
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

        {/* Full horizontal nav — genuine desktop only (xl: / 1280px+). Below
            that, even at a tablet width like 1024px (iPad Pro portrait),
            8 links + 2 CTAs never had comfortable room; the hamburger/drawer
            now covers both phone and tablet instead of forcing a cramped fit. */}
        <nav
          className="hidden xl:flex items-center"
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
                className={`relative whitespace-nowrap px-2.5 2xl:px-3.5 py-2 rounded text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7a800] font-utility transition-colors duration-300 active:scale-[0.97] ${
                  isActive ? "text-white" : "text-white/75 hover:text-white"
                }`}
              >
                {t.links[link.key]}
                <span
                  aria-hidden="true"
                  className={`absolute left-2.5 right-2.5 2xl:left-3.5 2xl:right-3.5 bottom-1 h-px origin-left bg-[#f7a800] transition-transform duration-300 motion-reduce:transition-none ${
                    showIndicator ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Compact switcher in the bar from sm: up; phones get the full-name
              version inside the drawer instead (the bar has no room at 375px). */}
          <LanguageSwitcher className="hidden sm:inline-flex shrink-0" />
          {/* "Book a Call" (secondary) only appears on wide desktops —
              below 2xl: it lives in the drawer alongside the rest of the
              nav, one tap away rather than competing for header space. */}
          <Link
            href="/book-a-call"
            className="hidden 2xl:inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full border border-white/25 text-white text-[13px] font-utility font-semibold px-4 py-2 hover:bg-white/10 hover:border-white/40 transition-colors duration-300 active:scale-[0.97]"
          >
            {t.bookCall}
          </Link>
          {/* "Get Instant Estimate" (primary) is the one thing worth keeping
              visible even when the rest of the nav collapses — it's the
              site's main conversion action, and a tablet visitor shouldn't
              have to open a drawer to reach it. Visible from md: (768px)
              all the way through desktop; only the breakpoint differs from
              "Book a Call" above, same element otherwise. */}
          <Link
            href="/solar-calculator"
            className="hidden md:inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full bg-[#f7a800] text-[#091c3c] text-[13px] font-utility font-semibold px-4 py-2 hover:bg-white transition-colors duration-300 active:scale-[0.97]"
          >
            {t.estimate}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          {/* Tablet gets a slightly larger, hover-aware tap target than
              phone — a real button, not a bare icon borrowed unchanged from
              the mobile layout (tablets are often used with a trackpad, e.g.
              iPad + Magic Keyboard, where hover feedback actually registers). */}
          <button
            ref={toggleRef}
            type="button"
            aria-label={open ? t.closeMenu : t.openMenu}
            aria-expanded={open}
            aria-controls="site-mobile-nav"
            onClick={() => setOpen((v) => !v)}
            className="xl:hidden flex items-center justify-center h-11 w-11 md:h-12 md:w-12 rounded-full text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7a800] active:scale-[0.97] transition-[background-color,transform] duration-300 motion-reduce:transition-none"
          >
            {open ? <X className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" /> : <Menu className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />}
          </button>
        </div>
      </m.div>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop — tapping anywhere outside the panel closes the menu */}
            <m.div
              key="nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
              className="fixed inset-0 z-10 xl:hidden bg-[#040e28]/40"
            />
          <m.div
            key="nav-panel"
            id="site-mobile-nav"
            ref={panelRef}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            // Below md: a full-bleed mobile sheet (left-3/right-3). From
            // md: up (tablet), it becomes a fixed-width card anchored to the
            // right edge instead — a proper dropdown panel appropriate for a
            // wider screen, not a phone sheet stretched edge to edge.
            className="glass fixed top-[84px] left-3 right-3 xs:left-4 xs:right-4 md:left-auto md:right-6 md:w-[400px] z-20 rounded-3xl p-5 xs:p-6 md:p-6 xl:hidden overflow-y-auto shadow-[0_28px_70px_-14px_rgba(4,14,40,0.65)]"
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
                  {t.links[link.key]}
                  <ArrowUpRight className="h-4 w-4 text-white/60" aria-hidden="true" />
                </Link>
              ))}
            </nav>
            <div className="mt-5 flex flex-col gap-2.5">
              <Link
                href="/solar-calculator"
                onClick={() => setOpen(false)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#f7a800] text-[#091c3c] text-sm font-utility font-semibold px-4 py-3 active:scale-[0.97] transition-transform"
              >
                {t.estimate}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="/book-a-call"
                onClick={() => setOpen(false)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/25 text-white text-sm font-utility font-semibold px-4 py-3 active:scale-[0.97] transition-transform"
              >
                {t.bookCall}
              </Link>
            </div>
            <div className="mt-5 pt-5 border-t border-white/10 flex items-center justify-between gap-3">
              <span className="text-white/70 text-xs font-utility">{t.language}</span>
              <LanguageSwitcher size="md" onSwitch={() => setOpen(false)} />
            </div>
          </m.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
