import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDatetime } from '@/lib/dashboard/utils'
import type { FormalProposalBlocked } from '@/lib/associate/onboarding-types'

// The two blocked reasons need genuinely different treatment everywhere
// they appear (list, detail, portal next-step prompt) — missing_information
// is a data problem fixable by filling in a field; draft_failed is a
// system problem fixable only by retrying. Sharing one visual/verbal
// treatment between them would tell staff to do the wrong thing.

// Compact list-row indicator.
export function FormalProposalBlockedBadge({ blocked }: { blocked: FormalProposalBlocked }) {
  if (blocked.reason === 'draft_failed') {
    return (
      <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700 gap-1">
        <RefreshCw className="h-3 w-3" /> Draft failed
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 gap-1">
      <AlertTriangle className="h-3 w-3" /> Missing info
    </Badge>
  )
}

// Full detail-page banner.
export function FormalProposalBlockedBanner({
  blocked,
  onFixEmail,
}: {
  blocked: FormalProposalBlocked
  onFixEmail?: () => void
}) {
  if (blocked.reason === 'draft_failed') {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4">
        <div className="flex items-start gap-2">
          <RefreshCw className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">The formal proposal draft failed</p>
            <p className="text-sm text-red-700 mt-1">
              This record is complete — this needs a retry, not more data.
            </p>
            {blocked.draft_error && <p className="text-xs text-red-600 mt-2 font-mono">{blocked.draft_error}</p>}
            {blocked.draft_failed_at && (
              <p className="text-xs text-red-500 mt-1">Failed {formatDatetime(blocked.draft_failed_at)}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const hasEmailMissing = blocked.missing_fields.includes('customer_email')

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800">The formal proposal is on hold — information is missing</p>
          <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
            {blocked.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          {hasEmailMissing && onFixEmail && (
            <button
              type="button"
              onClick={onFixEmail}
              className="mt-2 text-sm font-medium text-amber-800 underline hover:no-underline"
            >
              Add the missing email and retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
