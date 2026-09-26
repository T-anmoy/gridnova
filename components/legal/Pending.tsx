import { Fragment } from "react";

/**
 * Render text in which every `[bracketed]` segment is a fact Grid Nova has not
 * confirmed yet (entity name, dates, bank details, notice periods…). Each one
 * is shown as a visibly marked placeholder — never quietly filled in — so a
 * reader can tell draft terms from confirmed ones.
 */
export function WithPending({ text, label }: { text: string; label: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\[[^\]]+\]$/.test(part) ? (
          <mark
            key={i}
            title={label}
            className="pending-value rounded px-1.5 py-0.5 bg-[#fff1c2] text-[#6b4700] border border-dashed border-[#d99a00] font-medium [box-decoration-break:clone]"
          >
            {part.slice(1, -1)}
            <span className="sr-only"> ({label})</span>
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
