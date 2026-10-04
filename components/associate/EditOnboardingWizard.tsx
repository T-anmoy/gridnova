'use client'

import { Loader2 } from 'lucide-react'
import { useOnboarding } from '@/lib/associate/onboarding-api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import OnboardingWizard from '@/components/associate/OnboardingWizard'
import type { Messages } from '@/lib/i18n/types'

export default function EditOnboardingWizard({
  onboardingId,
  copy,
  territory,
  portalBase,
}: {
  onboardingId: number
  copy: Messages['associates']['portal']['wizard']
  territory: Messages['associates']['territory']
  portalBase: '/associates/portal' | '/preferred/portal'
}) {
  const { data: onboarding, isLoading, error, refetch } = useOnboarding(onboardingId)

  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (isLoading || !onboarding) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#111827]/30" />
      </div>
    )
  }

  return <OnboardingWizard copy={copy} territory={territory} portalBase={portalBase} existing={onboarding} />
}
