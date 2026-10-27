import { redirect } from 'next/navigation'
import { InvitationSignUp } from '@/components/auth/InvitationSignUp'
import { invitationEntry, signInWithTicket } from '@/lib/auth/invitation'

// STAFF_INVITE_REDIRECT_URL points here (BE-17 §3). Only a staff invitation link opens the
// sign-up; anyone else is sent to the sign-in page — access is by invitation.
const SIGN_IN = '/dashboard/sign-in'

export default async function StaffSignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const entry = invitationEntry(await searchParams)
  if (entry.kind === 'no_ticket') redirect(SIGN_IN)
  if (entry.kind === 'sign_in') redirect(signInWithTicket(SIGN_IN, entry.ticket))

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-[#091c3c] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold text-white">Join Grid Nova AI</h1>
          <p className="mt-1 font-utility text-sm text-white/50">Set up your sign-in to accept your invitation</p>
        </div>
        <InvitationSignUp
          ticket={entry.ticket}
          path="/dashboard/sign-up"
          signInPath={SIGN_IN}
          afterUrl="/dashboard"
          copy={{
            checking: 'Checking your invitation…',
            expiredTitle: 'This invitation has expired — ask an Admin to send a new one',
            expiredBody: 'The link may have been used already, withdrawn, or be past its date. A Grid Nova Admin can send you a fresh invitation from the Employees page.',
            signInInstead: 'Already have an account? Sign in',
          }}
        />
      </div>
    </main>
  )
}
