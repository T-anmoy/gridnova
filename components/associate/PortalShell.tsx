'use client'

import { useEffect } from 'react'
import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Home, IdCard, User, HelpCircle, Map, LogOut, Users } from 'lucide-react'
import Link from '@/components/i18n/Link'
import { useLocale, useOptionalMessages } from '@/lib/i18n/client'
import OfflineBanner from '@/components/OfflineBanner'
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher'
import PortalHomeLink from '@/components/associate/PortalHomeLink'
import { clearPortalDeviceData, purgeStaleDeviceData } from '@/lib/associate/portal-session'

type NavKey = 'home' | 'idCard' | 'profile' | 'help' | 'territory' | 'customers'

const ICONS: Record<NavKey, React.ElementType> = {
  home: Home,
  idCard: IdCard,
  profile: User,
  help: HelpCircle,
  territory: Map,
  customers: Users,
}

export default function PortalShell({
  base,
  active,
  labels,
  showTerritory,
  signOutLabel,
  children,
}: {
  base: '/associates/portal' | '/preferred/portal'
  active: NavKey
  labels: Record<NavKey, string> & { navLabel?: string }
  showTerritory: boolean
  signOutLabel: string
  children: React.ReactNode
}) {
  const { signOut } = useClerk()
  const router = useRouter()
  const locale = useLocale()
  const skipLabel = useOptionalMessages('common')?.skipToContent ?? 'Skip to main content'

  const items: { key: NavKey; href: string }[] = [
    { key: 'home', href: base },
    { key: 'customers', href: `${base}/customers` },
    ...(showTerritory ? [{ key: 'territory' as const, href: `${base}/territory` }] : []),
    { key: 'idCard', href: `${base}/id-card` },
    { key: 'profile', href: `${base}/profile` },
    { key: 'help', href: `${base}/help` },
  ]

  useEffect(() => {
    purgeStaleDeviceData()
  }, [])

  async function handleSignOut() {
    // Shared phones: the next person to sign in must not find this one's
    // drafts or queued customer photos.
    await clearPortalDeviceData()
    await signOut()
    router.push(locale === 'en' ? '/' : `/${locale}`)
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-[#091c3c] focus:shadow-lg"
      >
        {skipLabel}
      </a>
      <div className="mx-auto max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-8 sm:px-5 md:flex md:gap-8">
        {/* Desktop side nav */}
        <nav aria-label={labels.navLabel} className="hidden md:flex md:w-48 md:flex-col md:gap-1 md:shrink-0">
          {items.map(({ key, href }) => {
            const Icon = ICONS[key]
            const isActive = key === active
            return (
              <Link
                key={key}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2.5 font-utility text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] ${
                  isActive ? 'bg-[#0e2a63] text-white font-semibold' : 'text-[#111827]/70 hover:bg-white'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {labels[key]}
              </Link>
            )
          })}
          <button type="button" onClick={() => void handleSignOut()} className="mt-4 flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2.5 font-utility text-sm text-red-600 hover:bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]">
            <LogOut className="h-4 w-4" aria-hidden="true" /> {signOutLabel}
          </button>
        </nav>

        <div className="flex-1 min-w-0">
          {/* One tap away on every portal screen — the site header hides it behind the menu on phones. */}
          <div className="mb-4 flex items-center justify-between gap-3" data-testid="portal-language-switcher">
            <PortalHomeLink />
            <LanguageSwitcher tone="light" />
          </div>
          <OfflineBanner />
          <main id="main-content" tabIndex={-1} className="outline-none">
            {children}
          </main>
        </div>
      </div>

      {/* Phone-first bottom tab bar */}
      <nav
        aria-label={labels.navLabel}
        data-testid="portal-tab-bar"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[#e4e8ee] bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {items.map(({ key, href }) => {
          const Icon = ICONS[key]
          const isActive = key === active
          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[52px] min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2 text-center font-utility text-[11px] leading-tight focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#2f5daa] ${
                isActive ? 'text-[#0e2a63] font-semibold' : 'text-[#111827]/65'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {labels[key]}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
