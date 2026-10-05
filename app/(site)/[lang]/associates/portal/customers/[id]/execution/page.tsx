import PortalShell from '@/components/associate/PortalShell'
import ExecutionChecklist from '@/components/associate/ExecutionChecklist'
import { messagesFor, resolveLocale } from '@/lib/i18n/messages'

export default async function AssociatesPortalExecutionPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const resolved = await params
  const m = messagesFor(await resolveLocale(params)).associates
  return (
    <PortalShell base="/associates/portal" active="customers" showTerritory={false} labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <ExecutionChecklist onboardingId={Number(resolved.id)} portalBase="/associates/portal" copy={m.portal.execution} photosCopy={m.portal.wizard.photos} />
    </PortalShell>
  )
}
