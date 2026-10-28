import { describe, it, expect } from 'vitest'
import { inTurn } from '@/lib/associate/serial-uploads'

// FE-19 phone pass: overlapping uploads for one customer lost documents on the server.
describe('inTurn', () => {
  it('runs tasks under one key strictly one after another, in order', async () => {
    const log: string[] = []
    const slow = (name: string, ms: number) => () =>
      new Promise<string>((resolve) => {
        log.push(`start ${name}`)
        setTimeout(() => {
          log.push(`end ${name}`)
          resolve(name)
        }, ms)
      })
    const results = await Promise.all([inTurn('c1', slow('a', 30)), inTurn('c1', slow('b', 5)), inTurn('c1', slow('c', 1))])
    expect(results).toEqual(['a', 'b', 'c'])
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c'])
  })

  it('a failure does not stop the next upload, and is still reported to its caller', async () => {
    const failing = inTurn('c2', async () => {
      throw new Error('network')
    })
    const next = inTurn('c2', async () => 'ok')
    await expect(failing).rejects.toThrow('network')
    await expect(next).resolves.toBe('ok')
  })

  it('different customers do not wait for each other', async () => {
    const log: string[] = []
    let release: () => void = () => {}
    const blocked = inTurn('c3', () => new Promise<void>((r) => (release = r)))
    await inTurn('c4', async () => log.push('c4 done'))
    expect(log).toEqual(['c4 done'])
    release()
    await blocked
  })
})
