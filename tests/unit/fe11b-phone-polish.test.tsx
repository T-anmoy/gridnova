import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// FE-11b (careers page phone polish). Source-level guards for the two
// site-wide fixes: the header glass must reach Chrome/Android, and the Ask
// Nova teaser must step aside while the careers Apply bar is on screen.

const root = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.resolve(root, rel), 'utf8')

describe('header glass', () => {
  it('writes the standard backdrop-filter last, so the CSS optimiser keeps it', () => {
    const glass = read('app/globals.css').match(/\.glass \{([^}]*)\}/)?.[1] ?? ''
    const prefixed = glass.indexOf('-webkit-backdrop-filter:')
    const standard = glass.search(/(^|[^-])backdrop-filter:/m)
    expect(prefixed).toBeGreaterThanOrEqual(0)
    expect(standard).toBeGreaterThan(prefixed)
  })

  it('keeps the header pill on the glass surface', () => {
    expect(read('components/Navigation.tsx')).toMatch(/className="nav-pill glass /)
  })
})

describe('Ask Nova teaser vs the careers Apply bar', () => {
  it('hides the teaser (only) while the Apply bar is shown', () => {
    expect(read('app/globals.css')).toMatch(
      /body:has\(#apply-bar\[data-state="shown"\]\) \.nova-teaser \{\s*display: none;\s*\}/,
    )
  })

  it('tags the teaser bubble, not the round Ask Nova button', () => {
    const src = read('components/AskNova.tsx')
    expect(src.match(/nova-teaser/g)).toHaveLength(1)
    const tagged = src.slice(src.lastIndexOf('<m.button', src.indexOf('nova-teaser')), src.indexOf('nova-teaser'))
    expect(tagged).toContain('key="bubble"')
  })

  it('the Apply bar keeps clear of the round button on the right', () => {
    const bar = read('components/careers/StickyApplyBar.tsx')
    expect(bar).toContain('id="apply-bar"')
    expect(bar).toContain('right-[5.5rem]')
  })
})
