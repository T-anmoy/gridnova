import type { ProposalFormValues } from "./types";
import { parseLeadId } from "./validation";

// Maps this form's placeholder display labels (types.ts's PROJECT_TYPES,
// SCHEME_NAMES, etc. — explicitly marked "not final" pending Raju Paul) onto
// the real backend enums (grid-nova-ai-backend/app/memory/models.py), which
// were built to correspond to these same option lists position-for-position.
// A value outside these maps means the request didn't come from this form's
// own controls — mapProposalInputsToBackend() below rejects it rather than
// guessing.

const PROJECT_FAMILY: Record<string, string> = {
  "Rooftop Solar": "rooftop_solar",
  "Ground-Mounted Solar": "ground_mounted",
  "Government / Institutional": "government_institutional",
  "Solar Street Lighting": "street_lighting",
  "Solar Water Pump": "water_pump",
  "O&M Service": "om_service",
  "Consulting / Project Services": "consulting",
};

const GOVERNMENT_SCHEME: Record<string, string> = {
  "PM Surya Ghar (Residential)": "pm_surya_ghar",
  "PM-KUSUM Component A": "pm_kusum_a",
  "PM-KUSUM Component B": "pm_kusum_b",
  "PM-KUSUM Component C": "pm_kusum_c",
  WBREDA: "wbreda",
  "Other Government Scheme": "other_government",
};

const SITE_TYPE: Record<string, string> = {
  "Rooftop (Residential building)": "rooftop_residential",
  "Rooftop (Commercial / Industrial building)": "rooftop_commercial",
  "Rooftop (Institutional / Government)": "rooftop_institutional",
  "Ground-Mounted (Open land)": "ground_mounted",
  "Carport / Canopy": "carport",
  Other: "other",
};

const SHADING_CONDITION: Record<string, string> = {
  "No shading": "none",
  "Partial shading (morning)": "partial_morning",
  "Partial shading (evening)": "partial_evening",
  "Heavy shading / obstructions": "heavy",
};

const CONNECTION_PHASE: Record<string, string> = {
  "Single Phase": "single_phase",
  "Three Phase": "three_phase",
};

const EQUIPMENT_TIER: Record<string, string> = {
  Standard: "standard",
  Premium: "premium",
  "As recommended by Grid Nova": "as_recommended",
};

// Already backend-shaped in types.ts (individual/organisation), no map needed.
const VALID_CUSTOMER_TYPES = new Set(["individual", "organisation"]);

function toFloat(value: string): number | undefined {
  const v = value.trim();
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toInt(value: string): number | undefined {
  const v = value.trim();
  if (!v) return undefined;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
}

export interface MappingResult {
  ok: boolean;
  body?: Record<string, unknown>;
  error?: string;
}

// This form collects several fields the real ProposalInputs model has no
// column for at all: fullName/contactNumber/email (the backend expects
// customer identity to already live on the Lead/Customer the required
// lead_id points to, not duplicated here) and primaryObjective/backupDuration
// (never added to ProposalInputsCreate). Rather than silently discarding real
// staff input, all of it is folded into additional_requirements — the one
// true free-text field — clearly labeled so a reviewer still sees it and can
// cross-check it against the linked Lead's own customer record.
function buildAdditionalRequirements(v: ProposalFormValues): string | undefined {
  const parts: string[] = [
    `Submitted for: ${v.fullName} · ${v.contactNumber} · ${v.email}`,
  ];
  if (v.primaryObjective) parts.push(`Primary objective: ${v.primaryObjective}`);
  if (v.backupDuration) parts.push(`Desired backup duration: ${v.backupDuration}`);
  if (v.additionalRequirements.trim()) parts.push(v.additionalRequirements.trim());
  return parts.join("\n");
}

export function mapProposalInputsToBackend(v: ProposalFormValues): MappingResult {
  const leadId = parseLeadId(v.referenceLeadId);
  if (leadId === null) {
    return { ok: false, error: "A valid Lead ID is required." };
  }
  if (!VALID_CUSTOMER_TYPES.has(v.customerType)) {
    return { ok: false, error: `Unknown customer type: ${v.customerType}` };
  }
  const projectFamily = PROJECT_FAMILY[v.projectType];
  if (!projectFamily) {
    return { ok: false, error: `Unknown project type: ${v.projectType}` };
  }
  const siteType = SITE_TYPE[v.siteType];
  if (!siteType) {
    return { ok: false, error: `Unknown site type: ${v.siteType}` };
  }

  const schemeLinked = v.linkedToGovtScheme === "yes";
  let schemeName: string | undefined;
  if (schemeLinked) {
    schemeName = v.schemeName ? GOVERNMENT_SCHEME[v.schemeName] : undefined;
    if (v.schemeName && !schemeName) {
      return { ok: false, error: `Unknown government scheme: ${v.schemeName}` };
    }
  }

  const shadingCondition = v.shadingConditions ? SHADING_CONDITION[v.shadingConditions] : undefined;
  if (v.shadingConditions && !shadingCondition) {
    return { ok: false, error: `Unknown shading condition: ${v.shadingConditions}` };
  }
  const connectionPhase = v.connectionPhase ? CONNECTION_PHASE[v.connectionPhase] : undefined;
  if (v.connectionPhase && !connectionPhase) {
    return { ok: false, error: `Unknown connection phase: ${v.connectionPhase}` };
  }
  const equipmentTier = v.preferredEquipmentTier ? EQUIPMENT_TIER[v.preferredEquipmentTier] : undefined;
  if (v.preferredEquipmentTier && !equipmentTier) {
    return { ok: false, error: `Unknown equipment tier: ${v.preferredEquipmentTier}` };
  }
  // "on-grid" -> "on_grid" etc. — same three values as the backend enum, just
  // a hyphen where the backend uses an underscore.
  const connectionType = v.connectionType.replace(/-/g, "_");

  const body: Record<string, unknown> = {
    lead_id: leadId,
    customer_type: v.customerType,
    organisation_name: v.organisationName || undefined,
    gst_number: v.gstNumber || undefined,
    project_family: projectFamily,
    scheme_linked: schemeLinked,
    scheme_name: schemeName ?? "none",

    state: v.state,
    district: v.districtCity,
    pin_code: v.pinCode,
    full_address: v.fullAddress || undefined,
    discom: v.discom || undefined,
    consumer_number: v.consumerNumber || undefined,
    site_type: siteType,
    roof_area_sqft: toFloat(v.siteAreaSqFt),
    floors: toInt(v.numberOfFloors),
    shading_condition: shadingCondition,
    structural_notes: v.structuralNotes || undefined,

    avg_monthly_bill_inr: toFloat(v.avgMonthlyBill),
    avg_monthly_units_kwh: toFloat(v.avgMonthlyUnits),
    peak_load_kw: toFloat(v.peakLoad),
    connection_phase: connectionPhase,
    desired_output_kw: toFloat(v.desiredSystemOutput),
    load_notes: v.specialLoadNotes || undefined,

    connection_type: connectionType,
    net_metering_required: v.netMeteringRequired === "yes",
    dcr_panels_required: v.dcrRequired === "yes",
    ev_charging: v.evChargingIntegration === "yes",
    battery_storage: v.batteryStorageIntegration === "yes",
    equipment_tier: equipmentTier,
    additional_requirements: buildAdditionalRequirements(v),
  };

  return { ok: true, body };
}
