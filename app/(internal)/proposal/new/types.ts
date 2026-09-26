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

// All 28 states + 8 union territories.
export const STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  // Union Territories
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
  "Puducherry",
  "Chandigarh",
  "Andaman & Nicobar Islands",
  "Lakshadweep",
  "Dadra & Nagar Haveli and Daman & Diu",
];

// Real DISCOM (electricity distribution company) coverage per state/UT,
// sourced from official DISCOM records as of 2026. Where a state has
// multiple regional DISCOMs, all are listed with a plain-language regional
// hint so a customer can pick the one covering their area (PIN-to-DISCOM
// mapping isn't available). Where a state/UT has no separate corporatized
// DISCOM brand, the single entry is its state electricity department.
//
// This is NOT permanent — DISCOM privatization and restructuring genuinely
// happens (Odisha's 2021 privatization of distribution to four Tata Power
// companies is a recent real example). Re-verify this list periodically
// rather than treating it as a one-time fixed reference.
export const DISCOMS_BY_STATE: Record<string, string[]> = {
  "Andhra Pradesh": ["APEPDCL (Eastern)", "APSPDCL (Southern)", "APCPDCL (Central)", "APNPDCL (Northern)"],
  "Arunachal Pradesh": ["Arunachal Pradesh State Electricity Department"],
  Assam: ["APDCL (Assam Power Distribution Company)"],
  Bihar: ["NBPDCL (North Bihar)", "SBPDCL (South Bihar)"],
  Chhattisgarh: ["CSPDCL"],
  Goa: ["Goa Electricity Department"],
  Gujarat: [
    "UGVCL (Uttar Gujarat)",
    "PGVCL (Paschim Gujarat)",
    "DGVCL (Dakshin Gujarat)",
    "MGVCL (Madhya Gujarat)",
    "Torrent Power (Ahmedabad/Surat/Gandhinagar — private)",
  ],
  Haryana: ["DHBVN (Dakshin Haryana)", "UHBVN (Uttar Haryana)"],
  "Himachal Pradesh": ["HPSEBL"],
  Jharkhand: ["JBVNL"],
  Karnataka: ["BESCOM (Bangalore)", "MESCOM (Mangalore)", "CESC Mysuru", "GESCOM (Kalaburagi)", "HESCOM (Hubli)"],
  Kerala: ["KSEBL"],
  "Madhya Pradesh": ["MPPKVVCL (East)", "MPMKVVCL (Central)", "MPPaKVVCL (West)"],
  Maharashtra: ["MSEDCL (statewide)", "BEST (Mumbai)", "Tata Power (Mumbai)", "Adani Electricity (Mumbai)"],
  Manipur: ["MSPDCL"],
  Meghalaya: ["MePDCL"],
  Mizoram: ["Mizoram Power & Electricity Department"],
  Nagaland: ["Nagaland Department of Power"],
  Odisha: ["TPNODL (North)", "TPSODL (South)", "TPWODL (West)", "TPCODL (Central)"],
  Punjab: ["PSPCL"],
  Rajasthan: ["JVVNL (Jaipur)", "AVVNL (Ajmer)", "JdVVNL (Jodhpur)"],
  Sikkim: ["Sikkim Energy & Power Department"],
  "Tamil Nadu": ["TANGEDCO"],
  Telangana: ["TSSPDCL (Southern)", "TSNPDCL (Northern)"],
  Tripura: ["TSECL"],
  "Uttar Pradesh": [
    "PuVVNL (Purvanchal)",
    "PVVNL (Paschimanchal)",
    "MVVNL (Madhyanchal)",
    "DVVNL (Dakshinanchal)",
    "KESCO (Kanpur)",
  ],
  Uttarakhand: ["UPCL"],
  "West Bengal": ["WBSEDCL", "CESC Limited (Kolkata & parts of Howrah)"],
  // Union Territories
  Delhi: ["BRPL (BSES Rajdhani)", "BYPL (BSES Yamuna)", "TPDDL (Tata Power Delhi)", "NDMC (Lutyens' Delhi)"],
  "Jammu & Kashmir": ["J&K Power Development Department"],
  Ladakh: ["Ladakh Power Development Department"],
  Puducherry: ["Puducherry Electricity Department"],
  Chandigarh: ["Chandigarh Electricity Department"],
  "Andaman & Nicobar Islands": ["A&N Electricity Department"],
  Lakshadweep: ["Lakshadweep Electricity Department"],
  "Dadra & Nagar Haveli and Daman & Diu": ["DNH&DD Electricity Department"],
};

// Flat fallback (e.g. a DISCOM selector shown before a state is chosen) —
// every real DISCOM across all states/UTs, deduplicated. Prefer
// `discomsForState` wherever a state is already known.
export const DISCOMS = Array.from(new Set(Object.values(DISCOMS_BY_STATE).flat()));

export function discomsForState(state: string): string[] {
  return DISCOMS_BY_STATE[state] ?? [];
}

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
