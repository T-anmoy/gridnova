import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GpsError, startGpsSession } from '@/lib/associate/gps-session'
import { fakeGeolocation, removeGeolocation } from './helpers/geolocation'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  removeGeolocation()
})

const OPTS = { sampleSeconds: 10, goodAccuracyM: 20 }

describe('startGpsSession', () => {
  it('keeps the best-accuracy reading and resolves with it when the sample window ends', async () => {
    const geo = fakeGeolocation()
    const session = startGpsSession(OPTS)
    geo.emit(60, 22.1, 88.1)
    geo.emit(35, 22.2, 88.2)
    geo.emit(50, 22.3, 88.3) // worse: ignored
    vi.advanceTimersByTime(10_000)
    const reading = await session.promise
    expect(reading).toMatchObject({ latitude: 22.2, longitude: 88.2, accuracy_m: 35 })
    expect(geo.clearWatch).toHaveBeenCalledTimes(1)
    expect(geo.active()).toBe(0)
  })

  it('stops early as soon as accuracy is at or under accuracy_good_m', async () => {
    const geo = fakeGeolocation()
    const session = startGpsSession(OPTS)
    geo.emit(45)
    expect(geo.active()).toBe(1)
    geo.emit(12)
    const reading = await session.promise
    expect(reading.accuracy_m).toBe(12)
    expect(geo.active()).toBe(0) // released without waiting out the window
  })

  it('reports each improved reading so the UI can show progress', async () => {
    const geo = fakeGeolocation()
    const seen: number[] = []
    const session = startGpsSession({ ...OPTS, onReading: (r) => seen.push(r.accuracy_m) })
    geo.emit(80)
    geo.emit(90)
    geo.emit(30)
    vi.advanceTimersByTime(10_000)
    await session.promise
    expect(seen).toEqual([80, 30])
  })

  it('ignores a reading with no usable accuracy', async () => {
    const geo = fakeGeolocation()
    const session = startGpsSession(OPTS)
    geo.emit(0)
    geo.emit(40)
    vi.advanceTimersByTime(10_000)
    expect((await session.promise).accuracy_m).toBe(40)
  })

  it('rejects with "denied" on a permission refusal and releases the watcher', async () => {
    const geo = fakeGeolocation()
    const session = startGpsSession(OPTS)
    const assertion = expect(session.promise).rejects.toMatchObject({ code: 'denied' })
    geo.fail(1)
    await assertion
    expect(geo.active()).toBe(0)
  })

  it('rejects with "timeout" when no reading ever arrives, and releases the watcher', async () => {
    const geo = fakeGeolocation()
    const session = startGpsSession(OPTS)
    const assertion = expect(session.promise).rejects.toBeInstanceOf(GpsError)
    vi.advanceTimersByTime(20_000)
    await assertion
    expect(geo.active()).toBe(0)
  })

  it('rejects with "unsupported" when the device has no geolocation', async () => {
    removeGeolocation()
    await expect(startGpsSession(OPTS).promise).rejects.toMatchObject({ code: 'unsupported' })
  })

  it('cancel() releases the watcher and clears the timers', () => {
    const geo = fakeGeolocation()
    const session = startGpsSession(OPTS)
    geo.emit(60)
    session.cancel()
    expect(geo.active()).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
