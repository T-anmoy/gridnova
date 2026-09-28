import PortalShell from '@/components/associate/PortalShell'
import CustomersList from '@/components/associate/CustomersList'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function PreferredPortalCustomersPage({ params }: LangParams) {
  const m = messagesFor(await resolveLocale(params)).associates
  return (
    <PortalShell base="/preferred/portal" active="customers" showTerritory labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <CustomersList copy={m.portal.customers} nextStepCopy={m.portal.shared.nextStep} portalBase="/preferred/portal" />
    </PortalShell>
  )
}
