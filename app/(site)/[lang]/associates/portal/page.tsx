import PortalShell from '@/components/associate/PortalShell'
import PortalHome from '@/components/associate/PortalHome'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function AssociatePortalHomePage({ params }: LangParams) {
  const m = (await messagesFor(await resolveLocale(params))).associates
  return (
    <PortalShell base="/associates/portal" active="home" showTerritory={false} labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <PortalHome copy={m.portal.associate.home} feed={m.portal.feed} stageNames={m.portal.execution.stages} portalBase="/associates/portal" />
    </PortalShell>
  )
}
