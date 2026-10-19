'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, CheckCircle2, CloudOff, Crosshair, ExternalLink, Link2, Loader2, MapPin } from 'lucide-react'
import { useMessages } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/types'
import MapsHelpSheet from '@/components/associate/MapsHelpSheet'
import PhotosFirstCard from '@/components/associate/PhotosFirstCard'
import { useConfirmSiteLocation, useSetSiteLocation } from '@/lib/associate/onboarding-api-client'
import { GpsError, startGpsSession, type GpsReading, type GpsSession } from '@/lib/associate/gps-session'
import {
  accuracyBand,
  buildLocationInput,
  describeSiteLocationError,
  isOfflineError,
  roundedCoordinates,
  type AccuracyBand,
  type PhotoLocationCandidate,
} from '@/lib/associate/site-location'
import type { Onboarding, SetSiteLocationInput, SiteLocation, SiteLocationOptions } from '@/lib/associate/onboarding-types'

const PRIMARY =
  'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#0e2a63] px-4 py-3 text-center font-utility text-sm font-semibold text-white disabled:opacity-50'
const SECONDARY =
  'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-[#e4e8ee] bg-white px-4 py-3 text-center font-utility text-sm font-semibold text-[#0e2a63] transition-colors hover:border-[#2f5daa]/40 disabled:opacity-50'
const LINK_BUTTON = 'inline-flex min-h-[44px] items-center font-utility text-sm font-semibold text-[#0e2a63] underline'

type StateKey = 'notSet' | 'needsConfirm' | 'confirmedVerified' | 'confirmedUnverified'

export function locationStateKey(l: SiteLocation | undefined): StateKey {
  if (!l?.present) return 'notSet'
  if (!l.confirmed) return 'needsConfirm'
  return l.verified ? 'confirmedVerified' : 'confirmedUnverified'
}

const STATE_STYLE: Record<StateKey, string> = {
  notSet: 'bg-[#111827]/10 text-[#111827]/70',
  needsConfirm: 'bg-[#f7a800]/20 text-[#7a5200]',
  confirmedVerified: 'bg-green-100 text-green-800',
  confirmedUnverified: 'bg-[#2f5daa]/10 text-[#0e2a63]',
}

export function LocationStateBadge({ location }: { location: SiteLocation | undefined }) {
  const m = useMessages('siteLocation')
  const key = locationStateKey(location)
  return (
    <span data-testid="location-state" data-state={key} className={`inline-flex items-center rounded-full px-3 py-1 font-utility text-xs font-semibold ${STATE_STYLE[key]}`}>
      {m.state[key]}
    </span>
  )
}

// Adopts the whole-onboarding response of a set/confirm call into the wizard.
type Adopt = (o: Onboarding) => void

function useLocationErrors() {
  const m = useMessages('siteLocation')
  return useCallback((err: unknown) => describeSiteLocationError(err, m.errors), [m.errors])
}

/**
 * The one-tap "use my photo's location" prompt, shown in the photos step once
 * a camera photo with a location has uploaded and no location is set yet.
 */
