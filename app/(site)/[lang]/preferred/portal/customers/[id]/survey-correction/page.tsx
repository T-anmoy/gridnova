import PortalShell from '@/components/associate/PortalShell'
import CorrectionRequest from '@/components/associate/survey/CorrectionRequest'
import { messagesFor, resolveLocale } from '@/lib/i18n/messages'

export default async function PreferredSurveyCorrectionPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const resolved = await params
  const m = messagesFor(await resolveLocale(params)).associates
  return (
    <PortalShell base="/preferred/portal" active="customers" showTerritory={true} labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <CorrectionRequest onboardingId={Number(resolved.id)} portalBase="/preferred/portal" />
    </PortalShell>
  )
}
