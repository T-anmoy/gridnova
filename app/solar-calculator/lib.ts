// Pure helpers for the public Solar Calculator — kept separate from the
// component so the mapping/formatting logic is directly unit-testable
// without rendering React.

export type CustomerType = "residential" | "society";
export type SizingMethod = "bill" | "roof_area";

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
