'use client'

import { ShieldOff } from 'lucide-react'
import { useClerk } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { useOptionalMessages } from '@/lib/i18n/client'
import type { WrongAccount } from '@/lib/dashboard/api-error'

const FALLBACK = {
  title: 'Wrong account',
  associateOnStaff: "You are signed in with an Associate account, which can't open the Grid Nova staff dashboard.",
  staffOnAssociate: "You are signed in with a Grid Nova staff account, which can't open the Associate portal.",
  switchToStaff: 'Sign out and go to staff sign-in',
  switchToAssociate: 'Sign out and go to Associate sign-in',
}

// Where the right sign-in lives for the area the user is currently in.
function associateSignInPath(): string {
  const path = typeof window === 'undefined' ? '' : window.location.pathname.replace(/^\/(?:hi|bn)(?=\/|$)/, '')
  return path.startsWith('/preferred') ? '/preferred/sign-in' : '/associates/sign-in'
}

/**
 * Shown instead of a retry/sign-in loop when the signed-in account belongs to
 * the other audience. Signing out is the user's own click — nothing here
 * redirects or signs out automatically.
 */
export function WrongAccountNotice({ kind }: { kind: WrongAccount }) {
  const { signOut } = useClerk()
  const copy = useOptionalMessages('portalErrors')?.wrongAccount ?? FALLBACK
  const onStaffArea = kind === 'associate_on_staff'
  const target = onStaffArea ? '/dashboard/sign-in' : associateSignInPath()
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3" role="alert">
      <ShieldOff className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
      <div>
        <p className="font-utility font-medium text-amber-800">{copy.title}</p>
        <p className="font-utility text-sm mt-1 text-amber-700">{onStaffArea ? copy.associateOnStaff : copy.staffOnAssociate}</p>
        <Button className="mt-3 min-h-[44px]" variant="outline" size="sm" onClick={() => void signOut({ redirectUrl: target })}>
          {onStaffArea ? copy.switchToStaff : copy.switchToAssociate}
        </Button>
      </div>
    </div>
  )
}
