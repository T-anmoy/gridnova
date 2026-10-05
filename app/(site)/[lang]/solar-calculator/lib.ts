// Pure helpers for the public Solar Calculator — kept separate from the
// component so the mapping/formatting logic is directly unit-testable
// without rendering React.

export type CustomerType = "residential" | "society";
// "units" added alongside the existing bill/roof_area split — sizing by known
// consumption is the most accurate of the three, per the backend's own
// sizing.py (by_units/by_bill/by_roof_area all supported server-side now).
export type SizingMethod = "bill" | "units" | "roof_area";

// UI method -> the backend's real sizing_method vocabulary (app/pricing/
// sizing.py's _KNOWN_SIZING_METHODS: "by_units" | "by_bill" | "by_roof_area").
export function sizingMethodToEngineKey(method: SizingMethod): string {
  switch (method) {
    case "bill":
      return "by_bill";
    case "units":
      return "by_units";
    case "roof_area":
      return "by_roof_area";
  }
}

// The pricing engine's `segment` is a closed vocabulary of
// residential/commercial/industrial/government (see the backend session's
// app/pricing/engine.py KNOWN_SEGMENTS) — it has no "society" segment. A
// housing society is residential rooftop, not commercial/industrial/
// government, so both customer types resolve to "residential" here.
export function toSegment(customerType: CustomerType): string {
  switch (customerType) {
    case "residential":
    case "society":
      return "residential";
  }
}

// UI-friendly roof descriptions mapped to the pricing engine's recognized
// short keys (rcc/tin/metal/asbestos — see calculate_complexity_modifier).
// "Not sure" intentionally maps to undefined so the engine falls back to its
// own default modifier rather than us guessing. formPrimitives' SelectField
// takes a flat `options: string[]` (the label IS the value), so the label is
// what's held in component state — ROOF_TYPE_LABELS/roofLabelToEngineKey
// convert at submit time.
const ROOF_TYPES: [key: string, label: string][] = [
  ["rcc", "RCC / Concrete Flat Roof"],
  ["tin", "Sloped Roof — Tin"],
  ["metal", "Sloped Roof — Metal Sheet"],
  ["asbestos", "Asbestos Sheet Roof"],
  ["", "Not Sure"],
];

export const ROOF_TYPE_LABELS = ROOF_TYPES.map(([, label]) => label);

export function roofLabelToEngineKey(label: string): string | undefined {
  const found = ROOF_TYPES.find(([, l]) => l === label);
  return found && found[0] ? found[0] : undefined;
}

export const CONNECTION_PHASES = ["Single Phase", "Three Phase", "Not Sure"];

// UI label -> the backend's real connection_phase vocabulary (app/pricing/
// sizing.py's PLACEHOLDER_PHASE_CAP_KW keys). "Not Sure" maps to undefined so
// sizing is left uncapped rather than defensively guessing single-phase.
export function connectionPhaseToEngineKey(label: string): string | undefined {
  switch (label) {
    case "Single Phase":
      return "single_phase";
    case "Three Phase":
      return "three_phase";
    default:
      return undefined;
  }
}

// Equipment tier is not a customer-supplied choice on this public path — the
// backend always prices at its fixed best tier (see instant_estimate.py's
// FIXED_PUBLIC_TIER) and no longer accepts or returns a tier at all. Every
// Grid Nova installation uses the same top-quality equipment as standard.

// Site-access difficulty — new to the calculator, no prior UI precedent (see
// app/pricing/engine.py's PLACEHOLDER_ACCESS_DIFFICULTY_MODIFIER: this is
// about reaching the site at all — stairs-only, tight lane, no crane access —
// not what the roof is made of, which is the separate Roof Type field above).
const ACCESS_DIFFICULTIES: [key: string, label: string][] = [
  ["easy", "Easy — ground floor or good vehicle/crane access"],
  ["moderate", "Moderate — some stairs or a narrow approach"],
  ["difficult", "Difficult — stairs-only, tight lane, no crane access"],
];
export const ACCESS_DIFFICULTY_LABELS = ACCESS_DIFFICULTIES.map(([, label]) => label);
export function accessDifficultyLabelToEngineKey(label: string): string | undefined {
  return ACCESS_DIFFICULTIES.find(([, l]) => l === label)?.[0];
}

