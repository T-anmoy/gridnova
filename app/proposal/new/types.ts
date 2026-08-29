// Shared types, defaults and placeholder option lists for the proposal
// site-assessment wizard. Every array below marked "TODO: Raju Paul" is a
// placeholder shape only — real values, DISCOM lists and scheme sub-fields
// are pending his return from a business trip. Do not treat these as final.

export type CustomerType = "individual" | "organisation";
export type YesNo = "yes" | "no";
export type ConnectionType = "on-grid" | "off-grid" | "hybrid";

export interface ProposalFormValues {
  // Step 1 — Customer & Project Details
  customerType: CustomerType;
  fullName: string;
  contactNumber: string;
  email: string;
  organisationName: string;
  gstNumber: string;
  projectType: string;
  linkedToGovtScheme: YesNo;
  schemeName: string;
  referenceLeadId: string;

  // Step 2 — Installation Site
  state: string;
  districtCity: string;
  pinCode: string;
  fullAddress: string;
  discom: string;
  consumerNumber: string;
  siteType: string;
  siteAreaSqFt: string;
  numberOfFloors: string;
  shadingConditions: string;
  structuralNotes: string;

  // Step 3 — Load & Output Requirements
  avgMonthlyBill: string;
  avgMonthlyUnits: string;
  peakLoad: string;
  connectionPhase: string;
  primaryObjective: string;
  desiredSystemOutput: string;
  specialLoadNotes: string;

  // Step 4 — System Configuration
  connectionType: ConnectionType;
  backupDuration: string;
  netMeteringRequired: YesNo;
  preferredEquipmentTier: string;
  dcrRequired: YesNo;
  evChargingIntegration: YesNo;
  batteryStorageIntegration: YesNo;
  additionalRequirements: string;
}

export const DEFAULT_VALUES: ProposalFormValues = {
  customerType: "individual",
  fullName: "",
  contactNumber: "",
  email: "",
  organisationName: "",
  gstNumber: "",
  projectType: "",
  linkedToGovtScheme: "no",
  schemeName: "",
  referenceLeadId: "",

  state: "",
  districtCity: "",
  pinCode: "",
  fullAddress: "",
  discom: "",
  consumerNumber: "",
  siteType: "",
  siteAreaSqFt: "",
  numberOfFloors: "",
  shadingConditions: "",
  structuralNotes: "",

  avgMonthlyBill: "",
  avgMonthlyUnits: "",
  peakLoad: "",
  connectionPhase: "",
  primaryObjective: "",
  desiredSystemOutput: "",
  specialLoadNotes: "",

  connectionType: "on-grid",
  backupDuration: "",
  netMeteringRequired: "yes",
  preferredEquipmentTier: "",
  dcrRequired: "no",
  evChargingIntegration: "no",
  batteryStorageIntegration: "no",
  additionalRequirements: "",
};

export interface ProposalFiles {
  electricityBills: File[];
  sitePhotos: File[];
  sitePlan: File[];
  govtSchemeRegistration: File[];
  otherDocuments: File[];
}

export const DEFAULT_FILES: ProposalFiles = {
  electricityBills: [],
  sitePhotos: [],
  sitePlan: [],
  govtSchemeRegistration: [],
  otherDocuments: [],
};

export const STEP_NAMES = [
  "Customer & Project Details",
  "Installation Site",
  "Load & Output Requirements",
  "System Configuration",
  "Supporting Documents",
] as const;

export const TOTAL_STEPS = STEP_NAMES.length;

// ── Placeholder dropdown option lists ───────────────────────────────────────
// Every list below is a placeholder shape, not a final value set.

// TODO: Raju Paul to confirm final project type list
export const PROJECT_TYPES = [
  "Rooftop Solar",
  "Ground-Mounted Solar",
  "Government / Institutional",
  "Solar Street Lighting",
  "Solar Water Pump",
  "O&M Service",
  "Consulting / Project Services",
];

// TODO: confirm full scheme list with Raju Paul
export const SCHEME_NAMES = [
  "PM Surya Ghar (Residential)",
  "PM-KUSUM Component A",
  "PM-KUSUM Component B",
  "PM-KUSUM Component C",
  "WBREDA",
  "Other Government Scheme",
];

// TODO: Raju Paul to confirm full state/DISCOM list
export const STATES = [
  "West Bengal",
  "Bihar",
  "Other Eastern State (feasibility required)",
];

// TODO: Raju Paul to supply complete DISCOM list by state
export const DISCOMS = [
  "CESC (Kolkata)",
  "WBSEDCL",
  "SBPDCL (Bihar)",
  "NBPDCL (Bihar)",
  "Other",
];

// Not TODO-marked in the spec — kept as a fixed structural list since site
// type is a physical description, not a Raju-Paul-owned business value.
export const SITE_TYPES = [
  "Rooftop (Residential building)",
  "Rooftop (Commercial / Industrial building)",
  "Rooftop (Institutional / Government)",
  "Ground-Mounted (Open land)",
  "Carport / Canopy",
  "Other",
];

// TODO: confirm with Raju Paul
export const SHADING_CONDITIONS = [
  "No shading",
  "Partial shading (morning)",
  "Partial shading (evening)",
  "Heavy shading / obstructions",
];

// TODO: confirm with Raju Paul
export const CONNECTION_PHASES = ["Single Phase", "Three Phase"];

// TODO: Raju Paul to confirm
export const PRIMARY_OBJECTIVES = [
  "Reduce electricity bill",
  "Full self-sufficiency / net-zero",
  "Backup power during outages",
  "Government scheme compliance",
  "Commercial / industrial captive generation",
  "Other",
];

// TODO: confirm with Raju Paul
export const BACKUP_DURATIONS = [
  "2–4 hours",
  "4–8 hours",
  "8–12 hours",
  "12–24 hours",
  "Custom",
];

// TODO: Raju Paul to define Good/Better/Best tiers
export const EQUIPMENT_TIERS = [
  "Standard",
  "Premium",
  "As recommended by Grid Nova",
];
