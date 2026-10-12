import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import JsonLd, { serializeJsonLd } from '@/components/JsonLd'
import { config } from '@/proxy'

describe('JSON-LD escaping (L6)', () => {
  it('escapes "<" so a value can never close the script element', () => {
    const out = serializeJsonLd({ name: 'x</script><script>alert(1)</script>', note: '<!-- hi' })
    expect(out).not.toContain('<')
    expect(out).toContain('\\u003c/script>')
    // …and it is still the same data once parsed.
    expect(JSON.parse(out)).toEqual({ name: 'x</script><script>alert(1)</script>', note: '<!-- hi' })
  })

  it('escapes U+2028 and U+2029', () => {
    const out = serializeJsonLd({ text: 'a\u2028b\u2029c' })
    expect(out).not.toMatch(/[\u2028\u2029]/)
    expect(out).toContain('\\u2028')
    expect(out).toContain('\\u2029')
    expect(JSON.parse(out).text).toBe('a\u2028b\u2029c')
  })

  it('the component output has exactly one closing script tag, even for hostile data', () => {
    const html = renderToStaticMarkup(<JsonLd data={{ name: '</script><img src=x onerror=alert(1)>' }} />)
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(html).not.toContain('<img')
  })

  it('leaves ordinary structured data unchanged', () => {
    expect(serializeJsonLd({ '@type': 'Organization', name: 'Grid Nova Energy', url: 'https://www.gridnova.in' })).toBe(
      '{"@type":"Organization","name":"Grid Nova Energy","url":"https://www.gridnova.in"}'
    )
  })
})

// Next compiles the matcher with path-to-regexp; for this shape (one regex
// group) that is the same as anchoring the string as a RegExp.
describe('proxy matcher (L6)', () => {
  const runs = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path))

  it.each([
    '/dashboard/leads/1.html',
    '/dashboard/leads/1.htm',
    '/dashboard/exports/leads.csv',
    '/dashboard/x.docx',
    '/dashboard/x.doc',
    '/dashboard/x.xlsx',
    '/dashboard/x.xls',
    '/dashboard/x.zip',
    '/proposal/new.html',
    '/associates/portal/home.html',
  ])('%s still goes through clerkMiddleware', (path) => {
    expect(runs(path)).toBe(true)
  })

  it.each(['/dashboard', '/dashboard/leads/12', '/proposal/accept/abc', '/hi/careers', '/api/contact'])('%s runs the middleware', (path) => {
    expect(runs(path)).toBe(true)
  })

  it.each(['/_next/static/chunks/app.js', '/logo.png', '/brand/header-logo.svg', '/fonts/a.woff2', '/favicon.ico', '/associates.webmanifest'])(
    '%s is a static asset and skips it',
    (path) => {
      // /api and /trpc are matched by the second pattern; static assets match neither.
      expect(runs(path)).toBe(false)
    }
  )
})
