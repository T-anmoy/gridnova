import PortalShell from '@/components/associate/PortalShell'
import PortalPayments from '@/components/associate/PortalPayments'
import { messagesFor, resolveLocale } from '@/lib/i18n/messages'

export default async function PreferredPortalPaymentsPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const resolved = await params
  const m = (await messagesFor(await resolveLocale(params))).associates
  return (
    <PortalShell base="/preferred/portal" active="customers" showTerritory={true} labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <PortalPayments onboardingId={Number(resolved.id)} portalBase="/preferred/portal" copy={m.portal.payments} />
    </PortalShell>
  )
}
