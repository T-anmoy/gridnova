import { handleLeadRequest } from "@/lib/lead-capture";
import { estimateMirrorPayload } from "@/lib/lead-mirror";
import { estimateRequestSchema, type EstimateRequestInput } from "@/lib/lead-schemas";
import type { EmailRow } from "@/lib/lead-email";

// The Estimate Form's enquiry: the notification email and the CRM copy run in
// parallel and the request succeeds if either does (lib/lead-capture.ts).
// TODO: Add Raju Paul's direct email as a second recipient once supplied by Grid Nova.
// Currently only ESTIMATE_NOTIFY_EMAIL (default info@gridnova.in) receives these.

function rows(d: EstimateRequestInput): EmailRow[] {
  return [
    ["Customer Type", d.customerType],
    ["Name", d.name],
    ["Phone", d.phone],
    ["Email", d.email],
    ["State", d.state],
    ["City / PIN", d.cityOrPin],
    ["Average Monthly Bill", d.averageMonthlyBill],
    ["Roof Type", d.roofType],
    ["Roof Area (sq ft)", d.roofAreaSqFt],
    ["Floors", d.floors],
    ["Connection Phase", d.connectionPhase],
  ];
}

export async function POST(request: Request) {
  return handleLeadRequest(request, {
    route: "estimate-request",
    schema: estimateRequestSchema,
    email: (d) => ({
      from: "Grid Nova Estimate Requests <estimates@gridnova.in>",
      subject: `New Solar Estimate Request — ${d.customerType} — ${d.name}`,
      heading: "New Solar Estimate Request",
      rows: rows(d),
    }),
    mirror: { path: "/api/v1/public/estimate-request", label: "estimate-request", payload: estimateMirrorPayload },
    failureMessage: "We couldn't send your request right now. Please call us directly.",
  });
}
