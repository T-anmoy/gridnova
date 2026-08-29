"use client";

import { ShieldCheck } from "lucide-react";
import FileUploadSlot from "../FileUploadSlot";
import type { ProposalFiles } from "../types";

interface Props {
  files: ProposalFiles;
  setFile: <K extends keyof ProposalFiles>(field: K, value: ProposalFiles[K]) => void;
  schemeSelected: boolean;
  showDocumentErrors: boolean;
}

export default function Step5Documents({ files, setFile, schemeSelected, showDocumentErrors }: Props) {
  return (
    <div className="space-y-7">
      <div className="flex items-start gap-2.5 rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] px-4 py-3.5">
        <ShieldCheck className="h-4 w-4 text-[#2f5daa] shrink-0 mt-0.5" />
        <p className="text-[#111827]/60 text-xs font-utility leading-relaxed">
          Documents are stored securely and only accessible to the Grid Nova
          sales and engineering team.
        </p>
      </div>

      <FileUploadSlot
        id="electricityBills"
        label="Electricity Bill (last 3 months)"
        accept=".pdf,.jpg,.jpeg,.png"
        acceptedTypesLabel="PDF, JPG, PNG"
        maxSizeMB={5}
        maxFiles={3}
        files={files.electricityBills}
        onChange={(v) => setFile("electricityBills", v)}
        error={showDocumentErrors && files.electricityBills.length === 0 ? "At least one electricity bill is required" : undefined}
      />

      <FileUploadSlot
        id="sitePhotos"
        label="Site Photographs"
        helperText="Include roof/ground area, shading obstructions, existing electrical panel, and access points"
        accept=".jpg,.jpeg,.png,.webp"
        acceptedTypesLabel="JPG, PNG, WEBP"
        maxSizeMB={10}
        maxFiles={8}
        files={files.sitePhotos}
        onChange={(v) => setFile("sitePhotos", v)}
        error={showDocumentErrors && files.sitePhotos.length === 0 ? "At least one site photograph is required" : undefined}
      />

      <FileUploadSlot
        id="sitePlan"
        label="Site Plan / Layout Drawing"
        optional
        accept=".pdf,.jpg,.jpeg,.png"
        acceptedTypesLabel="PDF, JPG, PNG"
        maxSizeMB={10}
        maxFiles={1}
        files={files.sitePlan}
        onChange={(v) => setFile("sitePlan", v)}
      />

      {schemeSelected && (
        <FileUploadSlot
          id="govtSchemeRegistration"
          label="Government Scheme Registration"
          optional
          accept=".pdf"
          acceptedTypesLabel="PDF"
          maxSizeMB={10}
          maxFiles={1}
          files={files.govtSchemeRegistration}
          onChange={(v) => setFile("govtSchemeRegistration", v)}
        />
      )}

      <FileUploadSlot
        id="otherDocuments"
        label="Any Other Relevant Document"
        optional
        accept=".pdf,.jpg,.jpeg,.png"
        acceptedTypesLabel="PDF, JPG, PNG"
        maxSizeMB={10}
        maxFiles={3}
        files={files.otherDocuments}
        onChange={(v) => setFile("otherDocuments", v)}
      />
    </div>
  );
}
