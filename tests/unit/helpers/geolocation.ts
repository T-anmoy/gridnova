import { vi } from 'vitest'

// A controllable stand-in for navigator.geolocation that records every watcher
// so tests can assert none is left running.
export function fakeGeolocation() {
  const watchers = new Map<number, { ok: PositionCallback; err: PositionErrorCallback }>()
  let nextId = 0
  const watchPosition = vi.fn((ok: PositionCallback, err: PositionErrorCallback) => {
    nextId += 1
    watchers.set(nextId, { ok, err })
    return nextId
  })
  const clearWatch = vi.fn((id: number) => {
    watchers.delete(id)
  })
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { watchPosition, clearWatch } })
  return {
    watchPosition,
    clearWatch,
    active: () => watchers.size,
    emit(accuracy: number, latitude = 22.5726, longitude = 88.3639) {
      for (const w of [...watchers.values()]) w.ok({ coords: { latitude, longitude, accuracy } } as GeolocationPosition)
    },
    fail(code: 1 | 2 | 3) {
      for (const w of [...watchers.values()]) w.err({ code, message: 'x' } as GeolocationPositionError)
    },
  }
}

export function removeGeolocation() {
  // @ts-expect-error test override
  delete navigator.geolocation
}
