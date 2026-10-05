import { Check } from 'lucide-react'
import { toPortalSteps } from '@/lib/onboarding/progress'
import type { ProgressResponse } from '@/lib/associate/onboarding-types'
import type { Messages } from '@/lib/i18n/types'

type ProgressCopy = Messages['associates']['portal']['shared']['progress']

// Compact tracker (7 sales steps, plus execution steps once they apply) for the portal. Renders from the exact same
// GET /{id}/progress response the staff full view uses (via
// lib/onboarding/progress.ts) — never a separately-maintained idea of stage
// order.
export default function OnboardingProgressPortal({ progress, copy }: { progress: ProgressResponse; copy: ProgressCopy }) {
  const steps = toPortalSteps(progress)

  return (
    <div>
      <p className="font-utility text-xs font-semibold uppercase tracking-wide text-[#111827]/45">{copy.title}</p>
      <ol className="mt-3 flex flex-wrap gap-2">
        {steps.map((step) => {
          const key = step.key
          const label = copy.steps[key]
          return (
            <li
              key={key}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-utility ${
                step.recorded
                  ? 'bg-[#0e2a63] text-white'
                  : step.isCurrent
                    ? 'bg-[#2f5daa]/10 text-[#0e2a63] font-semibold ring-1 ring-[#2f5daa]/30'
                    : 'bg-[#f7f9fc] text-[#111827]/40'
              }`}
            >
              {step.recorded && <Check className="h-3 w-3" />}
              {label}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
