import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDatetime } from '@/lib/dashboard/utils'
import { STATUS_LABEL, STATUS_VARIANT, categoryLabel } from '@/lib/handover/labels'
import type { ServiceRequest } from '@/lib/handover/schemas'

/** The chips every service-request list shows: status, warranty, SLA. */
export function RequestBadges({ request }: { request: ServiceRequest }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={STATUS_VARIANT[request.status] ?? 'gray'}>{STATUS_LABEL[request.status] ?? request.status}</Badge>
      {request.within_warranty === true && <Badge variant="green" data-testid="within-warranty">Within warranty</Badge>}
      {request.within_warranty === false && <Badge variant="gray" data-testid="out-of-warranty">Out of warranty</Badge>}
      {request.overdue && request.status !== 'resolved' && request.status !== 'rejected' && <Badge variant="red" data-testid="sla-overdue">Overdue</Badge>}
    </span>
  )
}

/** SLA text only when the backend has an SLA (it is null until Grid Nova sets one). */
export function SlaText({ request }: { request: ServiceRequest }) {
  if (!request.sla_due_at) return <span className="text-gray-500">No SLA set</span>
  return <span>{formatDatetime(request.sla_due_at)}</span>
}

export default function ServiceRequestLine({ request }: { request: ServiceRequest }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-3" data-testid="service-request-line">
      <div className="min-w-0">
        <Link href={`/dashboard/service-requests/${request.request_id}`} className="inline-flex min-h-[44px] items-center text-sm font-medium text-[#0e2a63] underline">
          #{request.request_id} · {categoryLabel(request.category)}
        </Link>
        <p className="line-clamp-2 text-sm text-gray-700">{request.description}</p>
        <p className="text-xs text-gray-500">Raised {formatDate(request.created_at)}{request.raised_via ? ` via ${request.raised_via}` : ''}</p>
      </div>
      <RequestBadges request={request} />
    </li>
  )
}
