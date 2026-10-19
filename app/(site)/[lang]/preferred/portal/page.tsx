import PortalShell from '@/components/associate/PortalShell'
import PortalHome from '@/components/associate/PortalHome'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function PreferredPortalHomePage({ params }: LangParams) {
  const m = (await messagesFor(await resolveLocale(params))).associates
  return (
    <PortalShell base="/preferred/portal" active="home" showTerritory labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <PortalHome copy={m.portal.preferred.home} feed={m.portal.feed} stageNames={m.portal.execution.stages} portalBase="/preferred/portal" />
    </PortalShell>
  )
}
