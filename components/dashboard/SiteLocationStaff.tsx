'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ExternalLink, Loader2, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useCorrectSiteLocation } from '@/lib/dashboard/onboarding-api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { buildLocationInput, describeSiteLocationError } from '@/lib/associate/site-location'
import type { Role } from '@/lib/dashboard/types'
import type { SiteLocation, SiteLocationFlag } from '@/lib/associate/onboarding-types'
import { STAFF_SITE_LOCATION_COPY } from '@/lib/dashboard/staff-copy'

// The dashboard is English-only: these sentences are for Grid Nova staff.
const SOURCE: Record<string, string> = {
  device_gps: 'Captured on the associate’s phone',
  photo_gps: 'Taken from a site photo',
  google_maps_link: 'Google Maps link',
  pasted_coordinates: 'Pasted coordinates',
  staff_entered: 'Entered by staff',
  unknown_legacy: 'Saved before location tracking (unknown source)',
}

const FLAG: Record<SiteLocationFlag, string> = {
  low_accuracy: 'Low accuracy GPS reading',
  accuracy_unknown: 'Accuracy not known',
  approximate_location: 'Approximate — the link only gave a map centre, not an exact pin',
  unverified_source: 'Not verified — came from a link or typed coordinates',
  far_from_photos: 'Far from where the site photos were taken',
  location_missing: 'No location on file',
}

// Staff roles the contract allows to correct a location (others get a 403).
export const CAN_CORRECT_LOCATION: Role[] = ['admin', 'sales']

/** Reasons the location should be checked with the customer, in plain words. */
export function checkReasons(l: SiteLocation | undefined): string[] {
  if (!l || !l.present) return ['No site location is on file.']
  const reasons: string[] = []
  for (const f of l.flags ?? []) if (f !== 'location_missing' && FLAG[f]) reasons.push(FLAG[f])
  if (!l.verified && !(l.flags ?? []).includes('unverified_source')) reasons.push('Location is not verified.')
  if (!l.confirmed) reasons.push('The associate has not confirmed the location.')
  return reasons
}

function staffError(err: unknown): string {
  if (err instanceof ApiError) {
    const code = err.structuredDetail?.code
    if (code === 'reason_required') return 'Enter a reason of at least 5 characters.'
    if (code === 'not_editable') return 'This customer is closed, so the location can no longer be changed.'
    if (err.status === 403 && err.detail) return err.detail
    if (err.status === 422 && Array.isArray(err.structuredDetail)) return 'Check the link or coordinates and the reason, then try again.'
    return describeSiteLocationError(err, STAFF_SITE_LOCATION_COPY.errors).text
  }
  return STAFF_SITE_LOCATION_COPY.errors.generic
}

function CorrectLocationDialog({ onboardingId, open, onOpenChange }: { onboardingId: number; open: boolean; onOpenChange: (o: boolean) => void }) {
  const mutation = useCorrectSiteLocation()
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const reasonOk = reason.trim().length >= 5
  const input = buildLocationInput(value)

  async function submit() {
    if (!input || input.source === 'device_gps' || input.source === 'photo_gps') return
    setError(null)
    try {
      await mutation.mutateAsync({
        id: onboardingId,
        input: {
          source: input.source,
          ...(input.source === 'google_maps_link' ? { link: input.link } : { text: input.text }),
          reason: reason.trim(),
        },
      })
      toast.success('Location corrected. The change is recorded in the audit log.')
      setValue('')
      setReason('')
      onOpenChange(false)
    } catch (err) {
      setError(staffError(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct site location</DialogTitle>
          <DialogDescription>
            Paste a Google Maps link or coordinates. The new location is saved as entered by staff and confirmed by you. The change, with
            the old and new location and your reason, is audited.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="correct-location-value" className="text-xs">Google Maps link or coordinates</Label>
            <Textarea id="correct-location-value" rows={2} value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://maps.app.goo.gl/… or 22.5726, 88.3639" autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="correct-location-reason" className="text-xs">Reason (required, at least 5 characters)</Label>
            <Textarea id="correct-location-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!input || !reasonOk || mutation.isPending} onClick={() => void submit()}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save correction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The site-location card on the staff onboarding detail page. */
export function SiteLocationCard({ onboardingId, location, role }: { onboardingId: number; location: SiteLocation | undefined; role: Role | undefined }) {
  const [open, setOpen] = useState(false)
  if (!location) return null
  const canCorrect = !!role && CAN_CORRECT_LOCATION.includes(role)
  const flags = (location.flags ?? []).filter((f) => f !== 'location_missing')
  return (
    <Card data-testid="staff-site-location">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Site location</span>
          {location.present && (
            <span className="flex gap-1.5">
              <Badge variant={location.verified ? 'green' : 'amber'}>{location.verified ? 'Verified GPS' : 'Not verified'}</Badge>
              <Badge variant={location.confirmed ? 'green' : 'gray'}>{location.confirmed ? 'Confirmed by associate' : 'Not confirmed'}</Badge>
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!location.present ? (
          <p className="text-sm text-amber-700">No site location on file.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-gray-400">Coordinates</dt>
              <dd data-testid="staff-location-coords">{location.latitude}, {location.longitude}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Accuracy</dt>
              <dd>{location.accuracy_m != null ? `about ${Math.round(location.accuracy_m)} m` : 'not known'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Source</dt>
              <dd>{location.source ? SOURCE[location.source] ?? location.source : '—'}{location.precision === 'viewport_center' ? ' (map centre)' : ''}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Distance from site photos</dt>
              <dd>{location.photo_distance_m != null ? `about ${Math.round(location.photo_distance_m)} m` : 'no photo location to compare'}</dd>
            </div>
          </dl>
        )}
        {flags.length > 0 && (
          <ul className="space-y-1" aria-label="Location flags">
            {flags.map((f) => (
              <li key={f} className="flex items-start gap-1.5 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {FLAG[f] ?? f}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {location.maps_url && (
            <a href={location.maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 underline">
              <ExternalLink className="h-3.5 w-3.5" /> Open in Google Maps
            </a>
          )}
          {canCorrect && (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              Correct location
            </Button>
          )}
        </div>
        {canCorrect && <CorrectLocationDialog onboardingId={onboardingId} open={open} onOpenChange={setOpen} />}
      </CardContent>
    </Card>
  )
}

/** Shown in the verification-call panel while the call is pending and the location needs checking. */
export function ConfirmLocationPrompt({ location }: { location: SiteLocation | undefined }) {
  const needs = !location || !location.present || location.check_with_customer || !location.verified
  if (!needs) return null
  const reasons = checkReasons(location)
  return (
    <div data-testid="confirm-location-prompt" className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
        <AlertTriangle className="h-4 w-4" /> Confirm the site location with the customer
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-sm text-amber-900">
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  )
}
