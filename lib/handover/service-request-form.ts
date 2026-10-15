import { SERVICE_CATEGORIES } from './labels'

// The multipart body shared by the staff, associate and customer "raise a service request"
// endpoints: `category`, `description` (≤ 2000), optional `contact_phone` (≤ 32) and `files[]`.

export const MAX_DESCRIPTION = 2000
export const MAX_PHONE = 32
/** The server's own limit (service.max_photos) is authoritative; the customer page reads it from the API. */
export const DEFAULT_MAX_PHOTOS = 5

export interface ServiceRequestInput {
  category: string
  description: string
  contact_phone?: string
  files: File[]
}

export function buildServiceRequestForm(input: ServiceRequestInput): FormData {
  const form = new FormData()
  form.set('category', input.category)
  form.set('description', input.description.trim())
  const phone = input.contact_phone?.trim()
  if (phone) form.set('contact_phone', phone)
  // One field name (`files`), one part per photo — the shape of the endpoint's list parameter.
  for (const file of input.files) form.append('files', file)
  return form
}

export type ServiceRequestProblem = 'category' | 'description' | 'phone'

/** Local checks only; the server still validates. Returns the first problem, in form order. */
export function serviceRequestProblem(input: Pick<ServiceRequestInput, 'category' | 'description' | 'contact_phone'>): ServiceRequestProblem | null {
  if (!(SERVICE_CATEGORIES as readonly string[]).includes(input.category)) return 'category'
  const d = input.description.trim()
  if (d.length === 0 || d.length > MAX_DESCRIPTION) return 'description'
  if ((input.contact_phone ?? '').trim().length > MAX_PHONE) return 'phone'
  return null
}
