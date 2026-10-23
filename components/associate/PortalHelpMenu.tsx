'use client'

import { useContext, useEffect, useId, useRef, useState } from 'react'
import { QueryClientContext } from '@tanstack/react-query'
import { HelpCircle, MessageCircle, Phone, X } from 'lucide-react'
import { useAssociateMe } from '@/lib/associate/api-client'
import { useOptionalMessages } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/types'
import { HELPLINE_DISPLAY, HELPLINE_TEL, whatsappUrl } from '@/lib/contact'

const LINK =
  'flex min-h-[48px] items-center gap-2.5 rounded-xl px-4 font-utility text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]'

/** The prefilled WhatsApp text, with the Associate ID when it is known. */
export function helpWhatsappText(copy: { whatsappText: string; whatsappTextNoId: string }, associateId: string | null | undefined): string {
  return associateId ? fmt(copy.whatsappText, { associateId }) : copy.whatsappTextNoId
}

/**
 * "Need help?" in the portal header — Call and WhatsApp the helpline from any
 * screen. It lives in the header row (never floating), so it can never cover
 * a pinned submit button, the tab bar or the offline banner.
 */
export function PortalHelpMenuView({ associateId }: { associateId: string | null | undefined }) {
  const copy = useOptionalMessages('portalEase')?.help
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!copy) return null

  return (
    // Not `relative`: the panel is placed against the shell's header row, so it
    // spans the screen width on a phone instead of hanging off the button.
    <div ref={rootRef} data-testid="portal-help-menu">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#e4e8ee] bg-white px-3 font-utility text-sm font-semibold text-[#0e2a63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]"
      >
        <HelpCircle className="h-4 w-4 text-[#b87700]" aria-hidden="true" />
        {copy.button}
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={copy.title}
          className="absolute inset-x-0 top-full z-40 mt-2 rounded-2xl border border-[#e4e8ee] bg-white p-3 shadow-lg sm:left-auto sm:w-72"
        >
          <div className="flex items-start justify-between gap-2 px-1 pb-2">
            <p className="font-display text-sm font-semibold text-[#091c3c]">{copy.title}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={copy.close}
              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#111827]/65 focus-visible:outline-2 focus-visible:outline-[#2f5daa]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-2">
            <a href={HELPLINE_TEL} className={`${LINK} bg-[#0e2a63] text-white`}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              {copy.call}{' '}
              <span className="font-normal">{HELPLINE_DISPLAY}</span>
            </a>
            <a
              href={whatsappUrl(helpWhatsappText(copy, associateId))}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={copy.whatsappHelp}
              className={`${LINK} border border-[#e4e8ee] text-[#0e2a63]`}
            >
              <MessageCircle className="h-4 w-4 text-[#0e2a63]" aria-hidden="true" />
              {copy.whatsapp}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectedHelpMenu() {
  const { data: me } = useAssociateMe()
  return <PortalHelpMenuView associateId={me?.associate_id} />
}

/** Reads the Associate ID from the portal's own session when a query client is present. */
export default function PortalHelpMenu() {
  const client = useContext(QueryClientContext)
  return client ? <ConnectedHelpMenu /> : <PortalHelpMenuView associateId={null} />
}
