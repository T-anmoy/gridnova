// Validation for the three public lead-capture routes. Lengths and enums match
// the limits the backend's own public endpoints enforce, so an invalid
// submission is refused here with a clear message instead of being half
// processed (email sent, CRM mirror 422).
import { z } from 'zod'

export const REQUIRED_MESSAGE = 'Name, phone, email and customer type are required.'
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const text = (max: number, label: string) => z.string().trim().max(max, `${label} must be ${max} characters or fewer.`)
const optionalText = (max: number, label: string) => text(max, label).optional()

// Numeric fields arrive from forms as text ("3,000", "₹3000") or as numbers.
const numericText = (label: string) =>
  z
    .union([z.string().trim().max(40, `${label} is too long.`), z.number()])
    .transform((v) => String(v))
    .optional()

const required = (max: number, label: string, requiredMessage: string) =>
  z.string({ error: requiredMessage }).trim().min(1, requiredMessage).max(max, `${label} must be ${max} characters or fewer.`)

const referralRef = z
  .unknown()
  .optional()
  .transform((v) => {
    if (typeof v !== 'string') return undefined
    const t = v.trim()
    return t && t.length <= 64 ? t : undefined
  })

const customerType = z.enum(['residential', 'society'], { error: REQUIRED_MESSAGE })

const email = (requiredMessage: string) =>
  z
    .string({ error: requiredMessage })
    .trim()
    .min(1, requiredMessage)
    .max(254, 'Email must be 254 characters or fewer.')
    .regex(EMAIL_RE, 'Enter a valid email address.')

export const estimateRequestSchema = z.object({
  customerType,
  name: required(200, 'Name', REQUIRED_MESSAGE),
  phone: required(30, 'Phone', REQUIRED_MESSAGE),
  email: email(REQUIRED_MESSAGE),
  state: optionalText(100, 'State'),
  cityOrPin: optionalText(200, 'City / PIN'),
  averageMonthlyBill: numericText('Average monthly bill'),
  roofType: optionalText(100, 'Roof type'),
  roofAreaSqFt: numericText('Roof area'),
  floors: numericText('Floors'),
  connectionPhase: optionalText(50, 'Connection phase'),
  // An Associate's referral link (associate_ease.md §1.2). Never refused: a
  // bad ref is dropped, and the consent counts only when it is exactly true.
  ref: referralRef,
  shareWithReferrer: z.unknown().optional().transform((v) => (v === true ? true : undefined)),
})
export type EstimateRequestInput = z.infer<typeof estimateRequestSchema>

// The estimate the visitor saw (FE-14): copied from the backend's response, so
// every figure is a decimal string. It only feeds the lead email — anything
// malformed is dropped rather than losing the lead over it.
const decimal = z.string().trim().regex(/^-?\d{1,12}(\.\d{1,4})?$/).optional()
const estimateSnapshot = z
  .object({
    estimateVersion: optionalText(40, 'Estimate version'),
    sizeKw: decimal,
    priceStatus: z.enum(['list_price', 'custom_quote']).optional(),
    netCostInr: decimal,
    netCostIfAnnouncedInr: decimal,
    subsidyConfirmedInr: decimal,
    subsidyAnnouncedInr: decimal,
    subsidyStatus: optionalText(40, 'Subsidy status'),
    monthlySavingInr: decimal,
    paybackYears: decimal,
    confidence: z.enum(['high', 'medium', 'low']).optional(),
  })
  .optional()
  .catch(undefined)

export const configuratorLeadSchema = z.object({
  customerType,
  name: required(200, 'Name', REQUIRED_MESSAGE),
  phone: required(30, 'Phone', REQUIRED_MESSAGE),
  email: email(REQUIRED_MESSAGE),
  state: optionalText(100, 'State'),
  city: optionalText(200, 'City'),
  pinCode: optionalText(10, 'PIN code'),
  discom: optionalText(100, 'DISCOM'),
  numberOfHouses: numericText('Number of flats/houses'),
  sizingMethod: optionalText(50, 'Sizing method'),
  averageMonthlyBill: numericText('Average monthly bill'),
  monthlyUnits: numericText('Monthly units'),
  roofAreaSqFt: numericText('Roof area'),
  connectionPhase: optionalText(50, 'Connection phase'),
  sanctionedLoadKw: numericText('Sanctioned load'),
  roofType: optionalText(100, 'Roof type'),
  floors: numericText('Floors'),
  accessDifficulty: optionalText(50, 'Access difficulty'),
  shading: optionalText(50, 'Shading'),
  subsidyInterest: z.enum(['yes', 'no']).optional(),
  indicativeTotalInr: z.number().finite().optional(),
  estimate: estimateSnapshot,
})
export type ConfiguratorLeadInput = z.infer<typeof configuratorLeadSchema>

// Mirrors the limits of the backend's POST /api/v1/public/contact.
export const contactSchema = z.object({
  name: required(200, 'Name', 'Name is required.'),
  email: email('Enter a valid email address.'),
  phone: optionalText(30, 'Phone'),
  message: required(2000, 'Message', 'Message is required.'),
  interest: optionalText(100, 'Interest'),
})
export type ContactInput = z.infer<typeof contactSchema>
