'use client'

import Link from 'next/link'
import { useClerk, useUser } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { ShieldOff, MailQuestion, UserX, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ME_KEY } from '@/lib/access/api'
import type { SignInBlock } from '@/lib/access/errors'

const COPY: Record<SignInBlock, { title: string; body: (email: string | null) => string[]; icon: React.ElementType }> = {
  not_invited: {
    title: 'Access is by invitation',
    icon: MailQuestion,
    body: (email) => [
      email
        ? `You’re signed in as ${email}, but this account hasn’t been invited to the Grid Nova dashboard.`
        : 'This account hasn’t been invited to the Grid Nova dashboard.',
      'Staff accounts are opened by a Grid Nova Admin. Ask an Admin to send an invitation to your work email address, then open the link in that email to finish signing up.',
    ],
  },
  invitation_expired: {
    title: 'This invitation has expired',
    icon: MailQuestion,
    body: () => ['Invitations stay open for a few days only. Ask a Grid Nova Admin to send you a new one, then open the link in the new email.'],
  },
  email_in_use: {
    title: 'This email address is already in use',
    icon: ShieldOff,
    body: () => ['Another staff account already uses this email address. Ask a Grid Nova Admin to check the staff list.'],
  },
  identity_check_unavailable: {
    title: 'We couldn’t check your invitation',
    icon: RefreshCw,
    body: () => ['The sign-in service didn’t answer just now, so we couldn’t confirm your email address. Try again in a minute.'],
  },
  deactivated: {
    title: 'Your access has been turned off',
    icon: UserX,
    body: () => [
      'A Grid Nova Admin has turned off this account’s access to the dashboard. Your past work is kept.',
      'If you think this is a mistake, speak to a Grid Nova Admin.',
    ],
  },
}

/** Full-page explanation when GET /employees/me refuses the signed-in person (FE-17 §7). */
export function SignInBlocked({ kind }: { kind: SignInBlock }) {
  const { signOut } = useClerk()
  const { user } = useUser()
  const qc = useQueryClient()
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null
  const copy = COPY[kind]
  const Icon = copy.icon

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-[#091c3c] p-4">
      <div role="alert" data-testid={`sign-in-blocked-${kind}`} className="w-full max-w-md rounded-xl border border-white/10 bg-[#0e2a63] p-6 shadow-2xl sm:p-8">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#f7a800]/15">
          <Icon className="h-5 w-5 text-[#f7a800]" aria-hidden="true" />
        </div>
        <h1 className="font-display text-xl font-semibold text-white">{copy.title}</h1>
        {copy.body(email).map((p) => (
          <p key={p} className="mt-3 font-utility text-sm leading-relaxed text-white/75">{p}</p>
        ))}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {kind === 'identity_check_unavailable' && (
            <Button className="min-h-[44px] bg-[#f7a800] text-[#091c3c] hover:bg-[#ffd27a]" onClick={() => void qc.invalidateQueries({ queryKey: ME_KEY })}>
              Try again
            </Button>
          )}
          <Button
            variant="outline"
            className="min-h-[44px] border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={() => void signOut({ redirectUrl: '/dashboard/sign-in' })}
          >
            Sign out and use another account
          </Button>
        </div>
        {kind === 'not_invited' && (
          <p className="mt-6 font-utility text-xs text-white/55">
            Grid Nova Associate? Your portal is at{' '}
            <Link href="/associates/portal" className="text-[#f7a800] underline underline-offset-2 hover:text-[#ffd27a]">gridnova.in/associates/portal</Link>.
          </p>
        )}
      </div>
    </main>
  )
}
