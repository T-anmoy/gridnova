'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, MailWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * BE-21: the invitation email was not sent (Clerk refused it, or is not set up), so a
 * person has to be told by hand. Shows the backend's sentence — "Ask … to sign up at …
 * with …" — with a copy button. The invitation itself still stands: their own sign-up
 * with that verified address is matched to it.
 */
export function ManualSignUpNote({ instructions, testId = 'manual-sign-up' }: { instructions: string; testId?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(instructions)
      setCopied(true)
      toast.success('Copied')
    } catch {
      toast.error('Could not copy — select the text and copy it by hand.')
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid={testId}>
      <p className="flex gap-2">
        <MailWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-medium">No invitation email was sent.</span> {instructions}
        </span>
      </p>
      <Button type="button" variant="outline" size="sm" className="mt-2 min-h-[44px] gap-2 bg-white sm:min-h-0" onClick={() => void copy()}>
        <Copy className="h-3.5 w-3.5" aria-hidden="true" /> {copied ? 'Copied' : 'Copy the instructions'}
      </Button>
    </div>
  )
}
