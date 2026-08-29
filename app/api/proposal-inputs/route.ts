import { NextResponse } from "next/server";
import { z } from "zod";

// Placeholder Route Handler for the sales-team site-assessment wizard
// (app/proposal/new). Accepts and validates the structured form fields,
// logs them for visibility, and confirms receipt — it does not yet persist
// anything, send any notification, or touch the Python backend.
//
// TODO: wire to FastAPI backend once deployed. Once a real endpoint exists,
// this handler should forward the validated payload there (and handle file
// uploads separately, per the form's own note that documents are not sent
// in this initial JSON POST).

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
  referenceLeadId: z.string().optional().default(""),

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

  const { website: _website, ...submission } = parsed.data;
  void _website;

  // No persistence or backend call yet — this is a placeholder that confirms
  // receipt so the frontend wizard works end-to-end before FastAPI is wired.
  console.log("New proposal site-assessment submission:", submission);

  return NextResponse.json(
    { success: true, message: "Received — backend integration pending" },
    { status: 201 }
  );
}
