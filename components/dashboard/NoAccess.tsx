import Link from 'next/link'
import { ShieldOff } from 'lucide-react'

/**
 * The calm state a page shows when the signed-in person's permissions do not cover it
 * (FE-17). The contract has no "who are the Admins" route for staff who cannot manage
 * staff, so it names the role, not the people.
 */
export default function NoAccess({ what }: { what: string }) {
  return (
    <div className="p-6 md:p-8">
      <div role="alert" data-testid="no-access" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <p className="font-utility font-medium text-amber-800">You don’t have access to this — ask an Admin</p>
          <p className="mt-1 text-sm text-amber-700">
            {what} isn’t part of what your roles allow. If you need it for your work, ask a Grid Nova Admin to change your roles.
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
