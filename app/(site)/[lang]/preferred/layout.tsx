import { ClerkProvider } from '@clerk/nextjs'
import { AssociateQueryProvider } from '@/components/associate/AssociateQueryProvider'

// Scoped to /preferred/* only — see app/(site)/[lang]/associates/layout.tsx
// for why this is a separate provider from both the staff dashboard and the
// plain Associate portal.
export default function PreferredLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <AssociateQueryProvider signInPath="/preferred/sign-in">{children}</AssociateQueryProvider>
    </ClerkProvider>
  )
}
