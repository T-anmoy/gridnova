import PortalShell from '@/components/associate/PortalShell'
import OnboardingWizard from '@/components/associate/OnboardingWizard'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function PreferredPortalNewCustomerPage({ params }: LangParams) {
  const m = messagesFor(await resolveLocale(params)).associates
  return (
    <PortalShell base="/preferred/portal" active="customers" showTerritory labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <OnboardingWizard copy={m.portal.wizard} portalBase="/preferred/portal" />
    </PortalShell>
  )
}
