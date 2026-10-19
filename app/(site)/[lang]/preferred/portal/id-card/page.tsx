import PortalShell from '@/components/associate/PortalShell'
import PortalIdCard from '@/components/associate/PortalIdCard'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function PreferredPortalIdCardPage({ params }: LangParams) {
  const m = (await messagesFor(await resolveLocale(params))).associates
  return (
    <PortalShell base="/preferred/portal" active="idCard" showTerritory labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <PortalIdCard copy={m.portal.associate.idCard} />
    </PortalShell>
  )
}
