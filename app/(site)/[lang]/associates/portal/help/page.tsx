import PortalShell from '@/components/associate/PortalShell'
import PortalHelp from '@/components/associate/PortalHelp'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function AssociatePortalHelpPage({ params }: LangParams) {
  const m = messagesFor(await resolveLocale(params)).associates
  return (
    <PortalShell base="/associates/portal" active="help" showTerritory={false} labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <PortalHelp copy={m.portal.associate.help} />
    </PortalShell>
  )
}
