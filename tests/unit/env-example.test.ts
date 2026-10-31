// .env.example is documentation, tracked by git: it may never carry a real value or anything
// shaped like a secret. Real values live in .env.local (git-ignored) and in Vercel.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const text = readFileSync(path.resolve(__dirname, '../../.env.example'), 'utf8')

// The only values allowed on an active KEY=value line.
const ALLOWED: Record<string, RegExp> = {
  NEXT_PUBLIC_API_URL: /^http:\/\/localhost:8000$/,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: /^pk_test_x+$/,
  CLERK_SECRET_KEY: /^sk_test_x+$/,
}

/** Every secret shape found in a piece of text (empty = clean). */
function secretShapes(s: string): string[] {
  const found: string[] = []
  if (/sk_live_/.test(s)) found.push('sk_live_')
  if (/pk_live_/.test(s)) found.push('pk_live_')
  if (/\bre_[A-Za-z0-9_]{20,}/.test(s)) found.push('re_ key')
  // A standalone 43–44 character base64 run (a Fernet key, an HMAC secret); a row of x is a placeholder.
  for (const m of s.matchAll(/(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{43}=?(?![A-Za-z0-9+/_=-])/g)) {
    if (!/^x+=?$/.test(m[0])) found.push(`base64 ${m[0].slice(0, 6)}…`)
  }
  return found
}

const active = text
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#') && line.includes('='))

describe('.env.example', () => {
  it('has active KEY=value lines to check', () => {
    expect(active.length).toBeGreaterThan(3)
  })

  it.each(active.map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)]))('%s is empty or an allowed example', (key, value) => {
    if (value === '') return
    expect(ALLOWED[key], `${key} must be empty in .env.example`).toBeDefined()
    expect(value).toMatch(ALLOWED[key])
  })

  it('contains no secret shape anywhere, comments included', () => {
    expect(secretShapes(text)).toEqual([])
  })

  it('the detector catches each shape it is meant to', () => {
    expect(secretShapes('CLERK_SECRET_KEY=sk_live_abc')).toEqual(['sk_live_'])
    expect(secretShapes('X=pk_live_Y2xlcmsuZXhhbXBsZS5jb20k')).toContain('pk_live_')
    expect(secretShapes('RESEND_API_KEY=re_123456789012345678901234')).toEqual(['re_ key'])
    expect(secretShapes('KEY=' + 'A'.repeat(43) + '=')).toHaveLength(1)
    expect(secretShapes('FERNET=abcdEFGH_1234-ijklMNOP5678qrstUVWX9012yzAB3=')).toHaveLength(1)
    expect(secretShapes('KEY=pk_test_' + 'x'.repeat(42))).toEqual([])
    expect(secretShapes('re_ prefix, re_short')).toEqual([])
  })
})
