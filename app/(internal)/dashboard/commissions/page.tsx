'use client'

import { Suspense } from 'react'
import CommissionEntries from '@/components/dashboard/commissions/CommissionEntries'
import { Skeleton } from '@/components/ui/skeleton'

// useSearchParams (filters live in the URL) needs a Suspense boundary.
export default function CommissionsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-8 w-48" />}>
      <CommissionEntries />
    </Suspense>
  )
}
