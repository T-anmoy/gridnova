// Progress dots under the "How it works" swipe strip (phones and tablets
// only). Decorative: the strip itself swipes and, being focusable, scrolls
// with the arrow keys, and each card carries its step number. Server-rendered
// with the first dot current; CareersEnhancer moves data-current as the strip
// scrolls. Without JavaScript the row is dropped (.js-only).
export default function StepDots({ count }: { count: number }) {
  return (
    <div id="step-dots" aria-hidden="true" className="js-only mt-3 md:mt-4 flex justify-center gap-2 lg:hidden">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          data-current={i === 0 ? "" : undefined}
          className="block h-2 w-2 rounded-full bg-[#0e2a63]/25 transition-[width,background-color] duration-300 data-current:w-6 data-current:bg-[#0e2a63]"
        />
      ))}
    </div>
  );
}
