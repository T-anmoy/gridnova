// One GPS session per button press: ask for a high-accuracy fix, keep the
// best (lowest-accuracy-metres) reading seen, stop early once it is good
// enough, and always release the watcher — on success, failure, cancel.
// Nothing here keeps tracking after the promise settles.

export type GpsErrorCode = 'unsupported' | 'denied' | 'timeout'

export class GpsError extends Error {
  code: GpsErrorCode
  constructor(code: GpsErrorCode) {
    super(`gps_${code}`)
    this.name = 'GpsError'
    this.code = code
  }
}

export interface GpsReading {
  latitude: number
  longitude: number
  accuracy_m: number
  captured_at: string
}

export interface GpsSessionOptions {
  /** `sample_seconds` from /options. */
  sampleSeconds: number
  /** `accuracy_good_m` from /options — reaching it ends the session early. */
  goodAccuracyM: number
  /** Called with the best reading so far, so the UI can show live progress. */
  onReading?: (best: GpsReading) => void
}

export interface GpsSession {
  promise: Promise<GpsReading>
  /** Releases the watcher and rejects nothing — the promise simply never settles after cancel. */
  cancel: () => void
}

export function startGpsSession(opts: GpsSessionOptions): GpsSession {
  let cancel = () => {}
  const promise = new Promise<GpsReading>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new GpsError('unsupported'))
      return
    }
    const sampleMs = Math.max(1, opts.sampleSeconds) * 1000
    let best: GpsReading | null = null
    let watchId: number | null = null
    let settled = false

    // The sample window ends at `sample_seconds` with whatever best reading
    // exists. A cold GPS may need longer for its first fix, so with no reading
    // yet it gets one more window before giving up.
    const sampleTimer = setTimeout(() => {
      if (best) finish(null)
    }, sampleMs)
    const capTimer = setTimeout(() => finish(best ? null : new GpsError('timeout')), sampleMs * 2)

    function release() {
      if (watchId !== null) navigator.geolocation?.clearWatch(watchId)
      watchId = null
      clearTimeout(sampleTimer)
      clearTimeout(capTimer)
    }
    function finish(err: GpsError | null) {
      if (settled) return
      settled = true
      release()
      if (err) reject(err)
      else if (best) resolve(best)
      else reject(new GpsError('timeout'))
    }
    cancel = () => {
      settled = true
      release()
    }

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (settled) return
        const acc = pos.coords.accuracy
        if (!(acc > 0)) return // no usable accuracy: not a reading we can rank or send
        if (!best || acc < best.accuracy_m) {
          best = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_m: acc,
            captured_at: new Date().toISOString(),
          }
          opts.onReading?.(best)
        }
        if (best.accuracy_m <= opts.goodAccuracyM) finish(null)
      },
      (err) => {
        if (settled) return
        if (err.code === 1) finish(new GpsError('denied'))
        // Unavailable / timeout from the device: keep waiting for the window to end.
        else if (err.code === 3 && !best) finish(new GpsError('timeout'))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: sampleMs * 2 }
    )
  })
  return { promise, cancel: () => cancel() }
}
