// A plain, generic picture of an electricity bill showing where "Units
// consumed" sits — no utility's logo or layout, and no real numbers: the
// values are grey bars, so nothing here can be mistaken for a figure.
export default function BillCard({ t }: { t: { label: string; period: string; units: string; amount: string } }) {
  const bar = (w: string) => <span className={`block h-2 rounded-full bg-[#111827]/15 ${w}`} />
  return (
    <figure className="rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-3.5">
      <figcaption className="font-utility text-xs font-semibold text-[#111827]/70">{t.label}</figcaption>
      <div role="img" aria-label={`${t.label}: ${t.units}`} className="mt-2 rounded-lg border border-[#e4e8ee] bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-dashed border-[#e4e8ee] pb-2">
          {bar("w-16")}
          {bar("w-10")}
        </div>
        <div className="mt-2 space-y-2 font-utility text-[11px] text-[#111827]/60">
          <div className="flex items-center justify-between gap-3">
            <span>{t.period}</span>
            {bar("w-20")}
          </div>
          <div className="-mx-1.5 flex items-center justify-between gap-3 rounded-md bg-[#fffaf0] px-1.5 py-1 font-semibold text-[#7a5200] ring-2 ring-[#f7a800]">
            <span>{t.units}</span>
            <span className="block h-2 w-12 rounded-full bg-[#f7a800]/60" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>{t.amount}</span>
            {bar("w-14")}
          </div>
        </div>
      </div>
    </figure>
  );
}
