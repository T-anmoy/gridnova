import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { I18nProvider } from '@/lib/i18n/client'
import { AssociateQueryProvider } from '@/components/associate/AssociateQueryProvider'
import PortalClosed from '@/components/associate/PortalClosed'
import { ASSOCIATE_PORTAL_OPEN } from '@/lib/associates'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

// Installable as a home-screen app for THIS portal only (no service worker): the
// manifest is linked from this layout, so no other page of the site advertises it.
export const metadata: Metadata = { manifest: '/associates.webmanifest', appleWebApp: { capable: true, title: 'Grid Nova', statusBarStyle: 'default' } }
export const viewport: Viewport = { themeColor: '#0e2a63' }

// Scoped to /associates/* only — the rest of the public site stays free of
// Clerk/react-query so marketing pages don't pay for auth machinery they
// never use. Separate from the staff dashboard's ClerkProvider/QueryProvider
// (app/(internal)/dashboard/layout.tsx): different principal, different
// sign-in destination on session expiry. While the portal switch is closed
// every route here shows the "opening soon" page instead.
export default async function AssociatesLayout({ children, params }: { children: React.ReactNode } & LangParams) {
  const m = messagesFor(await resolveLocale(params))
  if (!ASSOCIATE_PORTAL_OPEN) return <PortalClosed t={m.associates.closed} />
  return (
    <ClerkProvider>
      <I18nProvider messages={{ portalErrors: m.portalErrors, photoSlot: m.photoSlot, siteLocation: m.siteLocation }}>
        <AssociateQueryProvider signInPath="/associates/sign-in">{children}</AssociateQueryProvider>
      </I18nProvider>
    </ClerkProvider>
  )
}
