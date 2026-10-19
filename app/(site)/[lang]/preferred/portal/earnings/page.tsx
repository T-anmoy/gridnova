import { Suspense } from 'react'
import PortalShell from '@/components/associate/PortalShell'
import PortalEarnings from '@/components/associate/PortalEarnings'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function PreferredPortalEarningsPage({ params }: LangParams) {
  const m = (await messagesFor(await resolveLocale(params))).associates
  return (
    <PortalShell base="/preferred/portal" active="earnings" showTerritory labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <Suspense fallback={null}>
        <PortalEarnings copy={m.portal.earnings} policyHref="/commission-policy" territory />
      </Suspense>
    </PortalShell>
  )
}
