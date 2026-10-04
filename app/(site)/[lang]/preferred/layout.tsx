import { ClerkProvider } from '@clerk/nextjs'
import { AssociateQueryProvider } from '@/components/associate/AssociateQueryProvider'
import PortalClosed from '@/components/associate/PortalClosed'
import { ASSOCIATE_PORTAL_OPEN } from '@/lib/associates'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

// Scoped to /preferred/* only — see app/(site)/[lang]/associates/layout.tsx
// for why this is a separate provider from both the staff dashboard and the
// plain Associate portal, and for the closed-portal page.
export default async function PreferredLayout({ children, params }: { children: React.ReactNode } & LangParams) {
  if (!ASSOCIATE_PORTAL_OPEN) return <PortalClosed t={messagesFor(await resolveLocale(params)).associates.closed} />
  return (
    <ClerkProvider>
      <AssociateQueryProvider signInPath="/preferred/sign-in">{children}</AssociateQueryProvider>
    </ClerkProvider>
  )
}
