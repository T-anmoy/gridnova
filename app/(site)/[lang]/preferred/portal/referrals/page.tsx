import PortalShell from '@/components/associate/PortalShell'
import PortalReferrals from '@/components/associate/PortalReferrals'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function PreferredPortalReferralsPage({ params }: LangParams) {
  const m = (await messagesFor(await resolveLocale(params))).associates
  return (
    <PortalShell base="/preferred/portal" active="referrals" showTerritory labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <PortalReferrals />
    </PortalShell>
  )
}
