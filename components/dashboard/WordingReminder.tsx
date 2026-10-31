'use client'

import Link from 'next/link'
import { FileSignature } from 'lucide-react'
import { usePermissions } from '@/lib/access/use-permissions'
import { wordingAwaitingApproval } from '@/lib/dashboard/placeholders'
import { usePlaceholders } from '@/lib/dashboard/placeholders-api-client'

/**
 * BE-22: the home-page reminder for the people who approve launch wording (placeholders.resolve).
 * Shown only while a drafted text is not approved (never approved, or changed since); nothing
 * is fetched for anyone else.
 */
export default function WordingReminder() {
  const { can } = usePermissions()
  const canApprove = can('placeholders.resolve')
  const { data } = usePlaceholders({ enabled: canApprove })
  if (!canApprove || !data) return null
  const n = wordingAwaitingApproval(data).length
  if (n === 0) return null
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4" data-testid="wording-reminder">
      <FileSignature className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
      <p className="font-utility text-sm text-amber-900">
        <span className="font-semibold">{n === 1 ? '1 wording is waiting for your approval' : `${n} wordings are waiting for your approval`}</span>
        {' '}— proposals, agreements, receipts and handover packs that print {n === 1 ? 'it' : 'them'} are held until then.
      </p>
      <Link href="/dashboard/data-checklist" className="ml-auto font-utility text-sm font-medium text-[#0e2a63] underline">
        Open Launch readiness
      </Link>
    </div>
  )
}
