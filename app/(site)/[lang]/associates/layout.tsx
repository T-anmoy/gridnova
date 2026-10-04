import { ClerkProvider } from '@clerk/nextjs'
import { AssociateQueryProvider } from '@/components/associate/AssociateQueryProvider'
import PortalClosed from '@/components/associate/PortalClosed'
import { ASSOCIATE_PORTAL_OPEN } from '@/lib/associates'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

// Scoped to /associates/* only — the rest of the public site stays free of
// Clerk/react-query so marketing pages don't pay for auth machinery they
// never use. Separate from the staff dashboard's ClerkProvider/QueryProvider
// (app/(internal)/dashboard/layout.tsx): different principal, different
// sign-in destination on session expiry. While the portal switch is closed
// every route here shows the "opening soon" page instead.
export default async function AssociatesLayout({ children, params }: { children: React.ReactNode } & LangParams) {
  if (!ASSOCIATE_PORTAL_OPEN) return <PortalClosed t={messagesFor(await resolveLocale(params)).associates.closed} />
  return (
    <ClerkProvider>
      <AssociateQueryProvider signInPath="/associates/sign-in">{children}</AssociateQueryProvider>
    </ClerkProvider>
  )
}
