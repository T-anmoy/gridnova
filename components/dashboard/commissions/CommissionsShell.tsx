'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import NoAccess from '@/components/dashboard/NoAccess'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'

const TABS = [
  { href: '/dashboard/commissions', label: 'Commissions' },
  { href: '/dashboard/commissions/rates', label: 'Rate schedules' },
  { href: '/dashboard/commissions/payouts', label: 'Payout batches' },
  { href: '/dashboard/commissions/queries', label: 'Queries' },
]

/** Who may open the commission screens at all. Management reads; Accounts and Admin act. */
export const COMMISSION_READ_ROLES = ['admin', 'management', 'accounts'] as const

export default function CommissionsShell({ children }: { children: React.ReactNode }) {
  const { role, isLoaded } = useStaffRole()
  const pathname = usePathname()
  if (!isLoaded) return <div className="p-6 md:p-8"><Skeleton className="h-8 w-48" /></div>
  if (!role || !COMMISSION_READ_ROLES.includes(role as (typeof COMMISSION_READ_ROLES)[number])) return <NoAccess what="Commissions and payouts" />

  const current = [...TABS].reverse().find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href ?? TABS[0].href
  return (
    <div className="space-y-5 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-[#091c3c]">Commissions &amp; payouts</h1>
        {role === 'management' && <p className="mt-1 text-sm text-gray-500">Read-only view.</p>}
      </div>
      <nav aria-label="Commission sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={current === t.href ? 'page' : undefined}
            className={`inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-4 text-sm font-medium font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] ${
              current === t.href ? 'bg-[#0e2a63] text-white' : 'border border-[#e4e8ee] bg-white text-[#0e2a63] hover:bg-[#f7f9fc]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
