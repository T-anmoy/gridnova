import { handleLeadRequest } from "@/lib/lead-capture";
import { configuratorMirrorPayload } from "@/lib/lead-mirror";
import { configuratorLeadSchema, type ConfiguratorLeadInput } from "@/lib/lead-schemas";
import type { EmailRow } from "@/lib/lead-email";

// The Solar Calculator's lead. Mirrors to the same backend endpoint as the
// Estimate Form; BE-1 §5 made it accept every field the calculator collects.

function rows(d: ConfiguratorLeadInput): EmailRow[] {
  return [
    ["Customer Type", d.customerType],
    ["Name", d.name],
    ["Phone", d.phone],
    ["Email", d.email],
    ["State", d.state],
    ["City", d.city],
    ["PIN Code", d.pinCode],
    ["DISCOM", d.discom],
    ["Sizing Method", d.sizingMethod],
    ["Average Monthly Bill", d.averageMonthlyBill],
    ["Average Monthly Units (kWh)", d.monthlyUnits],
    ["Roof Area (sq ft)", d.roofAreaSqFt],
    ["Connection Phase", d.connectionPhase],
    ["Roof Type", d.roofType],
    ["Number of Floors", d.floors],
    ["Site Access Difficulty", d.accessDifficulty],
    ["Shading Condition", d.shading],
    ["Interested in PM Surya Ghar Subsidy", d.subsidyInterest === "yes" ? "Yes" : d.subsidyInterest === "no" ? "No" : undefined],
    ["Indicative Estimate Shown", d.indicativeTotalInr != null ? `₹${d.indicativeTotalInr.toLocaleString("en-IN")}` : undefined],
  ];
}

export async function POST(request: Request) {
  return handleLeadRequest(request, {
    route: "configurator-lead",
    schema: configuratorLeadSchema,
    email: (d) => ({
      from: "Grid Nova Solar Calculator <estimates@gridnova.in>",
      subject: `New Solar Calculator Lead — ${d.customerType} — ${d.name}`,
      heading: "New Solar Calculator Lead",
      rows: rows(d),
    }),
    mirror: { path: "/api/v1/public/estimate-request", label: "Solar Calculator lead", payload: configuratorMirrorPayload },
    failureMessage: "We couldn't send your request right now. Please call us directly.",
  });
}
