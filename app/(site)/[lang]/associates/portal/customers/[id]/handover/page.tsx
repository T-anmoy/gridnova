import { Suspense } from 'react'
import PortalShell from '@/components/associate/PortalShell'
import PortalHandover from '@/components/associate/PortalHandover'
import { messagesFor, resolveLocale } from '@/lib/i18n/messages'

export default async function AssociatesPortalHandoverPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const resolved = await params
  const m = (await messagesFor(await resolveLocale(params))).associates
  return (
    <PortalShell base="/associates/portal" active="customers" showTerritory={false} labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <Suspense fallback={null}>
        <PortalHandover onboardingId={Number(resolved.id)} portalBase="/associates/portal" copy={m.portal.handover} words={m.portal.feed.service} />
      </Suspense>
    </PortalShell>
  )
}
