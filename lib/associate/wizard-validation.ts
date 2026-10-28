// Per-step checks for the new-customer wizard (H3). Format and presence only,
// reusing lib/associate/validation.ts; the backend's 422 stays the authority.
// Survey completeness is NOT enforced here — the server's checklist (§3) and
// the submit gate (§6) own that, so an associate can move on and finish later.
import { fmt } from '@/lib/i18n/types'
import { isValidEmail, isValidMobile, isValidPinCode } from './validation'
import { numberProblem, validateBills, filledBillCount, type SurveyForm } from './survey'
import type { SurveyOptions } from './survey-types'

export interface WizardDraft {
  customer_name: string
  customer_mobile: string
  customer_email: string
  customer_type: string
  pin_code: string
  full_address: string
  state_lgd_code: string
  district_lgd_code: string
  block_lgd_code: string
  connection_in_customer_name: '' | 'yes' | 'no'
  site_type: string
  connection_type: string
  property_in_customer_name: '' | 'yes' | 'no'
  customer_timeline: string
  equipment_package: string
  /** BE contract `desired_output_kw`: the size the customer asked for; the lead's capacity. */
  desired_output_kw?: string
  notice_acknowledged: boolean
  survey: SurveyForm
  // Remembered so a reload mid-wizard reuses the same onboarding (and finds its pending photos).
  onboarding_id?: number
}

export interface ValidationCopy {
  required: string
  choose: string
  mobile: string
  email: string
  pinCode: string
  /** "Enter the size in kW" — optional so older callers keep compiling. */
  kw?: string
}

export interface SurveyErrorCopy {
  bills: Record<string, string>
  roof: Record<string, string>
  layout: Record<string, string>
}

export type StepErrors = Record<string, string>

export function validateWizardStep(
  step: string,
  d: WizardDraft,
  ctx: { isNew: boolean; survey: SurveyOptions; v: ValidationCopy; s: SurveyErrorCopy; now?: Date }
): StepErrors {
  const { v, s } = ctx
  const e: StepErrors = {}
  const need = (key: keyof WizardDraft, msg = v.required) => {
    const val = d[key]
    if (typeof val === 'string' && !val.trim()) e[key] = msg
  }
  const num = (field: keyof SurveyForm, opts: Parameters<typeof numberProblem>[1] = {}, outOfRange?: string) => {
    const p = numberProblem(String(d.survey[field] ?? ''), opts)
    if (p === 'out_of_range') e[field] = outOfRange ?? s.roof.out_of_range
    else if (p) e[field] = s.roof.invalid_number
  }

  switch (step) {
    case 'customer':
      need('customer_name')
      if (!d.customer_mobile.trim()) e.customer_mobile = v.required
      else if (!isValidMobile(d.customer_mobile)) e.customer_mobile = v.mobile
      if (d.customer_email.trim() && !isValidEmail(d.customer_email.trim())) e.customer_email = v.email
      need('customer_type', v.choose)
      if (!d.pin_code.trim()) e.pin_code = v.required
      else if (!isValidPinCode(d.pin_code.trim())) e.pin_code = v.pinCode
      need('full_address')
      break
    case 'connection':
      // The server requires a state AND a district (never `Number('') = 0`).
      need('state_lgd_code', v.choose)
      need('district_lgd_code', v.choose)
      need('connection_in_customer_name', v.choose)
      need('site_type', v.choose)
      need('connection_type', v.choose)
      num('sanctioned_load_kw', { exclusiveMin: true, max: 1_000_000 })
      num('contract_demand_kva', { exclusiveMin: true, max: 1_000_000 })
      num('society_flat_count', { min: 1, integer: true, max: 100_000 })
      break
    case 'bills': {
      const rows = validateBills(d.survey.bills, ctx.now)
      for (const [i, problems] of Object.entries(rows)) e[`bills.${i}`] = problems.map((p) => s.bills[p]).join(' ')
      if (filledBillCount(d.survey.bills) > ctx.survey.max_consumption_months)
        e.bills = fmt(s.bills.too_many_months, { max: ctx.survey.max_consumption_months })
      break
    }
    case 'property':
      need('property_in_customer_name', v.choose)
      break
    case 'requirement':
      if (ctx.isNew) need('equipment_package', v.choose)
      // Without it Grid Nova cannot prepare the formal proposal (formal_proposal_not_ready).
      // Required for a new customer; an older record may add it later (the customer page says it is missing).
      if (!d.desired_output_kw?.trim()) {
        if (ctx.isNew) e.desired_output_kw = v.required
      } else if (numberProblem(d.desired_output_kw, { exclusiveMin: true, max: 1_000_000 })) e.desired_output_kw = v.kw ?? v.required
      break
    case 'house': {
      num('floors', { integer: true, max: 200 })
      num('roof_area_sqft', { exclusiveMin: true, max: 10_000_000 })
      num('shadow_free_area_sqft', { max: 10_000_000 })
      num('roofs_available_count', { integer: true, max: 100 })
      num('roofs_considered_count', { integer: true, max: 100 })
      const avail = Number(d.survey.roofs_available_count)
      const cons = Number(d.survey.roofs_considered_count)
      if (!e.roofs_considered_count && d.survey.roofs_available_count.trim() && d.survey.roofs_considered_count.trim() && cons > avail)
        e.roofs_considered_count = s.roof.roofs_considered_exceeds_available
      if (d.survey.area_mode === 'sections') {
        d.survey.roof_sections.forEach((r, i) => {
          if (!(r.label.trim() || r.length.trim() || r.width.trim() || r.obstacle.trim())) return
          const bad = (x: string, opts: Parameters<typeof numberProblem>[1]) => !x.trim() || numberProblem(x, opts) !== null
          if (!r.label.trim() || bad(r.length, { exclusiveMin: true, max: 500 }) || bad(r.width, { exclusiveMin: true, max: 500 })) {
            e[`roof_sections.${i}`] = s.roof.sectionIncomplete
          } else if (r.obstacle.trim() && (numberProblem(r.obstacle, {}) || Number(r.obstacle) > Number(r.length) * Number(r.width))) {
            e[`roof_sections.${i}`] = numberProblem(r.obstacle, {}) ? s.roof.invalid_number : s.roof.obstacle_exceeds_section
          }
        })
      }
      break
    }
    case 'layout': {
      const max = ctx.survey.distance_max_m
      const tooFar = fmt(s.layout.out_of_range, { max })
      for (const f of ['distance_panel_to_inverter_m', 'distance_inverter_to_lt_panel_m'] as const) {
        const p = numberProblem(d.survey[f], { max })
        if (p === 'out_of_range') e[f] = tooFar
        else if (p) e[f] = s.layout.invalid_number
      }
      break
    }
  }
  return e
}
