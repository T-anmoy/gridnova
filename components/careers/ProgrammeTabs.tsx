import { panelId, tabId } from "./programme-ids";

// "Associate | Preferred Associate" tab row (ARIA tabs). Server-rendered with
// the first tab selected; CareersEnhancer handles click and the Left/Right
// arrow keys by flipping aria-selected / tabindex and the panels' `hidden`.
// Without JavaScript the row is dropped and every panel shows (globals.css,
// @media (scripting: none)).
export default function ProgrammeTabs({ label, tabs }: { label: string; tabs: { id: string; name: string }[] }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      id="programme-tabs"
      className="js-only mt-8 inline-flex max-w-full rounded-full border border-[#e4e8ee] bg-white p-1"
    >
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          id={tabId(tab.id)}
          type="button"
          role="tab"
          aria-selected={i === 0}
          aria-controls={panelId(tab.id)}
          tabIndex={i === 0 ? 0 : -1}
          className="min-h-[44px] rounded-full px-4 sm:px-6 font-utility text-sm font-semibold text-[#0e2a63] transition-colors duration-200 hover:bg-[#f7f9fc] aria-selected:bg-[#0e2a63] aria-selected:text-white"
        >
          {tab.name}
        </button>
      ))}
    </div>
  );
}
