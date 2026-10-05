import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { metadata as associatesMeta, viewport as associatesViewport } from '@/app/(site)/[lang]/associates/layout'
import { metadata as preferredMeta } from '@/app/(site)/[lang]/preferred/layout'
import PortalShell from '@/components/associate/PortalShell'
import { en, withI18n } from './helpers/i18n'

vi.mock('@clerk/nextjs', () => ({ ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, useClerk: () => ({ signOut: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/associates/portal' }))

const root = process.cwd()
const manifest = (name: string) => JSON.parse(readFileSync(join(root, 'public', name), 'utf8')) as {
  name: string; start_url: string; scope: string; display: string; theme_color: string; icons: { src: string; sizes: string; purpose?: string }[]
}

describe.each([
  ['associates', associatesMeta],
  ['preferred', preferredMeta],
])('%s portal manifest', (who, meta) => {
  const m = manifest(`${who}.webmanifest`)

  it('is linked from this portal’s layout only', () => {
    expect(meta.manifest).toBe(`/${who}.webmanifest`)
  })

  it('opens full-screen at the portal home, scoped to this portal (sign-in included)', () => {
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe(`/${who}/portal`)
    expect(m.scope).toBe(`/${who}/`)
    expect(m.start_url.startsWith(m.scope)).toBe(true)
    expect(`/${who}/sign-in`.startsWith(m.scope)).toBe(true)
  })

  it('uses the navy theme colour and icons that exist, including a maskable one', () => {
    expect(m.theme_color).toBe('#0e2a63')
    expect(m.icons.length).toBeGreaterThanOrEqual(3)
    for (const icon of m.icons) expect(existsSync(join(root, 'public', icon.src.replace(/^\//, '')))).toBe(true)
    expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true)
    expect(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any')).toBe(true)
  })
})

describe('manifest scope', () => {
  it('the navy theme colour is exported for the portal layout', () => {
    expect(associatesViewport.themeColor).toBe('#0e2a63')
  })

  it('no other layout advertises a manifest, and no service worker is registered', () => {
    for (const f of ['app/(site)/[lang]/layout.tsx', 'app/(internal)/layout.tsx', 'app/(internal)/dashboard/layout.tsx']) {
      expect(readFileSync(join(root, f), 'utf8')).not.toMatch(/manifest/i)
    }
    expect(existsSync(join(root, 'public/sw.js'))).toBe(false)
    expect(existsSync(join(root, 'app/manifest.ts'))).toBe(false)
  })
})

describe('PortalShell', () => {
  it('has the language switcher on the screen itself, one tap away', () => {
    render(
      withI18n(
        <PortalShell base="/associates/portal" active="home" showTerritory={false} labels={en.associates.portal.nav} signOutLabel="Sign out">
          <p>content</p>
        </PortalShell>
      )
    )
    const switcher = screen.getByTestId('portal-language-switcher')
    expect(within(switcher).getAllByRole('button')).toHaveLength(3)
    expect(switcher).toHaveTextContent('EN')
    expect(screen.getByText('content')).toBeInTheDocument()
  })
})
