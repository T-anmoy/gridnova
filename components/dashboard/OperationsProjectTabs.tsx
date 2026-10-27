'use client'

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import ExecutionDetailPanel from '@/components/dashboard/ExecutionDetailPanel'
import HandoverPanel from '@/components/dashboard/handover/HandoverPanel'
import ProjectServiceRequests from '@/components/dashboard/handover/ProjectServiceRequests'
import WarrantyPanel from '@/components/dashboard/handover/WarrantyPanel'
import { useUrlParams } from '@/lib/dashboard/use-url-params'

const TABS = [
  { key: 'installation', label: 'Installation' },
  { key: 'handover', label: 'Handover' },
  { key: 'warranty', label: 'Warranty' },
  { key: 'service', label: 'Service requests' },
] as const
type TabKey = (typeof TABS)[number]['key']

function Tabs({ onboardingId }: { onboardingId: number }) {
  const url = useUrlParams()
  const raw = url.get('tab')
  const tab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : 'installation'
  return (
    <div className="space-y-4">
      <nav aria-label="Project sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => url.set({ tab: t.key === 'installation' ? undefined : t.key })}
            className={`min-h-[44px] shrink-0 rounded-lg px-4 text-sm font-medium font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] ${
              tab === t.key ? 'bg-[#0e2a63] text-white' : 'border border-[#e4e8ee] bg-white text-[#0e2a63] hover:bg-[#f7f9fc]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'installation' && <ExecutionDetailPanel onboardingId={onboardingId} />}
      {tab === 'handover' && <HandoverPanel onboardingId={onboardingId} />}
      {tab === 'warranty' && <WarrantyPanel onboardingId={onboardingId} />}
      {tab === 'service' && <ProjectServiceRequests onboardingId={onboardingId} />}
    </div>
  )
}

/** The project screen of the Operations workspace: installation, handover, warranty and service requests. */
export default function OperationsProjectTabs({ onboardingId }: { onboardingId: number }) {
  // The active tab lives in the URL (?tab=handover), so useSearchParams needs a Suspense boundary.
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <Tabs onboardingId={onboardingId} />
    </Suspense>
  )
}
