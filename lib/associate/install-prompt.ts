// "Install the app" support for the portals (no service worker — the web-app
// manifest linked from the portal layouts is enough for current Chrome).
//
// Chrome fires `beforeinstallprompt` once per page load, often before the
// portal home has rendered (the associate may land on another screen first
// and navigate client-side). This module catches it as soon as the portal
// shell loads and keeps it for the install card.

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const INSTALL_DISMISSED_KEY = 'gn-install-card-dismissed'

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

function onBeforeInstallPrompt(e: Event) {
  // Keep Chrome's own mini-infobar away; the card offers the install instead.
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  notify()
}

function onInstalled() {
  deferred = null
  notify()
}

let attached = false
/** Idempotent; safe to call on every render of the shell. */
export function listenForInstallPrompt(): void {
  if (attached || typeof window === 'undefined') return
  attached = true
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onInstalled)
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferred
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Shows Chrome's install dialog; the saved event can be used only once. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferred
  if (!e) return 'unavailable'
  deferred = null
  notify()
  await e.prompt()
  const { outcome } = await e.userChoice
  return outcome
}

/** Already opened from the home screen. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
}

/** iPhone/iPad Safari — the only iOS browser that can add a web app to the home screen. */
export function isIosSafari(userAgent: string): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent)
  return ios && /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(userAgent)
}

export function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(INSTALL_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDismissed(): void {
  try {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
  } catch {
    // Private mode or blocked storage: the card simply comes back next visit.
  }
}

/** Test-only: forget the captured event and listeners between tests. */
export function __resetInstallPromptForTests(): void {
  deferred = null
  listeners.clear()
  if (attached && typeof window !== 'undefined') {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.removeEventListener('appinstalled', onInstalled)
  }
  attached = false
}
