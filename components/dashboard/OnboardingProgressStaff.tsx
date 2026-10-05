import { Check, Circle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDatetime } from '@/lib/dashboard/utils'
import { getAging, orderedStages } from '@/lib/onboarding/progress'
import type { ProgressResponse } from '@/lib/associate/onboarding-types'

const MODE_LABEL = { associate: 'Associate executes', grid_nova: 'Grid Nova executes' } as const

// Full stage-by-stage timeline for staff. Reads the exact same
// GET /{id}/progress response as the portal's simplified view (see
// components/associate/OnboardingProgressPortal.tsx + lib/onboarding/progress.ts)
// — this is the detail version of the same underlying data, not a second
// source of truth for what stage a project is at. Stage order, labels and
// applicability are the backend's: every stage it sent is shown, in its order.
export default function OnboardingProgressStaff({ progress }: { progress: ProgressResponse }) {
  const stages = orderedStages(progress)
  const aging = getAging(progress)
  const notApplicable = progress.not_applicable ?? []

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Progress</CardTitle>
          {progress.execution_mode && (
            <Badge variant="secondary" data-testid="execution-mode">
              {MODE_LABEL[progress.execution_mode] ?? progress.execution_mode}
            </Badge>
          )}
          {aging?.is_stuck && (
            <Badge variant="red" className="gap-1" data-testid="stuck-marker">
              <AlertTriangle className="h-3 w-3" /> Stuck
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {stages.map((stage) => {
            const isCurrent = stage.stage === progress.current_stage
            return (
              <li key={stage.stage} className="flex gap-3">
                <div className="mt-0.5 shrink-0">
                  {stage.recorded ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className={`h-4 w-4 ${isCurrent ? 'text-amber-500' : 'text-gray-300'}`} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${stage.recorded ? 'text-gray-900' : isCurrent ? 'text-amber-700' : 'text-gray-400'}`}>
                    {stage.label}
                    {isCurrent && !stage.recorded && ' (current)'}
                  </p>
                  {isCurrent && !stage.recorded && aging && (
                    <p className={`text-xs mt-0.5 ${aging.is_stuck ? 'font-semibold text-red-600' : 'text-gray-500'}`} data-testid="stage-aging">
                      {aging.days_in_stage} {aging.days_in_stage === 1 ? 'day' : 'days'} in this stage
                      {aging.is_stuck && aging.stuck_threshold_days != null && ` — stuck (usually ${aging.stuck_threshold_days} days)`}
                    </p>
                  )}
                  {stage.recorded && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {stage.recorded_at && formatDatetime(stage.recorded_at)}
                      {stage.recorded_by && ` · by ${stage.recorded_by}`}
                      {stage.evidence?.via && ` · ${stage.evidence.via}`}
                    </p>
                  )}
                  {stage.note && <p className="text-xs text-gray-500 mt-0.5 italic">{stage.note}</p>}
                </div>
              </li>
            )
          })}
        </ol>
        {notApplicable.length > 0 && (
          <p className="mt-4 text-xs text-gray-400" data-testid="not-applicable">
            Not applicable to this project: {notApplicable.map((s) => s.label).join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
