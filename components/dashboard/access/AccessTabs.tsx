'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/dashboard/access', label: 'Who can do what' },
  { href: '/dashboard/access/alerts', label: 'Alert routing' },
]

/** The two read-only access views (BE-17 §2 and §6), open to everyone on staff. */
export function AccessTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Access views" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {TABS.map((t) => {
        const current = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={current ? 'page' : undefined}
            className={`inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-4 font-utility text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] ${
              current ? 'bg-[#0e2a63] text-white' : 'border border-[#e4e8ee] bg-white text-[#0e2a63] hover:bg-[#f7f9fc]'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
