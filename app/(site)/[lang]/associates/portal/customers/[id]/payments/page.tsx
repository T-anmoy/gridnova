import PortalShell from '@/components/associate/PortalShell'
import PortalPayments from '@/components/associate/PortalPayments'
import { messagesFor, resolveLocale } from '@/lib/i18n/messages'

export default async function AssociatesPortalPaymentsPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const resolved = await params
  const m = messagesFor(await resolveLocale(params)).associates
  return (
    <PortalShell base="/associates/portal" active="customers" showTerritory={false} labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <PortalPayments onboardingId={Number(resolved.id)} portalBase="/associates/portal" copy={m.portal.payments} />
    </PortalShell>
  )
}
