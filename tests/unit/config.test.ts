import { describe, it, expect, vi } from 'vitest'
import { resolveApiBase, previewTargetsProductionBackend } from '@/lib/config'
import { readServerEnv } from '@/lib/env'

describe('resolveApiBase — production build guard', () => {
  it('throws in production when the variable is missing or blank', () => {
    expect(() => resolveApiBase({ value: undefined, nodeEnv: 'production' })).toThrow(/NEXT_PUBLIC_API_URL is not set/)
    expect(() => resolveApiBase({ value: '  ', nodeEnv: 'production' })).toThrow(/not set/)
  })

  it.each(['http://localhost:8000', 'http://127.0.0.1:8000', 'https://user@localhost/api', 'http://[::1]:8000', 'http://0.0.0.0:8000'])(
    'throws in production when the value points at a local address (%s)',
    (value) => {
      expect(() => resolveApiBase({ value, nodeEnv: 'production' })).toThrow(/local address/)
    }
  )

  it('does not mistake a real host that merely contains "localhost" text for a local one', () => {
    expect(resolveApiBase({ value: 'https://api.notlocalhost.example.com', nodeEnv: 'production' })).toBe('https://api.notlocalhost.example.com')
  })

  it('accepts a deployed URL and strips trailing slashes', () => {
    expect(resolveApiBase({ value: 'https://api.gridnova.in//', nodeEnv: 'production' })).toBe('https://api.gridnova.in')
  })

  it('falls back to the local dev backend outside production', () => {
    expect(resolveApiBase({ value: undefined, nodeEnv: 'development' })).toBe('http://localhost:8000')
    expect(resolveApiBase({ value: 'http://127.0.0.1:9000', nodeEnv: 'test' })).toBe('http://127.0.0.1:9000')
  })
})

describe('previewTargetsProductionBackend', () => {
  const base = { apiBase: 'https://api.gridnova.in', productionHost: 'api.gridnova.in' }
  it('flags a Preview build that targets the production host', () => {
    expect(previewTargetsProductionBackend({ ...base, vercelEnv: 'preview' })).toBe(true)
    expect(previewTargetsProductionBackend({ ...base, productionHost: 'https://api.gridnova.in/', vercelEnv: 'preview' })).toBe(true)
  })
  it('stays quiet for production builds, other hosts, or an unset production host', () => {
    expect(previewTargetsProductionBackend({ ...base, vercelEnv: 'production' })).toBe(false)
    expect(previewTargetsProductionBackend({ apiBase: 'https://staging-api.gridnova.in', productionHost: 'api.gridnova.in', vercelEnv: 'preview' })).toBe(false)
    expect(previewTargetsProductionBackend({ apiBase: base.apiBase, productionHost: undefined, vercelEnv: 'preview' })).toBe(false)
  })
})

describe('readServerEnv', () => {
  it('reports required production variables that are missing, loudly', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const env = readServerEnv({ RESEND_API_KEY: 're_x' }, 'production')
    expect(env.missing).toEqual(['INTERNAL_API_KEY', 'CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'])
    err.mockRestore()
  })
  it('does not require them outside production and defaults the recipient', () => {
    const env = readServerEnv({}, 'development')
    expect(env.missing).toEqual([])
    expect(env.notifyEmails).toEqual(['info@gridnova.in'])
  })
  it('splits a comma-separated recipient list', () => {
    expect(readServerEnv({ ESTIMATE_NOTIFY_EMAIL: 'a@x.in, b@x.in' }, 'test').notifyEmails).toEqual(['a@x.in', 'b@x.in'])
  })
})
