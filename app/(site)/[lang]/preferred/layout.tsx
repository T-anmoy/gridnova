import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { I18nProvider } from '@/lib/i18n/client'
import { AssociateQueryProvider } from '@/components/associate/AssociateQueryProvider'
import PortalClosed from '@/components/associate/PortalClosed'
import { ASSOCIATE_PORTAL_OPEN } from '@/lib/associates'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

// Installable as a home-screen app for THIS portal only (no service worker): the
// manifest is linked from this layout, so no other page of the site advertises it.
export const metadata: Metadata = { manifest: '/preferred.webmanifest', appleWebApp: { capable: true, title: 'Grid Nova', statusBarStyle: 'default' } }
export const viewport: Viewport = { themeColor: '#0e2a63' }

// Scoped to /preferred/* only — see app/(site)/[lang]/associates/layout.tsx
// for why this is a separate provider from both the staff dashboard and the
// plain Associate portal, and for the closed-portal page.
export default async function PreferredLayout({ children, params }: { children: React.ReactNode } & LangParams) {
  const m = messagesFor(await resolveLocale(params))
  if (!ASSOCIATE_PORTAL_OPEN) return <PortalClosed t={m.associates.closed} />
  return (
    <ClerkProvider>
      <I18nProvider messages={{ portalErrors: m.portalErrors, photoSlot: m.photoSlot }}>
        <AssociateQueryProvider signInPath="/preferred/sign-in">{children}</AssociateQueryProvider>
      </I18nProvider>
    </ClerkProvider>
  )
}
