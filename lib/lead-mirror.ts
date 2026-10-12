// Builds the backend CRM payloads for the public lead routes (BE-1 §5,
// POST /api/v1/public/estimate-request). Every value is normalised and bounded
// to the backend's own limits: an out-of-range optional is OMITTED rather than
// sent, because one 422 would lose the whole lead.
import type { ConfiguratorLeadInput, EstimateRequestInput } from '@/lib/lead-schemas'

/** "3,000", "₹3000", "Rs. 3,00,000", 3000 → number; anything else → undefined. */
export function parseLooseNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(/₹|\brs\.?|\binr\b/gi, '').replace(/[,\s_]/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return undefined
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

function bounded(value: number | undefined, min: number, max: number): number | undefined {
  return value !== undefined && value >= min && value <= max ? value : undefined
}

const clean = (v: string | undefined) => v || undefined

function floorsOf(v: string | undefined): number | undefined {
  const n = bounded(parseLooseNumber(v), 1, 200)
  return n !== undefined && Number.isInteger(n) ? n : undefined
}

export function estimateMirrorPayload(d: EstimateRequestInput): Record<string, unknown> {
  return {
    name: d.name,
    email: d.email,
    phone: d.phone,
    customer_type: d.customerType,
    state: clean(d.state),
    // The backend has one `city` field; the form collects a combined
    // "City / PIN Code" with no separate PIN — passed through as-is.
    city: clean(d.cityOrPin),
    average_bill: bounded(parseLooseNumber(d.averageMonthlyBill), 0, 100_000_000),
    roof_type: clean(d.roofType),
    roof_area: bounded(parseLooseNumber(d.roofAreaSqFt), 0, 10_000_000),
    floors: floorsOf(d.floors),
    connection_phase: clean(d.connectionPhase),
  }
}

export function configuratorMirrorPayload(d: ConfiguratorLeadInput): Record<string, unknown> {
  const pin = d.pinCode?.replace(/\s/g, '')
  return {
    name: d.name,
    email: d.email,
    phone: d.phone,
    customer_type: d.customerType,
    state: clean(d.state),
    city: clean(d.city),
    average_bill: bounded(parseLooseNumber(d.averageMonthlyBill), 0, 100_000_000),
    roof_type: clean(d.roofType),
    roof_area: bounded(parseLooseNumber(d.roofAreaSqFt), 0, 10_000_000),
    floors: floorsOf(d.floors),
    connection_phase: clean(d.connectionPhase),
    // BE-1 §5 additions (the calculator's own fields):
    pin_code: pin && /^\d{6}$/.test(pin) ? pin : undefined,
    discom: clean(d.discom),
    monthly_units: bounded(parseLooseNumber(d.monthlyUnits), 0, 100_000_000),
    sizing_method: clean(d.sizingMethod),
    access_difficulty: clean(d.accessDifficulty),
    shading: clean(d.shading),
    subsidy_interest: d.subsidyInterest,
    indicative_total_inr: bounded(d.indicativeTotalInr, 0, 10_000_000_000),
  }
}

export function contactMirrorPayload(d: { name: string; email: string; phone?: string; message: string; interest?: string }) {
  return { name: d.name, email: d.email, phone: clean(d.phone), message: d.message, interest: clean(d.interest) }
}
