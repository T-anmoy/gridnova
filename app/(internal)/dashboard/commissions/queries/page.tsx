'use client'

import { Suspense } from 'react'
import CommissionQueries from '@/components/dashboard/commissions/CommissionQueries'
import { Skeleton } from '@/components/ui/skeleton'

export default function CommissionQueriesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-8 w-48" />}>
      <CommissionQueries />
    </Suspense>
  )
}
