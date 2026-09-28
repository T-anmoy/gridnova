'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useAttributionFlags, useResolveAttributionFlag } from '@/lib/dashboard/onboarding-api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatDatetime } from '@/lib/dashboard/utils'
import type { AttributionFlag, AttributionFlagOnboardingRef, AttributionFlagStatus } from '@/lib/dashboard/onboarding-types'

function OnboardingSummary({ onboarding: onb, isLoser }: { onboarding: AttributionFlagOnboardingRef; isLoser: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${isLoser ? 'border-gray-200 bg-gray-50 opacity-70' : 'border-gray-200'}`}>
      <p className="font-medium text-gray-900">{onb.customer.name}</p>
      <p className="text-xs text-gray-500 mt-0.5">{onb.customer.mobile}</p>
      <p className="text-xs text-gray-500 mt-1">
        Owner: {onb.owner.full_name} ({onb.owner.associate_type})
      </p>
      <p className="text-xs text-gray-400 mt-1">Created {formatDatetime(onb.created_at)}</p>
      <Badge variant="gray" className="mt-2">
        {onb.status}
      </Badge>
      {isLoser && <p className="mt-2 text-xs text-gray-500 italic">Closed, not deleted, if this side loses.</p>}
    </div>
  )
}

function FlagCard({ flag }: { flag: AttributionFlag }) {
  const [note, setNote] = useState('')
  const resolveMutation = useResolveAttributionFlag()

  async function handleResolve(resolution: 'keep_existing' | 'award_new') {
    try {
      await resolveMutation.mutateAsync({ flagId: flag.flag_id, input: { resolution, note } })
      toast.success('Attribution flag resolved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail || err.message : 'Failed to resolve flag')
    }
  }

  const [first, second] = flag.onboardings

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Flag #{flag.flag_id}</span>
          {flag.status === 'resolved' && (
            <Badge variant="green">
              Resolved — {flag.resolution === 'keep_existing' ? 'kept existing' : 'awarded to new'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OnboardingSummary onboarding={first} isLoser={flag.resolution === 'award_new'} />
          <OnboardingSummary onboarding={second} isLoser={flag.resolution === 'keep_existing'} />
        </div>

        {flag.status === 'open' && (
          <div className="mt-4 space-y-3">
            <Textarea placeholder="Resolution note" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" disabled={resolveMutation.isPending} onClick={() => void handleResolve('keep_existing')}>
                Keep existing
              </Button>
              <Button size="sm" variant="outline" disabled={resolveMutation.isPending} onClick={() => void handleResolve('award_new')}>
                Award to new
              </Button>
            </div>
          </div>
        )}
        {flag.status === 'resolved' && flag.resolution_note && (
          <p className="mt-3 text-sm text-gray-600 italic">&quot;{flag.resolution_note}&quot;</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function AttributionFlagsPage() {
  const [status, setStatus] = useState<AttributionFlagStatus>('open')
  const { data: flags, isLoading, error, refetch } = useAttributionFlags({ status })

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#091c3c]">Attribution Flags</h1>
        <div className="flex gap-2">
          <Button variant={status === 'open' ? 'default' : 'outline'} size="sm" onClick={() => setStatus('open')}>
            Open
          </Button>
          <Button variant={status === 'resolved' ? 'default' : 'outline'} size="sm" onClick={() => setStatus('resolved')}>
            Resolved
          </Button>
        </div>
      </div>

      {error && <DashboardError error={error} onRetry={() => void refetch()} />}
      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {flags && flags.length === 0 && <p className="text-sm text-gray-500">No {status} attribution flags.</p>}

      <div className="space-y-4">
        {flags?.map((f) => (
          <FlagCard key={f.flag_id} flag={f} />
        ))}
      </div>
    </div>
  )
}
