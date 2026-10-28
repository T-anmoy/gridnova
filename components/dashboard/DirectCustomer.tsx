import { Badge } from '@/components/ui/badge'

// A direct customer (BE-20): a lead with no associate. Their payment and milestone rows carry
// `lead_id` and a null `onboarding_id`; their payments live on the lead's Payments tab.

export const leadPaymentsHref = (leadId: number) => `/dashboard/leads/${leadId}?tab=payments`

/** The lead behind a direct customer's row, or null for an associate customer's. */
export function directLeadId(row: { onboarding_id?: number | null; lead_id?: number | null; project?: { lead_id?: number | null } | null }): number | null {
  if (row.onboarding_id != null) return null
  return row.lead_id ?? row.project?.lead_id ?? null
}

export function DirectTag() {
  return (
    <Badge variant="blue" data-testid="direct-tag" title="A direct customer: no associate">
      Direct
    </Badge>
  )
}
