import { z } from 'zod'
import type { SurveyCorrection, SurveyReportLink, SurveyResults, SurveyStatus } from './survey-types'

// Runtime checks for the survey responses (site_survey.md §3–§4), applied at
// the fetch boundary so a contract drift fails loudly with the field name
// instead of rendering a wrong kW or price. Only what the UI reads is checked;
// unknown extra keys pass through.

const variant = z.enum(['individual_house', 'housing_society', 'commercial_roof'])
const signature = z.object({ signed: z.boolean(), signed_at: z.string().nullable() })

export const surveyStatusSchema = z
  .object({
    onboarding_id: z.number(),
    variant,
    sections: z.array(
      z
        .object({
          key: z.string(),
          complete: z.boolean(),
          missing: z.array(z.string()),
          months_recorded: z.number().optional(),
          months_required: z.number().optional(),
          months_requested: z.number().optional(),
        })
        .passthrough()
    ),
    complete: z.boolean(),
    signatures: z.object({ customer: signature, associate: signature }),
    declaration: z.object({ name: z.string().nullable(), declared_at: z.string().nullable() }),
    required_to_submit: z.boolean(),
    grandfathered: z.boolean(),
    review: z
      .object({
        outcome: z.enum(['feasible', 'feasible_with_conditions', 'revisit_needed', 'not_feasible']).nullable(),
        notes: z.string().nullable(),
        conditions: z.array(z.string()),
        revisit_items: z.array(z.object({ section: z.string(), field: z.string().nullable(), note: z.string() }).passthrough()),
        reviewed_at: z.string().nullable(),
        revised_after_review: z.boolean(),
      })
      .passthrough()
      .optional(),
    report: z.object({ generated_at: z.string().nullable() }).passthrough().optional(),
  })
  .passthrough() as unknown as z.ZodType<SurveyStatus>

// kW values are JSON numbers; money is decimal strings (§4).
const kw = z.number().nullable()
const money = z.string()

const packagePrice = z
  .object({
    basic: money,
    gst: money,
    final: money,
    display_name: z.string(),
    net_after_subsidy: money.nullable().optional(),
  })
  .passthrough()

export const surveyResultsSchema = z
  .object({
    onboarding_id: z.number(),
    variant,
    max_by_area_kw: kw,
    max_by_load_kw: kw,
    recommended_by_usage_kw: kw,
    suggested_kw: kw,
    limiting_factor: z.enum(['area', 'load', 'usage']).nullable(),
    requested_kw: kw,
    bills: z
      .object({
        months_recorded: z.number(),
        average_monthly_units_kwh: z.number().nullable(),
        average_monthly_bill_inr: money.nullable(),
        implied_tariff_inr_per_kwh: money.nullable(),
      })
      .passthrough(),
    assumptions: z.object({ area_sqft_per_kw: z.number(), load_cap_ratio: z.number(), target_offset_percent: z.number() }).passthrough(),
    warnings: z.array(z.object({ code: z.string(), params: z.record(z.string(), z.unknown()).optional() }).passthrough()),
    estimate: z
      .object({
        indicative: z.literal(true),
        size_kw: kw,
        price_status: z.enum(['list_price', 'custom_quote', 'not_enough_to_size']),
        custom_quote_reasons: z.array(z.string()),
        packages: z.record(z.string(), packagePrice),
        subsidy_inr: money.nullable().optional(),
        subsidy_conditions: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough() as unknown as z.ZodType<SurveyResults>

// §9 corrections and §10 report links.
const correction = z
  .object({
    correction_id: z.number(),
    onboarding_id: z.number(),
    changes: z.record(z.string(), z.unknown()),
    reason: z.string(),
    status: z.enum(['pending', 'applied', 'rejected']),
    requested_at: z.string(),
    reviewed_at: z.string().nullable(),
    review_note: z.string().nullable(),
  })
  .passthrough()

export const surveyCorrectionSchema = correction as unknown as z.ZodType<SurveyCorrection>
export const surveyCorrectionListSchema = z.object({ items: z.array(correction) }).passthrough() as unknown as z.ZodType<{ items: SurveyCorrection[] }>

export const surveyReportLinkSchema = z
  .object({ url: z.string(), expires_at: z.string(), filename: z.string(), generated_at: z.string() })
  .passthrough() as unknown as z.ZodType<SurveyReportLink>
