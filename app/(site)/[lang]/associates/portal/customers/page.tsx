import PortalShell from '@/components/associate/PortalShell'
import CustomersList from '@/components/associate/CustomersList'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function AssociatePortalCustomersPage({ params }: LangParams) {
  const m = messagesFor(await resolveLocale(params)).associates
  return (
    <PortalShell base="/associates/portal" active="customers" showTerritory={false} labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <CustomersList copy={m.portal.customers} nextStepCopy={m.portal.shared.nextStep} actionNeededLabel={m.portal.feed.actionNeeded} portalBase="/associates/portal" />
    </PortalShell>
  )
}
