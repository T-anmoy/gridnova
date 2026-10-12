import type { LeadSummary } from '@/lib/dashboard/types'

// GET /api/v1/dashboard/leads as documented in BE-1 §2: the paged envelope.
export function leadItem(id: number, over: Partial<LeadSummary> = {}): LeadSummary {
  return {
    id,
    customer_id: 7,
    pipeline_stage: 'qualifying',
    lead_score: 'low',
    source: 'website_chat',
    created_at: '2026-10-10T04:00:00+00:00',
    assigned_employee_id: null,
    project_reference_id: 'GNE-0001',
    ...over,
  }
}

export function leadPage(items: LeadSummary[], over: { page?: number; page_size?: number; total?: number } = {}) {
  return { items, page: over.page ?? 1, page_size: over.page_size ?? 25, total: over.total ?? items.length }
}

export const LEAD_LIST_FIXTURE = leadPage([leadItem(12), leadItem(11, { source: 'website_booking' })])
