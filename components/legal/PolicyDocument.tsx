import { Fragment } from "react";
import { WithPending } from "@/components/legal/Pending";
import Link from "@/components/i18n/Link";
import type { PolicyBlock, PolicyDoc, PolicySlug } from "@/content/policies";
import { POLICY_SLUGS } from "@/content/policies";
import type { Messages } from "@/lib/i18n/types";

type T = Messages["legal"];

/** `**bold**` from the draft, with `[pending]` markers inside any segment. */
function Rich({ text, pending }: { text: string; pending: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-[#0e2a63]">
            <WithPending text={part.slice(2, -2)} label={pending} />
          </strong>
        ) : (
          <Fragment key={i}>
            <WithPending text={part} label={pending} />
          </Fragment>
        ),
      )}
    </>
  );
}

function Block({ block, pending }: { block: PolicyBlock; pending: string }) {
  switch (block.type) {
    case "h4":
      return <h3 className="mt-8 font-display text-[#0e2a63] text-lg font-semibold"><Rich text={block.text} pending={pending} /></h3>;
    case "note":
      return <p className="text-sm italic text-[#111827]/65"><Rich text={block.text} pending={pending} /></p>;
    case "checkbox":
      return (
        <p className="flex gap-3 rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-4">
          <span className="mt-1 h-4 w-4 shrink-0 rounded border border-[#0e2a63]/50" aria-hidden="true" />
          <span><Rich text={block.text} pending={pending} /></span>
        </p>
      );
    case "ul":
    case "ol": {
      const List = block.type;
      return (
        <List className={`space-y-2 pl-5 ${block.type === "ul" ? "list-disc" : "list-decimal"} marker:text-[#2f5daa]`}>
          {block.items.map((item) => (
            <li key={item} className="pl-1"><Rich text={item} pending={pending} /></li>
          ))}
        </List>
      );
    }
    case "table":
      return (
        <div className="rounded-xl border border-[#e4e8ee] overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f7f9fc] text-[#0e2a63]">
              <tr>
                {block.head.map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold align-top">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join("|")} className="border-t border-[#e4e8ee] align-top">
                  {row.map((cell, i) => (
                    <td key={i} className={`px-4 py-3 break-words ${i === 0 ? "w-[34%]" : ""}`}>
                      <Rich text={cell} pending={pending} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return <p><Rich text={block.text} pending={pending} /></p>;
  }
}

export default function PolicyDocument({
  doc,
  t,
  englishOnly,
}: {
  doc: PolicyDoc;
  t: T;
  englishOnly: boolean;
}) {
  const slug = doc.slug as PolicySlug;
  const toc = doc.sections.filter((s) => s.heading);
  const metaLabel = (label: string) =>
    label === "Version" ? t.version : label === "Effective date" ? t.effective : label;

  return (
    <main id="main-content" className="bg-white pt-[calc(var(--header-h)+3rem)] pb-24">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <p className="ref-tag text-[#2f5daa]">{t.eyebrow}</p>
        <h1 className="mt-4 font-display text-[#0e2a63] text-3xl md:text-5xl font-semibold text-balance">
          {t.titles[slug]}
        </h1>
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm font-utility text-[#111827]/60">
          {doc.meta.map((m) => (
            <div key={m.label} className="flex gap-2">
              <dt>{metaLabel(m.label)}:</dt>
              <dd className="text-[#0e2a63]"><WithPending text={m.value} label={t.pendingLabel} /></dd>
            </div>
          ))}
        </dl>

        <div role="note" className="mt-8 rounded-xl border border-[#f7a800]/40 bg-[#fff7e0] px-5 py-4 text-sm leading-relaxed text-[#5c3d00]">
          <p>
            {t.draftNotice}{" "}
            <mark className="rounded px-1.5 py-0.5 bg-[#fff1c2] text-[#6b4700] border border-dashed border-[#d99a00] font-medium">
              {t.pendingSample}
            </mark>
          </p>
          {englishOnly && <p className="mt-2 font-semibold">{t.englishOnly}</p>}
        </div>

        <div className="mt-12 grid lg:grid-cols-[230px_1fr] gap-10 lg:gap-14 items-start">
          {toc.length > 1 ? (
            <nav aria-label={t.contents} className="lg:sticky lg:top-28">
              <p className="font-utility text-[11px] tracking-[0.15em] uppercase text-[#111827]/65">{t.contents}</p>
              <ol lang="en" className="mt-3 space-y-2 text-sm">
                {toc.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-[#0e2a63]/75 hover:text-[#2f5daa] transition-colors">
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : (
            <div className="hidden lg:block" />
          )}

          <article lang="en" className="min-w-0 space-y-10 text-[#111827]/80 leading-relaxed">
            {doc.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28 space-y-4">
                {section.heading && (
                  <h2 className="font-display text-[#0e2a63] text-xl md:text-2xl font-semibold">{section.heading}</h2>
                )}
                {section.blocks.map((block, i) => (
                  <Block key={i} block={block} pending={t.pendingLabel} />
                ))}
              </section>
            ))}
          </article>
        </div>

        <nav aria-label={t.related} className="mt-16 pt-8 border-t border-[#e4e8ee]">
          <p className="font-utility text-[11px] tracking-[0.15em] uppercase text-[#111827]/65">{t.related}</p>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            {POLICY_SLUGS.filter((s) => s !== slug).map((s) => (
              <li key={s}>
                <Link href={`/${s}`} className="btn-text">{t.titles[s]}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
