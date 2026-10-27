'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth, useClerk, useUser } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ME_KEY } from '@/lib/access/api'
import { usePermissions } from '@/lib/access/use-permissions'

/**
 * Shown above every page while one of the person's roles needs two-step verification and
 * this session has not completed it (access_control.md §7). Pages that need no sensitive
 * permission stay open, so the person can reach their security settings.
 */
export function TwoStepBanner() {
  const { isLoaded, requiresTwoFactor, twoFactorOk } = usePermissions()
  if (!isLoaded || !requiresTwoFactor || twoFactorOk) return null
  return (
    <div role="status" data-testid="two-step-banner" className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
      <ShieldCheck className="hidden h-5 w-5 shrink-0 text-amber-600 sm:block" aria-hidden="true" />
      <p className="flex-1 font-utility text-sm text-amber-800">
        Your role needs two-step verification for some actions (approvals, payouts, staff changes and similar). Turn it on to use them.
      </p>
      <Link href="/dashboard/two-step" className="inline-flex min-h-[44px] items-center font-utility text-sm font-semibold text-amber-900 underline underline-offset-2">
        Turn on two-step verification
      </Link>
    </div>
  )
}

/**
 * The guided "Turn on two-step verification" screen (FE-17 §7): Clerk's own security
 * settings (the user profile) set it up; the backend reads the session's `fva` claim, so
 * a session that signed in before it was turned on has to sign in again with the code.
 */
export function TwoStepGuide() {
  const { user } = useUser()
  const { openUserProfile, signOut } = useClerk()
  const { getToken } = useAuth()
  const qc = useQueryClient()
  const { twoFactorOk, requiresTwoFactor, isLoaded } = usePermissions()
  const [checked, setChecked] = useState(false)
  const [checking, setChecking] = useState(false)
  const enabled = !!user?.twoFactorEnabled

  async function checkAgain() {
    setChecking(true)
    try {
      // A fresh token carries the session's latest verification claims.
      await getToken({ skipCache: true })
      await qc.invalidateQueries({ queryKey: ME_KEY })
    } finally {
      setChecking(false)
      setChecked(true)
    }
  }

  function signInAgain() {
    const back = `/dashboard/sign-in?redirect_url=${encodeURIComponent('/dashboard/two-step')}`
    void signOut({ redirectUrl: back })
  }

  if (isLoaded && (twoFactorOk || !requiresTwoFactor)) {
    return (
      <div className="max-w-xl" data-testid="two-step-done">
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">Two-step verification</h1>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" aria-hidden="true" />
          <div>
            <p className="font-utility font-medium text-green-900">You’re all set</p>
            <p className="mt-1 text-sm text-green-800">
              {requiresTwoFactor ? 'This session is verified with two steps. Go back and try the action again.' : 'Your roles don’t need two-step verification, though turning it on still protects your account.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl" data-testid="two-step-guide">
      <h1 className="font-display text-2xl font-bold text-[#091c3c]">Turn on two-step verification</h1>
      <p className="mt-2 font-utility text-sm text-[#111827]/70">
        Your role can approve, pay out or change who has access, so Grid Nova asks for a second step when you sign in: a code from an authenticator app on your phone.
      </p>
      <ol className="mt-6 space-y-4">
        <li className="rounded-xl border border-[#e4e8ee] bg-white p-5">
          <p className="font-utility text-sm font-semibold text-[#091c3c]">1. Turn it on in your account security settings</p>
          <p className="mt-1 text-sm text-[#111827]/70">
            {enabled
              ? 'Done — two-step verification is on for your account.'
              : 'Open Security, choose “Add two-step verification”, then scan the code with an authenticator app (Google Authenticator, Microsoft Authenticator or similar). Keep the backup codes somewhere safe.'}
          </p>
          {!enabled && (
            <Button className="mt-3 min-h-[44px]" onClick={() => openUserProfile()}>
              Open security settings
            </Button>
          )}
        </li>
        <li className="rounded-xl border border-[#e4e8ee] bg-white p-5">
          <p className="font-utility text-sm font-semibold text-[#091c3c]">2. Check, then try again</p>
          <p className="mt-1 text-sm text-[#111827]/70">
            When it’s on, check here. If this session started before you turned it on, sign in again and enter the code from your app.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="min-h-[44px]" onClick={() => void checkAgain()} disabled={checking}>
              {checking ? 'Checking…' : 'Check again'}
            </Button>
            {(enabled || checked) && (
              <Button variant="outline" className="min-h-[44px]" onClick={signInAgain}>
                Sign in again with my code
              </Button>
            )}
          </div>
          {checked && !twoFactorOk && (
            <p className="mt-3 text-sm text-amber-800" role="status" data-testid="two-step-still-needed">
              {enabled ? 'This session still needs the code. Sign in again and enter the code from your app.' : 'Two-step verification isn’t on yet. Turn it on in step 1 first.'}
            </p>
          )}
        </li>
      </ol>
    </div>
  )
}
