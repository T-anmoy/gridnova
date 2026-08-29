import type { ProposalFormValues, ProposalFiles } from "./types";

export type FieldErrors = Partial<Record<keyof ProposalFormValues, string>>;

function required(value: string, message = "This field is required"): string | undefined {
  return value.trim() ? undefined : message;
}

function validateEmail(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Enter a valid email address";
  return undefined;
}

function validatePhone(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Contact number is required";
  const stripped = v.replace(/[\s\-\(\)\.]/g, "");
  const core = stripped.replace(/^(\+91|91|0)/, "");
  if (!/^\d{10}$/.test(core)) return "Enter a valid 10-digit mobile number";
  if (!/^[6-9]/.test(core)) return "Enter a valid 10-digit mobile number";
  if (/^(.)\1{9}$/.test(core)) return "Enter a valid 10-digit mobile number";
  return undefined;
}

function validatePin(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "PIN code is required";
  if (!/^\d{6}$/.test(v)) return "Enter a valid 6-digit PIN code";
  return undefined;
}

function validateNumber(value: string, message: string): string | undefined {
  const v = value.trim();
  if (!v) return message;
  if (!/^\d+(\.\d+)?$/.test(v)) return "Enter a valid number";
  return undefined;
}

// Validators for every field that carries an asterisk in the spec. Fields
// absent from this map are optional — Next/Submit never blocks on them.
const VALIDATORS: Partial<Record<keyof ProposalFormValues, (v: ProposalFormValues) => string | undefined>> = {
  fullName: (v) => required(v.fullName, "Full name is required"),
  contactNumber: (v) => validatePhone(v.contactNumber),
  email: (v) => validateEmail(v.email),
  projectType: (v) => required(v.projectType, "Select a project type"),

  state: (v) => required(v.state, "Select a state"),
  districtCity: (v) => required(v.districtCity, "District / city is required"),
  pinCode: (v) => validatePin(v.pinCode),
  discom: (v) => required(v.discom, "Select a DISCOM / electricity board"),
  siteType: (v) => required(v.siteType, "Select a site type"),
  siteAreaSqFt: (v) => validateNumber(v.siteAreaSqFt, "Roof / site area is required"),

  avgMonthlyBill: (v) => validateNumber(v.avgMonthlyBill, "Average monthly bill is required"),
  connectionPhase: (v) => required(v.connectionPhase, "Select a connection phase"),
  primaryObjective: (v) => required(v.primaryObjective, "Select a primary objective"),
};

// Fields belonging to each step, in the same order the step renders them —
// used both to scope per-step validation and to know which step to jump
// back to when a cross-step submit validation fails.
export const STEP_FIELDS: (keyof ProposalFormValues)[][] = [
  ["fullName", "contactNumber", "email", "projectType"],
  ["state", "districtCity", "pinCode", "discom", "siteType", "siteAreaSqFt"],
  ["avgMonthlyBill", "connectionPhase", "primaryObjective"],
  [],
  [],
];

export function validateStep(step: number, values: ProposalFormValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of STEP_FIELDS[step]) {
    const validator = VALIDATORS[field];
    if (!validator) continue;
    const err = validator(values);
    if (err) errors[field] = err;
  }
  return errors;
}

export function isStepValid(step: number, values: ProposalFormValues): boolean {
  return Object.keys(validateStep(step, values)).length === 0;
}

export function validateDocuments(files: ProposalFiles): string | undefined {
  if (files.electricityBills.length === 0) return "At least one electricity bill is required";
  if (files.sitePhotos.length === 0) return "At least one site photograph is required";
  return undefined;
}

export interface FullValidationResult {
  errors: FieldErrors;
  documentError?: string;
  firstInvalidStep: number | null;
}

// Validates every step's required fields plus the document minimums, and
// reports the earliest step containing a problem so the caller can navigate
// there and surface the errors — used by the final "Submit for Review".
export function validateAll(values: ProposalFormValues, files: ProposalFiles): FullValidationResult {
  let errors: FieldErrors = {};
  let firstInvalidStep: number | null = null;

  for (let step = 0; step < STEP_FIELDS.length; step++) {
    const stepErrors = validateStep(step, values);
    if (Object.keys(stepErrors).length > 0) {
      errors = { ...errors, ...stepErrors };
      if (firstInvalidStep === null) firstInvalidStep = step;
    }
  }

  const documentError = validateDocuments(files);
  if (documentError && firstInvalidStep === null) firstInvalidStep = STEP_FIELDS.length - 1;

  return { errors, documentError, firstInvalidStep };
}
