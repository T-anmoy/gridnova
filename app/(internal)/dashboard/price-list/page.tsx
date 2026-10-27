'use client'

import { Skeleton } from '@/components/ui/skeleton'
import NoAccess from '@/components/dashboard/NoAccess'
import PriceListView from '@/components/dashboard/PriceListView'
import { usePackageCatalogue } from '@/lib/pricing/usePackageCatalogue'
import { usePermissions } from '@/lib/access/use-permissions'

export default function PriceListPage() {
  const { can, isLoaded } = usePermissions()
  const { catalogue, status } = usePackageCatalogue()
  if (!isLoaded) return <div className="p-6 md:p-8"><Skeleton className="h-40 w-full" /></div>
  // Everyone who quotes or adjusts customer prices.
  if (!can('leads.view_commercial')) return <NoAccess what="The price list" />
  return (
    <div className="max-w-5xl space-y-4 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-[#091c3c]">Price list</h1>
        <p className="mt-1 text-sm text-gray-500">Grid Nova’s published prices, read-only, exactly as the backend returns them.</p>
      </div>
      {status === 'loading' && <Skeleton className="h-64 w-full" />}
      {status === 'error' && <p role="alert" className="text-sm text-red-600">The price list couldn’t be loaded. Try again shortly.</p>}
      {catalogue && <PriceListView catalogue={catalogue} />}
    </div>
  )
}
