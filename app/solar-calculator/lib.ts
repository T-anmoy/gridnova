// Pure helpers for the public Solar Calculator — kept separate from the
// component so the mapping/formatting logic is directly unit-testable
// without rendering React.

// Camel-cased mirror of POST /api/v1/pricing/instant-estimate's response
// (see app/api/routes/pricing.py on the backend) — mapped from the raw
// snake_case JSON at the fetch boundary in SolarCalculator.tsx so the reveal
// components work with idiomatic field names.
export interface InstantEstimateResult {
  recommendedSizeKw: number;
  tierLabel: string;
  baseCost: number;
  tierCost: number;
  accessDifficultyAdder: number;
  componentBreakdown: Record<string, number>;
  subtotalBeforeTax: number;
  gstAmount: number;
  subsidyInr: number;
  netCost: number | null;
  isIndicativeRange: boolean;
  netCostRangeMin: number | null;
  netCostRangeMax: number | null;
  note: string | null;
}

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

// Equipment-quality tier — the backend's real, closed vocabulary
// (app/pricing/engine.py's KNOWN_TIERS: good/better/best). Unlike the
// proposal wizard's own EQUIPMENT_TIERS placeholder (Standard/Premium/As
// recommended — a different, TODO-flagged concept awaiting Raju Paul), these
// three names are the real values the engine accepts; only their price
// multipliers (1.0/1.10/1.25) are still placeholder numbers.
const TIERS: [key: string, label: string][] = [
  ["good", "Good"],
  ["better", "Better"],
  ["best", "Best"],
];
export const TIER_LABELS = TIERS.map(([, label]) => label);
export function tierLabelToEngineKey(label: string): string {
  return TIERS.find(([, l]) => l === label)?.[0] ?? "good";
}
export function tierEngineKeyToLabel(key: string): string {
  return TIERS.find(([k]) => k === key)?.[1] ?? "Good";
}

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

// 6-digit Indian PIN code.
export function validatePinCode(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "PIN code is required";
  if (!/^\d{6}$/.test(v)) return "Enter a valid 6-digit PIN code";
  return undefined;
}

// DISCOM-by-state lookup lives in one place, shared with the proposal
// wizard (app/proposal/new/types.ts) — re-exported here rather than
// duplicated, so both consumers stay in sync with the same real data.
export { discomsForState } from "@/app/proposal/new/types";

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

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function validateEmail(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Enter a valid email address";
  return undefined;
}

export function validatePhone(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Phone number is required";
  const stripped = v.replace(/[\s\-().]/g, "");
  const core = stripped.replace(/^(\+91|91|0)/, "");
  if (!/^\d{10}$/.test(core)) return "Enter a valid 10-digit mobile number";
  if (!/^[6-9]/.test(core)) return "Enter a valid 10-digit mobile number";
  if (/^(.)\1{9}$/.test(core)) return "Enter a valid 10-digit mobile number";
  return undefined;
}

export function validateName(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Name is required";
  if (v.length < 2) return "Name must be at least 2 characters";
  if (!/[a-zA-Z]/.test(v)) return "Enter a valid name";
  return undefined;
}
