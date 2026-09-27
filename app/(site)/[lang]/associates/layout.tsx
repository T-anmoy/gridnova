import { ClerkProvider } from '@clerk/nextjs'
import { AssociateQueryProvider } from '@/components/associate/AssociateQueryProvider'

// Scoped to /associates/* only — the rest of the public site stays free of
// Clerk/react-query so marketing pages don't pay for auth machinery they
// never use. Separate from the staff dashboard's ClerkProvider/QueryProvider
// (app/(internal)/dashboard/layout.tsx): different principal, different
// sign-in destination on session expiry.
export default function AssociatesLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <AssociateQueryProvider signInPath="/associates/sign-in">{children}</AssociateQueryProvider>
    </ClerkProvider>
  )
}
