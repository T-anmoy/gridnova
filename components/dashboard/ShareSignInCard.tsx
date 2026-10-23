'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, MessageCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { SITE_URL } from '@/lib/seo'
import { indianWhatsappNumber, whatsappUrl } from '@/lib/contact'
import type { ApplicationType } from '@/lib/associate/types'

// The dashboard is English-only, and no associate or application record
// carries a preferred language (openapi.json), so the message is English and
// links the English sign-in page.

export function signInUrl(type: ApplicationType): string {
  return `${SITE_URL}/${type === 'preferred_associate' ? 'preferred' : 'associates'}/sign-in`
}

export function signInMessage({
  fullName,
  associateId,
  type,
  email,
}: {
  fullName: string
  associateId: string
  type: ApplicationType
  email?: string | null
}): string {
  const kind = type === 'preferred_associate' ? 'Preferred Associate' : 'Associate'
  const inbox = email ? ` (sent to ${email})` : ''
  return [
    `Hello ${fullName}, your Grid Nova ${kind} application is approved.`,
    `Your Associate ID: ${associateId}`,
    `Look for the Grid Nova invitation email${inbox} and use it to set up your login.`,
    `Then sign in here: ${signInUrl(type)}`,
  ].join('\n')
}

/**
 * Admin-only, once an application is approved: send the Associate their
 * sign-in details on WhatsApp, or copy the message to send another way.
 * Without a usable Indian mobile only "Copy message" is offered.
 */
export default function ShareSignInCard({
  fullName,
  associateId,
  type,
  mobile,
  email,
}: {
  fullName: string
  associateId: string
  type: ApplicationType
  mobile: string | null | undefined
  email?: string | null
}) {
  const [copied, setCopied] = useState(false)
  const message = signInMessage({ fullName, associateId, type, email })
  const waNumber = indianWhatsappNumber(mobile)

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      toast.success('Message copied')
    } catch {
      toast.error('Could not copy — select the message and copy it by hand.')
    }
  }

  return (
    <Card className="p-6 mb-4" data-testid="share-sign-in">
      <h2 className="font-display text-sm font-semibold text-[#091c3c] mb-2">Share the sign-in with the Associate</h2>
      <pre className="whitespace-pre-wrap rounded-lg bg-[#f7f9fc] p-3 font-utility text-xs text-[#111827]/80">{message}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        {waNumber && (
          <a
            href={whatsappUrl(message, waNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0e2a63] px-4 font-utility text-sm font-semibold text-white"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> Share sign-in on WhatsApp
          </a>
        )}
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#e4e8ee] px-4 font-utility text-sm font-semibold text-[#0e2a63]"
        >
          <Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Copied' : 'Copy message'}
        </button>
      </div>
      {!waNumber && (
        <p className="mt-2 font-utility text-xs text-[#111827]/65">No WhatsApp-ready Indian mobile on this record — copy the message instead.</p>
      )}
    </Card>
  )
}
