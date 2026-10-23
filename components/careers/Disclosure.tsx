import { Plus } from "lucide-react";

// One collapsible row: native <details>/<summary>, so it opens and closes
// with a tap, Enter or Space, and works without JavaScript. Closed by
// default; the summary line says what is inside before anyone opens it.
export default function Disclosure({
  title,
  summary,
  children,
  titleClassName = "font-display text-[#0e2a63] text-lg font-semibold",
}: {
  title: string;
  summary?: string;
  children: React.ReactNode;
  titleClassName?: string;
}) {
  return (
    <details className="group">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className={`block ${titleClassName}`}>{title}</span>
          {summary && <span className="mt-0.5 block text-sm text-[#111827]/65 leading-relaxed">{summary}</span>}
        </span>
        <Plus
          className="mt-1 h-5 w-5 shrink-0 text-[#2f5daa] transition-transform duration-300 group-open:rotate-45"
          aria-hidden="true"
        />
      </summary>
      <div className="pb-5 text-[#111827]/70 leading-relaxed">{children}</div>
    </details>
  );
}
