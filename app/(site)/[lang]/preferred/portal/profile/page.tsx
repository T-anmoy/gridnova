import PortalShell from '@/components/associate/PortalShell'
import PortalProfile from '@/components/associate/PortalProfile'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function PreferredPortalProfilePage({ params }: LangParams) {
  const m = messagesFor(await resolveLocale(params)).associates
  return (
    <PortalShell base="/preferred/portal" active="profile" showTerritory labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <PortalProfile copy={m.portal.associate.profile} />
    </PortalShell>
  )
}
