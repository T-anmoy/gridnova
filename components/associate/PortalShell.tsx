'use client'

import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Home, IdCard, User, HelpCircle, Map, LogOut } from 'lucide-react'
import Link from '@/components/i18n/Link'
import { useLocale } from '@/lib/i18n/client'

type NavKey = 'home' | 'idCard' | 'profile' | 'help' | 'territory'

const ICONS: Record<NavKey, React.ElementType> = { home: Home, idCard: IdCard, profile: User, help: HelpCircle, territory: Map }

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
  labels: Record<NavKey, string>
  showTerritory: boolean
  signOutLabel: string
  children: React.ReactNode
}) {
  const { signOut } = useClerk()
  const router = useRouter()
  const locale = useLocale()

  const items: { key: NavKey; href: string }[] = [
    { key: 'home', href: base },
    ...(showTerritory ? [{ key: 'territory' as const, href: `${base}/territory` }] : []),
    { key: 'idCard', href: `${base}/id-card` },
    { key: 'profile', href: `${base}/profile` },
    { key: 'help', href: `${base}/help` },
  ]

  async function handleSignOut() {
    await signOut()
    router.push(locale === 'en' ? '/' : `/${locale}`)
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] pb-24 md:pb-0">
      <div className="mx-auto max-w-2xl px-5 pt-[calc(var(--header-h)+2rem)] pb-8 md:flex md:gap-8">
        {/* Desktop side nav */}
        <nav className="hidden md:flex md:w-48 md:flex-col md:gap-1 md:shrink-0">
          {items.map(({ key, href }) => {
            const Icon = ICONS[key]
            const isActive = key === active
            return (
              <Link
                key={key}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-utility text-sm transition-colors ${
                  isActive ? 'bg-[#0e2a63] text-white font-semibold' : 'text-[#111827]/60 hover:bg-white'
                }`}
              >
                <Icon className="h-4 w-4" /> {labels[key]}
              </Link>
            )
          })}
          <button onClick={() => void handleSignOut()} className="mt-4 flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-utility text-sm text-red-600 hover:bg-white transition-colors">
            <LogOut className="h-4 w-4" /> {signOutLabel}
          </button>
        </nav>

        <div className="flex-1 min-w-0">{children}</div>
      </div>

      {/* Phone-first bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[#e4e8ee] bg-white md:hidden">
        {items.map(({ key, href }) => {
          const Icon = ICONS[key]
          const isActive = key === active
          return (
            <Link
              key={key}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 font-utility text-[10px] ${
                isActive ? 'text-[#0e2a63] font-semibold' : 'text-[#111827]/45'
              }`}
            >
              <Icon className="h-5 w-5" />
              {labels[key]}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