// Shading condition — extends the proposal wizard's own SHADING_CONDITIONS
// (app/proposal/new/types.ts: no/partial-morning/partial-evening/heavy) with
// a fifth "significant" option, which is what actually drives this flow's
// indicative-range behaviour (see the backend's instant_estimate.py: shading
// this severe is treated as too unreliable for a single confident number).
// Kept as its own list rather than importing the proposal one, since that
// list has no "significant" tier to extend without changing its own meaning
// for the sales-facing wizard that already relies on it.
const SHADING_CONDITIONS: [key: string, label: string][] = [
  ["none", "No shading"],
  ["partial_morning", "Partial shading (morning)"],
  ["partial_evening", "Partial shading (evening)"],
  ["heavy", "Heavy shading"],
  ["significant", "Significant shading / many obstructions"],
];
export const SHADING_LABELS = SHADING_CONDITIONS.map(([, label]) => label);
export function shadingLabelToEngineKey(label: string): string | undefined {
  return SHADING_CONDITIONS.find(([, l]) => l === label)?.[0];
}

// Validation messages. English defaults here keep these helpers usable (and
// unit-testable) on their own; the calculator passes the visitor's locale's
// messages (calculator.errors).
export const DEFAULT_VALIDATION_ERRORS = {
  pinRequired: "PIN code is required",
  pinInvalid: "Enter a valid 6-digit PIN code",
  emailRequired: "Email is required",
  emailInvalid: "Enter a valid email address",
  phoneRequired: "Phone number is required",
  phoneInvalid: "Enter a valid 10-digit mobile number",
  nameRequired: "Name is required",
  nameShort: "Name must be at least 2 characters",
  nameInvalid: "Enter a valid name",
};
export type ValidationErrors = typeof DEFAULT_VALIDATION_ERRORS;

// 6-digit Indian PIN code.
export function validatePinCode(value: string, e: ValidationErrors = DEFAULT_VALIDATION_ERRORS): string | undefined {
  const v = value.trim();
  if (!v) return e.pinRequired;
  if (!/^\d{6}$/.test(v)) return e.pinInvalid;
  return undefined;
}

// DISCOM-by-state lookup lives in one place, shared with the proposal
// wizard (app/proposal/new/types.ts) — re-exported here rather than
// duplicated, so both consumers stay in sync with the same real data.
export { discomsForState } from "@/app/(internal)/proposal/new/types";

// Rough rooftop-solar rule of thumb (~100 sq ft per kW of installed capacity).
// This is a frontend-only placeholder used solely so a customer who only
// knows their roof area (not their bill) can still get an instant indicative
// number — it is independent of, and no more or less "placeholder" than, the
// backend's own PLACEHOLDER_* pricing constants. Real conversion guidance
// pending the same business input (Raju Paul) the backend rates are pending.
export const PLACEHOLDER_ROOF_AREA_SQFT_PER_KW = 100;
const MIN_SIZE_KW = 1;
const MAX_SIZE_KW = 500; // sanity ceiling for a mistyped roof area

export function roofAreaToSizeKw(roofAreaSqFt: number): number {
  const raw = roofAreaSqFt / PLACEHOLDER_ROOF_AREA_SQFT_PER_KW;
  return Math.min(MAX_SIZE_KW, Math.max(MIN_SIZE_KW, Math.round(raw * 10) / 10));
}

export function validateEmail(value: string, e: ValidationErrors = DEFAULT_VALIDATION_ERRORS): string | undefined {
  const v = value.trim();
  if (!v) return e.emailRequired;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return e.emailInvalid;
  return undefined;
}

export function validatePhone(value: string, e: ValidationErrors = DEFAULT_VALIDATION_ERRORS): string | undefined {
  const v = value.trim();
  if (!v) return e.phoneRequired;
  const stripped = v.replace(/[\s\-().]/g, "");
  const core = stripped.replace(/^(\+91|91|0)/, "");
  if (!/^\d{10}$/.test(core)) return e.phoneInvalid;
  if (!/^[6-9]/.test(core)) return e.phoneInvalid;
  if (/^(.)\1{9}$/.test(core)) return e.phoneInvalid;
  return undefined;
}

export function validateName(value: string, e: ValidationErrors = DEFAULT_VALIDATION_ERRORS): string | undefined {
  const v = value.trim();
  if (!v) return e.nameRequired;
  if (v.length < 2) return e.nameShort;
  // Any letter in any script — names may be typed in Devanagari or Bengali.
  if (!/\p{L}/u.test(v)) return e.nameInvalid;
  return undefined;
}
