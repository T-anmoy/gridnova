// Phone-only bottom bar carrying the page's primary action. Server-rendered
// hidden (inert, out of the tab order); CareersEnhancer shows it once the
// hero has scrolled away and hides it again while the apply band, the
// careers section or the footer is on screen. It sits left of the Ask Nova
// bubble (fixed bottom-6 right-6, 56 px) so it never covers it. Without
// JavaScript it simply never shows.
export default function StickyApplyBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="apply-bar"
      data-testid="sticky-apply-bar"
      data-state="hidden"
      inert
      className="md:hidden fixed bottom-6 left-4 right-[5.5rem] z-[150] pointer-events-none translate-y-[150%] opacity-0 transition-[translate,opacity] duration-300 data-[state=shown]:pointer-events-auto data-[state=shown]:translate-y-0 data-[state=shown]:opacity-100"
    >
      {children}
    </div>
  );
}
