'use client'

import Link from 'next/link'
import { ShieldOff } from 'lucide-react'
import { useAccessAdmins } from '@/lib/access/api'
import type { AccessAdmin } from '@/lib/access/types'

/** "Ada Admin, Raju Paul or Tanmoy Halder" — with each email when the viewer may see it. */
export function adminNames(admins: AccessAdmin[]): string {
  const names = admins.map((a) => (a.email ? `${a.name} (${a.email})` : a.name))
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
}

/**
 * The calm state a page shows when the signed-in person's permissions do not cover it
 * (FE-17). BE-19's GET /access/admins names the Admins to ask; while it loads, or if it
 * fails, the sentence names the role instead.
 */
export default function NoAccess({ what }: { what: string }) {
  const admins = useAccessAdmins()
  const list = admins.data ?? []
  return (
    <div className="p-6 md:p-8">
      <div role="alert" data-testid="no-access" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <p className="font-utility font-medium text-amber-800">You don’t have access to this — ask an Admin</p>
          <p className="mt-1 text-sm text-amber-700">
            {what} isn’t part of what your roles allow. If you need it for your work,{' '}
            {list.length > 0 ? (
              <>
                ask <span data-testid="admin-names" className="font-medium text-amber-900">{adminNames(list)}</span> to change your roles.
              </>
            ) : (
              'ask a Grid Nova Admin to change your roles.'
            )}
          </p>
          <p className="mt-2 text-sm">
            <Link href="/dashboard/access" className="font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900">
              See who can do what
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
