import '@/lib/zod-config'
import { z } from 'zod'

// BE-5 contract (grid-nova-ai-backend docs/api/handover_warranty.md). The backend publishes no
// response schema for these routes, so these zod shapes are the runtime guard. Fields the
// contract says may be null (unconfirmed warranty values, an unset SLA) stay nullable: a
// missing value is shown as "not confirmed", never filled in.

const str = z.string().nullish()

export const packItemSchema = z.looseObject({
  key: z.string(),
  label: z.string(),
  message_key: str,
  done: z.boolean(),
  source: str,
  done_at: str,
  done_by: str,
  note: str,
  method: str,
  customer_name: str,
  through_milestone: z.number().nullish(),
})
export type PackItem = z.infer<typeof packItemSchema>

export const warrantyUnitSchema = z.looseObject({
  unit_id: z.number().nullish(),
  category: z.string(),
  serial_number: str,
  make: str,
  model: str,
  equipment_id: z.number().nullish(),
  warranty_start: str,
  warranty_end: str,
  source: z.string(),
  active: z.boolean().nullish(),
})
export type WarrantyUnit = z.infer<typeof warrantyUnitSchema>

export const warrantySchema = z.looseObject({
  handover_date: str,
  system: z.looseObject({ years: z.number().nullish(), starts: str, ends: str, active: z.boolean().nullish() }),
  om: z.looseObject({
    free_months: z.number().nullish(),
    free_until: str,
    free_period_active: z.boolean().nullish(),
    terms_after_free_period: str,
  }),
  panel_performance_life_years: z.number().nullish(),
  units: z.array(warrantyUnitSchema),
})
export type Warranty = z.infer<typeof warrantySchema>

export const packSchema = z.looseObject({
  onboarding_id: z.number(),
  project_id: z.number().nullish(),
  handover_recorded: z.boolean(),
  pack_required: z.boolean(),
  items: z.array(packItemSchema),
  complete: z.boolean(),
  missing: z.array(z.string()),
  done: z.number(),
  total: z.number(),
  warranty: warrantySchema.nullish(),
  pdf: z.looseObject({ status: z.string(), held_reason: str, generated_at: str }),
  can_act: z.boolean().nullish(),
  can_raise_service_request: z.boolean().nullish(),
  link: z
    .looseObject({ state: z.string(), issued_at: str, issued_by: str, expires_at: str, revoked_at: str })
    .nullish(),
  email: z.looseObject({ status: str, skipped_reason: str, emailed_at: str }).nullish(),
})
export type Pack = z.infer<typeof packSchema>

export const issuedLinkSchema = z.looseObject({
  link: z.looseObject({ url: z.string(), expires_at: str }),
  pack: packSchema,
})
export type IssuedLink = z.infer<typeof issuedLinkSchema>

export const signedFileSchema = z.looseObject({ url: z.string(), expires_at: str, filename: str, file_ref: str })
export type SignedFile = z.infer<typeof signedFileSchema>

const photoSchema = z.looseObject({
  file_ref: z.string(),
  filename: str,
  content_type: str,
  size_bytes: z.number().nullish(),
  received_at: str,
})

const historySchema = z.looseObject({
  kind: z.string(),
  actor: str,
  from_status: str,
  to_status: str,
  note: str,
  detail: z.unknown().optional(),
  at: z.string(),
})

export const serviceRequestSchema = z.looseObject({
  request_id: z.number(),
  onboarding_id: z.number().nullish(),
  category: z.string(),
  description: z.string(),
  status: z.string(),
  raised_via: str,
  within_warranty: z.boolean().nullish(),
  warranty_end: str,
  photo_count: z.number().nullish(),
  created_at: z.string(),
  closed_at: str,
  resolution_note: str,
  sla_due_at: str,
  overdue: z.boolean().nullish(),
  raised_by: str,
  assignee_id: str,
  contact_phone: str,
  updated_at: str,
  photos: z.array(photoSchema).nullish(),
  history: z.array(historySchema).nullish(),
  customer_name: str,
  project_reference_id: str,
  can_handle: z.boolean().nullish(),
})
export type ServiceRequest = z.infer<typeof serviceRequestSchema>

export const serviceQueueSchema = z.looseObject({
  items: z.array(serviceRequestSchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
  can_handle: z.boolean().nullish(),
})
export type ServiceQueue = z.infer<typeof serviceQueueSchema>

export const projectRequestsSchema = z.looseObject({
  items: z.array(serviceRequestSchema),
  can_handle: z.boolean().nullish(),
  can_raise: z.boolean().nullish(),
})
export type ProjectRequests = z.infer<typeof projectRequestsSchema>

/** The page a customer sees through their link: nothing beyond what the token grants. */
export const publicHandoverSchema = z.looseObject({
  customer_name: str,
  project_reference_id: str,
  site_address: str,
  system: z.looseObject({ installed_module_kw: z.union([z.string(), z.number()]).nullish(), connection_phase: str }).nullish(),
  warranty: warrantySchema.nullish(),
  service: z.looseObject({
    phone: str,
    email: str,
    sla_hours: z.number().nullish(),
    categories: z.array(z.union([z.string(), z.looseObject({ key: z.string(), label: str })])).nullish(),
    max_photos: z.number().nullish(),
  }),
  pdf_available: z.boolean().nullish(),
  link_expires_at: str,
})
export type PublicHandover = z.infer<typeof publicHandoverSchema>

export const publicRequestsSchema = z.looseObject({ items: z.array(serviceRequestSchema) })
