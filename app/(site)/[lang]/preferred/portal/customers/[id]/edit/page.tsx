import PortalShell from '@/components/associate/PortalShell'
import EditOnboardingWizard from '@/components/associate/EditOnboardingWizard'
import { messagesFor, resolveLocale } from '@/lib/i18n/messages'

export default async function PreferredPortalEditCustomerPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const resolved = await params
  const m = messagesFor(await resolveLocale(params)).associates
  return (
    <PortalShell base="/preferred/portal" active="customers" showTerritory labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <EditOnboardingWizard onboardingId={Number(resolved.id)} copy={m.portal.wizard} portalBase="/preferred/portal" />
    </PortalShell>
  )
}
