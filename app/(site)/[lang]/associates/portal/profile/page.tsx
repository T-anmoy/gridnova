import PortalShell from '@/components/associate/PortalShell'
import PortalProfile from '@/components/associate/PortalProfile'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function AssociatePortalProfilePage({ params }: LangParams) {
  const m = messagesFor(await resolveLocale(params)).associates
  return (
    <PortalShell base="/associates/portal" active="profile" showTerritory={false} labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <PortalProfile copy={m.portal.associate.profile} />
    </PortalShell>
  )
}
