'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Download, Share, X } from 'lucide-react'
import { useOptionalMessages } from '@/lib/i18n/client'
import {
  getInstallPrompt,
  isIosSafari,
  isStandalone,
  listenForInstallPrompt,
  promptInstall,
  readDismissed,
  subscribeInstallPrompt,
  writeDismissed,
} from '@/lib/associate/install-prompt'

type Mode = 'hidden' | 'android' | 'ios'

const noopSubscribe = () => () => {}

/**
 * A small, dismissible card on the portal home: Chrome's own install dialog
 * on Android, the "Share → Add to Home Screen" steps on iPhone Safari, and
 * nothing when the portal already runs from the home screen or the card was
 * dismissed on this device.
 */
export default function InstallAppCard() {
  const copy = useOptionalMessages('portalEase')?.install
  const prompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null)
  // Read once on the client; the server render (and first paint) shows nothing.
  const env = useSyncExternalStore(
    noopSubscribe,
    () => (isStandalone() ? 'standalone' : isIosSafari(window.navigator.userAgent) ? 'ios' : 'other'),
    () => 'server'
  )
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    listenForInstallPrompt()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setDismissed(readDismissed())
  }, [])

  if (!copy || dismissed !== false || env === 'server' || env === 'standalone') return null
  const mode: Mode = prompt ? 'android' : env === 'ios' ? 'ios' : 'hidden'
  if (mode === 'hidden') return null

  function dismiss() {
    writeDismissed()
    setDismissed(true)
  }

  return (
    <section
      data-testid="install-card"
      data-mode={mode}
      aria-label={mode === 'ios' ? copy.iosTitle : copy.title}
      className="mt-6 rounded-2xl border border-[#e4e8ee] bg-white p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-base font-semibold text-[#0e2a63]">{mode === 'ios' ? copy.iosTitle : copy.title}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={copy.dismiss}
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#111827]/65 focus-visible:outline-2 focus-visible:outline-[#2f5daa]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {mode === 'android' ? (
        <>
          <p className="mt-1 text-sm text-[#111827]/70">{copy.body}</p>
          <button
            type="button"
            onClick={() => void promptInstall().then((outcome) => outcome === 'accepted' && setDismissed(true))}
            className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#0e2a63] px-4 font-utility text-sm font-semibold text-white sm:w-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> {copy.button}
          </button>
        </>
      ) : (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#111827]/80">
          <li>
            {copy.iosStep1} <Share className="inline h-4 w-4 align-text-bottom text-[#0e2a63]" aria-hidden="true" />
          </li>
          <li>{copy.iosStep2}</li>
        </ol>
      )}
    </section>
  )
}
