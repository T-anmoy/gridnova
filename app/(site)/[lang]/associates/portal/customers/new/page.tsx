import PortalShell from '@/components/associate/PortalShell'
import OnboardingWizard from '@/components/associate/OnboardingWizard'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function AssociatePortalNewCustomerPage({ params }: LangParams) {
  const m = messagesFor(await resolveLocale(params)).associates
  return (
    <PortalShell base="/associates/portal" active="customers" showTerritory={false} labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <OnboardingWizard copy={m.portal.wizard} portalBase="/associates/portal" />
    </PortalShell>
  )
}
