import PortalShell from '@/components/associate/PortalShell'
import PortalTerritory from '@/components/associate/PortalTerritory'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function PreferredPortalTerritoryPage({ params }: LangParams) {
  const m = (await messagesFor(await resolveLocale(params))).associates
  return (
    <PortalShell base="/preferred/portal" active="territory" showTerritory labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <PortalTerritory copy={m.portal.preferred.territory} />
    </PortalShell>
  )
}
