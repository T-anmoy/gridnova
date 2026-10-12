import { API_BASE_URL } from '@/lib/config';
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { mapProposalInputsToBackend } from "@/app/(internal)/proposal/new/backend-mapping";
import type { ProposalFormValues } from "@/app/(internal)/proposal/new/types";

// Real Route Handler for the sales-team site-assessment wizard
// (app/proposal/new): validates the submitted fields, maps them onto the
// real backend's ProposalInputsCreate contract (grid-nova-ai-backend's
// app/api/routes/proposal_inputs.py — see backend-mapping.ts for the enum
// correspondence), and forwards the request with the caller's own Clerk
// session token — the backend's create endpoint is employee-authenticated,
// the same as every dashboard write. File bytes are NOT sent here: the
// backend only accepts uploads against an already-created ProposalInputs
// row, so the client uploads each file separately once this call returns a
// real `inputs_id` (see app/api/proposal-inputs/[id]/upload/route.ts).

const API_BASE = API_BASE_URL;

// Required fields mirror app/proposal/new/validation.ts's STEP_FIELDS —
// keep the two in sync if the form's required-field set changes.
const proposalInputSchema = z.object({
  // Step 1 — Customer & Project Details
  customerType: z.string(),
  fullName: z.string().min(1, "Full name is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  organisationName: z.string().optional().default(""),
  gstNumber: z.string().optional().default(""),
  projectType: z.string().min(1, "Project type is required"),
  linkedToGovtScheme: z.string(),
  schemeName: z.string().optional().default(""),
  referenceLeadId: z.string().min(1, "Lead ID is required"),

  // Step 2 — Installation Site
  state: z.string().min(1, "State is required"),
  districtCity: z.string().min(1, "District / city is required"),
  pinCode: z.string().min(1, "PIN code is required"),
  fullAddress: z.string().optional().default(""),
  discom: z.string().min(1, "DISCOM is required"),
  consumerNumber: z.string().optional().default(""),
  siteType: z.string().min(1, "Site type is required"),
  siteAreaSqFt: z.string().min(1, "Roof / site area is required"),
  numberOfFloors: z.string().optional().default(""),
  shadingConditions: z.string().optional().default(""),
  structuralNotes: z.string().optional().default(""),

  // Step 3 — Load & Output Requirements
  avgMonthlyBill: z.string().min(1, "Average monthly bill is required"),
  avgMonthlyUnits: z.string().optional().default(""),
  peakLoad: z.string().optional().default(""),
  connectionPhase: z.string().min(1, "Connection phase is required"),
  primaryObjective: z.string().min(1, "Primary objective is required"),
  desiredSystemOutput: z.string().optional().default(""),
  specialLoadNotes: z.string().optional().default(""),

  // Step 4 — System Configuration
  connectionType: z.string(),
  backupDuration: z.string().optional().default(""),
  netMeteringRequired: z.string().optional().default(""),
  preferredEquipmentTier: z.string().optional().default(""),
  dcrRequired: z.string(),
  evChargingIntegration: z.string(),
  batteryStorageIntegration: z.string(),
  additionalRequirements: z.string().optional().default(""),

  // Honeypot — bots fill this field, real users never see it.
  website: z.string().optional().default(""),
});

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  // Honeypot — reject silently (as a generic success) so bots get no signal
  // their submission was caught.
  if (body && typeof body === "object" && "website" in body && (body as { website?: string }).website) {
    return NextResponse.json({ success: true });
  }

  const parsed = proposalInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: formatZodError(parsed.error) },
      { status: 400 }
    );
  }

  const { website: _website, ...values } = parsed.data;
  void _website;

  const mapped = mapProposalInputsToBackend(values as ProposalFormValues);
  if (!mapped.ok) {
    return NextResponse.json({ success: false, error: mapped.error }, { status: 422 });
  }

  const session = await auth();
  const token = await session.getToken();
  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: "Please sign in as a Grid Nova staff member before submitting this assessment.",
        code: "not_authenticated",
      },
      { status: 401 }
    );
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/proposal-inputs/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(mapped.body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not reach the backend. Please try again." },
      { status: 502 }
    );
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      typeof data?.detail === "string" ? data.detail : data?.detail ? JSON.stringify(data.detail) : null;
    return NextResponse.json(
      { success: false, error: detail || `Backend error ${res.status}` },
      { status: res.status }
    );
  }

  return NextResponse.json({ success: true, inputs_id: data.id }, { status: 201 });
}
