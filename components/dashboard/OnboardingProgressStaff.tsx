import { Check, Circle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDatetime } from '@/lib/dashboard/utils'
import { FULL_STAGE_ORDER } from '@/lib/onboarding/progress'
import type { ProgressResponse } from '@/lib/associate/onboarding-types'

// Full stage-by-stage timeline for staff. Reads the exact same
// GET /{id}/progress response as the portal's simplified view (see
// components/associate/OnboardingProgressPortal.tsx + lib/onboarding/progress.ts)
// — this is the detail version of the same underlying data, not a second
// source of truth for what stage a project is at.
export default function OnboardingProgressStaff({ progress }: { progress: ProgressResponse }) {
  const byStage = new Map(progress.stages.map((s) => [s.stage, s]))
  // portal_agreement_approved only applies to PM Surya Ghar projects — skip
  // it entirely when the backend didn't send that stage at all.
  const order = FULL_STAGE_ORDER.filter((s) => byStage.has(s))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {order.map((key) => {
            const stage = byStage.get(key)!
            const isCurrent = key === progress.current_stage
            return (
              <li key={key} className="flex gap-3">
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
      </CardContent>
    </Card>
  )
}
