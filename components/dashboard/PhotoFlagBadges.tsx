import { Badge } from '@/components/ui/badge'
import type { CaptureMethod, PhotoFlag } from '@/lib/associate/onboarding-types'

const FLAG_LABEL: Record<PhotoFlag, string> = {
  gallery_upload: 'Gallery upload',
  no_metadata: 'No metadata',
  old_photo: 'Old photo',
  duplicate_photo: 'Duplicate photo',
}

const FLAG_HINT: Record<PhotoFlag, string> = {
  gallery_upload: 'Chosen from the phone, not taken in the app — consider confirming with the customer.',
  no_metadata: 'The file has no capture metadata.',
  old_photo: 'The file’s capture time is more than 30 days old.',
  duplicate_photo: 'The same image is already on another project.',
}

/**
 * Provenance + flags for one photo. STAFF ONLY: associates see a plain
 * provenance chip in their own portal, never these fraud-style flags — do not
 * render this component under /associates or /preferred.
 */
export default function PhotoFlagBadges({
  captureMethod,
  locationVerified,
  flags,
}: {
  captureMethod?: CaptureMethod | null
  locationVerified?: boolean
  flags?: PhotoFlag[]
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-testid="photo-flags">
      {captureMethod && (
        <Badge variant="secondary">
          {captureMethod === 'camera' ? 'Camera' : 'Gallery'}
          {locationVerified ? ' · location verified' : captureMethod === 'camera' ? '' : ' · location not verified'}
        </Badge>
      )}
      {(flags ?? []).map((f) => (
        <Badge key={f} variant="amber" title={FLAG_HINT[f] ?? f}>
          {FLAG_LABEL[f] ?? f}
        </Badge>
      ))}
    </span>
  )
}
