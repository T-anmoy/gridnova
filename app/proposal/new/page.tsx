import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import ProposalInputForm from "./ProposalInputForm";

export const metadata: Metadata = pageMetadata({
  title: "Solar Project Assessment",
  description: "Internal site assessment form for the Grid Nova sales team.",
  path: "/proposal/new",
});

export default async function ProposalNewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const asString = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const leadId = asString(params.leadId);

  return (
    <main className="bg-[#f7f9fc] min-h-[100svh]">
      <div className="mx-auto max-w-[900px] px-6 md:px-10 pt-[calc(var(--header-h)+3rem)] pb-20 md:pb-28">
        <div className="mb-10 md:mb-12 text-center">
          <span className="ref-tag text-[#2f5daa] justify-center">Sales Tool</span>
          <h1
            className="mt-4 font-display text-[#0e2a63] font-medium leading-[0.95] text-balance mx-auto max-w-[24ch]"
            style={{ fontSize: "clamp(2rem,6vw,3.5rem)" }}
          >
            Solar Project Assessment
          </h1>
          <p className="mt-4 text-[#111827]/60 text-base md:text-lg">
            For use by the Grid Nova sales team
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-[#e4e8ee] bg-white px-5 py-4">
          <p className="text-[#111827]/60 text-sm font-utility leading-relaxed">
            This form collects site information to generate a formal
            proposal. All fields marked <span className="text-[#0e2a63] font-semibold">*</span> are required.
          </p>
        </div>

        <ProposalInputForm initialLeadId={leadId} />
      </div>
    </main>
  );
}