export function PhotoLocationPrompt({
  onboardingId,
  location,
  candidate,
  onAdopt,
  onBackToHouse,
}: {
  onboardingId: number
  location: SiteLocation | undefined
  candidate: PhotoLocationCandidate | null
  onAdopt: Adopt
  onBackToHouse: () => void
}) {
  const m = useMessages('siteLocation')
  const describe = useLocationErrors()
  const setMutation = useSetSiteLocation()
  const [error, setError] = useState<string | null>(null)

  async function applyPhoto() {
    if (!candidate) return
    setError(null)
    try {
      onAdopt(await setMutation.mutateAsync({ id: onboardingId, input: { source: 'photo_gps', photo_slot: candidate.slot } }))
    } catch (err) {
      setError(describe(err).text)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-sm font-semibold text-[#0e2a63]">{m.title}</p>
        <LocationStateBadge location={location} />
      </div>
      {!location?.present && candidate && (
        <div data-testid="photo-location-prompt">
          <p className="font-utility text-sm text-[#111827]/80">{m.photoPrompt.question}</p>
          <button type="button" onClick={() => void applyPhoto()} disabled={setMutation.isPending} className={`${PRIMARY} mt-2`}>
            {setMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : m.photoPrompt.yes}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-1.5 font-utility text-xs text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
      {!location?.confirmed && (
        <button type="button" onClick={onBackToHouse} className={LINK_BUTTON}>
          {m.actions.backToHouse}
        </button>
      )}
    </div>
  )
}

interface GpsNote {
  kind: 'saved' | 'poor' | 'rejected'
  meters: number
}

export default function SiteLocationStep({
  onboardingId,
  location,
  options,
  photoCandidate,
  onAdopt,
  onTakePhoto,
  photoSlot,
}: {
  onboardingId: number
  location: SiteLocation | undefined
  options: SiteLocationOptions
  photoCandidate: PhotoLocationCandidate | null
  onAdopt: Adopt
  // Used only when no photo slot is embedded: jumps to the photos step.
  onTakePhoto?: () => void
  // The first camera photo slot, embedded so photo → use its location → confirm
  // all happen on this screen.
  photoSlot?: React.ReactNode
}) {
  const m = useMessages('siteLocation')
  const describe = useLocationErrors()
  const setMutation = useSetSiteLocation()
  const confirmMutation = useConfirmSiteLocation()

  const [changing, setChanging] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [finding, setFinding] = useState(false)
  const [live, setLive] = useState<GpsReading | null>(null)
  const [gpsError, setGpsError] = useState<'denied' | 'timeout' | 'unsupported' | null>(null)
  const [gpsNote, setGpsNote] = useState<GpsNote | null>(null)
  const [error, setError] = useState<{ text: string; code: string; guidance: string[] } | null>(null)
  // A reading taken while offline: kept here and sent when the connection returns.
  const [pending, setPending] = useState<{ reading: GpsReading; band: AccuracyBand } | null>(null)
  const sessionRef = useRef<GpsSession | null>(null)

  // One GPS session at a time, and never one left running after the step goes away.
  useEffect(() => () => sessionRef.current?.cancel(), [])

  const present = !!location?.present
  const showActions = !present || changing
  const busy = setMutation.isPending || confirmMutation.isPending || finding

  function fail(err: unknown) {
    const d = describe(err)
    const raw = err && typeof err === 'object' && 'structuredDetail' in err ? (err as { structuredDetail?: Record<string, unknown> }).structuredDetail : undefined
    const keys = Array.isArray(raw?.guidance_keys) ? (raw.guidance_keys as unknown[]) : []
    const guidance = keys
      .map((k) => String(k).replace('site_location.guidance.', ''))
      .filter((k): k is keyof typeof m.guidance => k in m.guidance)
    setError({ ...d, guidance })
  }

  async function send(input: SetSiteLocationInput): Promise<boolean> {
    setError(null)
    try {
      onAdopt(await setMutation.mutateAsync({ id: onboardingId, input }))
      setChanging(false)
      setPasteOpen(false)
      setPasteText('')
      return true
    } catch (err) {
      fail(err)
      return false
    }
  }

  async function sendReading(reading: GpsReading, band: AccuracyBand) {
    setError(null)
    try {
      onAdopt(
        await setMutation.mutateAsync({
          id: onboardingId,
          input: { source: 'device_gps', latitude: reading.latitude, longitude: reading.longitude, accuracy_m: reading.accuracy_m, captured_at: reading.captured_at },
        })
      )
      setPending(null)
      setChanging(false)
      setGpsNote({ kind: band === 'poor' ? 'poor' : 'saved', meters: Math.round(reading.accuracy_m) })
    } catch (err) {
      if (isOfflineError(err)) setPending({ reading, band })
      else {
        setPending(null)
        fail(err)
      }
    }
  }

  const sendReadingRef = useRef(sendReading)
  useEffect(() => {
    sendReadingRef.current = sendReading
  })
  useEffect(() => {
    if (!pending) return
    const p = pending
    function onOnline() {
      void sendReadingRef.current(p.reading, p.band)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [pending])

  async function captureHere() {
    setError(null)
    setGpsError(null)
    setGpsNote(null)
    setPending(null)
    setLive(null)
    setFinding(true)
    const session = startGpsSession({ sampleSeconds: options.sample_seconds, goodAccuracyM: options.accuracy_good_m, onReading: setLive })
    sessionRef.current = session
    let reading: GpsReading
    try {
      reading = await session.promise
    } catch (err) {
      setFinding(false)
      setGpsError(err instanceof GpsError ? err.code : 'timeout')
      return
    }
    setFinding(false)
    const band = accuracyBand(reading.accuracy_m, options)
    if (band === 'rejected') {
      // Too rough to send: the server would refuse it, so don't ask.
      setGpsNote({ kind: 'rejected', meters: Math.round(reading.accuracy_m) })
      return
    }
    await sendReading(reading, band)
  }

  async function submitPaste() {
    const input = buildLocationInput(pasteText)
    if (!input) {
      setError({ text: m.errors.invalid_link_empty, code: 'invalid_link', guidance: [] })
      return
    }
    await send(input)
  }

  async function confirm() {
    setError(null)
    try {
      onAdopt(await confirmMutation.mutateAsync(onboardingId))
    } catch (err) {
      fail(err)
    }
  }

  const accuracyLine =
    location?.accuracy_m != null ? fmt(m.details.accuracy, { meters: Math.round(location.accuracy_m) }) : m.details.accuracyUnknown
  const flags = (location?.flags ?? []).filter((f) => f !== 'location_missing' && f in m.flags)

  const usePhotoAvailable = !!photoCandidate

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-base font-semibold text-[#0e2a63]">{m.title}</h2>
        <p className="mt-1 font-utility text-sm text-[#111827]/60">{m.intro}</p>
      </div>

      <PhotosFirstCard />

      {photoSlot && (
        <div className="rounded-xl border border-[#e4e8ee] p-4" data-testid="house-photo-slot">
          {photoSlot}
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-[#e4e8ee] p-4" data-testid="location-card">
        <LocationStateBadge location={location} />

        {present && location && (
          <div className="space-y-2">
            {location.latitude != null && location.longitude != null && (
              <p className="flex items-center gap-1.5 font-utility text-sm text-[#111827]/85">
                <MapPin className="h-4 w-4 shrink-0 text-[#0e2a63]" aria-hidden="true" />
                <span className="sr-only">{m.details.pin}: </span>
                <span data-testid="location-coords">{roundedCoordinates(location.latitude, location.longitude)}</span>
              </p>
            )}
            <p className="font-utility text-xs text-[#111827]/60">
              {accuracyLine}
              {location.source && <> · {m.source[location.source] ?? ''}</>}
            </p>
            {location.photo_distance_m != null && (
              <p className="font-utility text-xs text-[#111827]/60">{fmt(m.details.photoDistance, { meters: Math.round(location.photo_distance_m) })}</p>
            )}
            {location.maps_url && (
              <a href={location.maps_url} target="_blank" rel="noopener noreferrer" className={LINK_BUTTON}>
                <ExternalLink className="mr-1.5 h-4 w-4" /> {m.actions.openMaps}
              </a>
            )}
            {flags.length > 0 && (
              <ul className="space-y-1.5" aria-label={m.title}>
                {flags.map((f) => (
                  <li key={f} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 font-utility text-xs text-amber-800">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> {m.flags[f]}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {present && !location?.confirmed && (
          <button type="button" onClick={() => void confirm()} disabled={busy} className={PRIMARY}>
            {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {confirmMutation.isPending ? m.actions.confirming : m.actions.confirm}
          </button>
        )}
        {present && <p className="font-utility text-xs text-[#111827]/65">{m.details.resetNote}</p>}
        {present && !changing && (
          <button type="button" onClick={() => setChanging(true)} className={LINK_BUTTON}>
            {m.actions.change}
          </button>
        )}
      </div>

      {showActions && (
        <div className="space-y-2.5">
          {usePhotoAvailable && (
            <div>
              <button
                type="button"
                data-testid="use-photo-location"
                onClick={() => void send({ source: 'photo_gps', photo_slot: photoCandidate.slot })}
                disabled={busy}
                className={PRIMARY}
              >
                <Camera className="h-4 w-4" /> {m.actions.usePhoto}
              </button>
              {photoCandidate.accuracy_m !== null && (
                <p className="mt-1 font-utility text-xs text-[#111827]/65">{fmt(m.actions.usePhotoBest, { meters: Math.round(photoCandidate.accuracy_m) })}</p>
              )}
            </div>
          )}
          {!photoSlot && onTakePhoto && (
            <button type="button" onClick={onTakePhoto} disabled={busy} className={usePhotoAvailable ? SECONDARY : PRIMARY}>
              <Camera className="h-4 w-4" /> {m.actions.takePhoto}
            </button>
          )}
          <button type="button" onClick={() => void captureHere()} disabled={busy} className={SECONDARY}>
            <Crosshair className="h-4 w-4" /> {m.actions.captureHere}
          </button>
          <button type="button" onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen} className={SECONDARY}>
            <Link2 className="h-4 w-4" /> {m.actions.haveLink}
          </button>

          {pasteOpen && (
            <div className="space-y-2 rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-3">
              <label htmlFor="site-location-paste" className="block font-utility text-xs font-semibold uppercase tracking-[0.08em] text-[#111827]/65">
                {m.paste.label}
              </label>
              <textarea
                id="site-location-paste"
                rows={2}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={m.paste.placeholder}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full rounded-xl border border-[#e4e8ee] bg-white px-4 py-3 font-utility text-sm text-[#111827] outline-none focus-visible:border-[#2f5daa] focus-visible:ring-2 focus-visible:ring-[#2f5daa]/25"
              />
              <p className="font-utility text-xs text-[#111827]/65">{m.paste.hint}</p>
              <button type="button" onClick={() => void submitPaste()} disabled={busy || !pasteText.trim()} className={PRIMARY}>
                {setMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : m.actions.save}
              </button>
              <button type="button" onClick={() => setHelpOpen((o) => !o)} aria-expanded={helpOpen} className={LINK_BUTTON}>
                {m.actions.howTo}
              </button>
              {helpOpen && <MapsHelpSheet onClose={() => setHelpOpen(false)} />}
            </div>
          )}

          {changing && present && (
            <button type="button" onClick={() => setChanging(false)} className={LINK_BUTTON}>
              {m.actions.cancel}
            </button>
          )}
        </div>
      )}

      {finding && (
        <p role="status" data-testid="gps-finding" className="flex items-center gap-2 font-utility text-sm text-[#111827]/70">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#2f5daa]" /> {m.gps.finding}
          {live && <span className="sr-only"> {fmt(m.details.accuracy, { meters: Math.round(live.accuracy_m) })}</span>}
        </p>
      )}

      {gpsNote && (
        <p
          role="status"
          data-testid="gps-note"
          className={`flex items-start gap-2 rounded-lg px-3 py-2.5 font-utility text-sm ${
            gpsNote.kind === 'saved' ? 'bg-green-50 text-green-800' : 'border border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {gpsNote.kind === 'saved' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{fmt(m.gps[gpsNote.kind], { meters: gpsNote.meters })}</span>
        </p>
      )}
      {gpsNote && gpsNote.kind !== 'saved' && (
        <div className="flex flex-wrap items-center gap-x-4">
          <button type="button" onClick={() => void captureHere()} disabled={busy} className={LINK_BUTTON}>
            {m.actions.retry}
          </button>
          <button type="button" onClick={() => setPasteOpen(true)} className={LINK_BUTTON}>
            {m.actions.haveLink}
          </button>
        </div>
      )}

      {gpsError && (
        <div role="alert" data-testid="gps-error" data-code={gpsError} className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="flex items-start gap-2 font-utility text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {m.gps[gpsError]}
          </p>
          <p className="font-utility text-xs text-red-700/80">{m.gps.alternative}</p>
          <div className="flex flex-wrap items-center gap-x-4">
            {gpsError !== 'unsupported' && (
              <button type="button" onClick={() => void captureHere()} disabled={busy} className={LINK_BUTTON}>
                {m.actions.retry}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setPasteOpen(true)
                setGpsError(null)
              }}
              className={LINK_BUTTON}
            >
              {m.actions.haveLink}
            </button>
          </div>
        </div>
      )}

      {pending && (
        <p role="status" data-testid="gps-waiting-online" className="flex items-start gap-2 font-utility text-sm text-amber-700">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" /> {m.gps.waitingOnline}
        </p>
      )}

      {error && (
        <div role="alert" data-testid="location-error" data-code={error.code} className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="flex items-start gap-2 font-utility text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error.text}
          </p>
          {error.guidance.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-9 font-utility text-xs text-red-700/90">
              {error.guidance.map((g) => (
                <li key={g}>{m.guidance[g as keyof typeof m.guidance]}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
