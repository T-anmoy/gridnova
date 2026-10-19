'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import ServiceRequestLine from '@/components/dashboard/handover/ServiceRequestRow'
import ServiceRequestForm from '@/components/handover/ServiceRequestForm'
import { ENGLISH_SERVICE_FORM_COPY } from '@/lib/handover/form-copy'
import { handoverErrorMessage } from '@/lib/handover/labels'
import { DEFAULT_MAX_PHOTOS } from '@/lib/handover/service-request-form'
import { useProjectServiceRequests, useRaiseServiceRequest } from '@/lib/handover/staff-api-client'

/** Service requests of one project, with the form to raise one on the customer’s behalf. */
export default function ProjectServiceRequests({ onboardingId }: { onboardingId: number }) {
  const { data, isLoading, error, refetch } = useProjectServiceRequests(onboardingId)
  const raise = useRaiseServiceRequest(onboardingId)

  if (isLoading) return <Skeleton className="h-32 w-full" />
  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />

  return (
    <div className="space-y-4" data-testid="project-service-requests">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Service requests</CardTitle></CardHeader>
        <CardContent>
          {data && data.items.length > 0 ? (
            <ul className="divide-y divide-[#e4e8ee]" aria-label="Service requests for this project">
              {data.items.map((r) => <ServiceRequestLine key={r.request_id} request={r} />)}
            </ul>
          ) : (
            <p className="text-sm text-gray-500" data-testid="no-requests">No service requests for this project.</p>
          )}
        </CardContent>
      </Card>
      {data?.can_handle ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Raise a service request</CardTitle></CardHeader>
          <CardContent>
            <ServiceRequestForm copy={ENGLISH_SERVICE_FORM_COPY} maxPhotos={DEFAULT_MAX_PHOTOS} onSubmit={(input) => raise.mutateAsync(input)} describeError={handoverErrorMessage} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-gray-500">Only Operations, Engineers and Admin raise service requests.</p>
      )}
    </div>
  )
}
