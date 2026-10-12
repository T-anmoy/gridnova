import PortalShell from '@/components/associate/PortalShell'
import EditOnboardingWizard from '@/components/associate/EditOnboardingWizard'
import { messagesFor, resolveLocale } from '@/lib/i18n/messages'

export default async function PreferredPortalEditCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>
  searchParams: Promise<{ step?: string }>
}) {
  const resolved = await params
  const step = (await searchParams).step
  const m = messagesFor(await resolveLocale(params)).associates
  return (
    <PortalShell base="/preferred/portal" active="customers" showTerritory labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <EditOnboardingWizard onboardingId={Number(resolved.id)} copy={m.portal.wizard} territory={m.territory} portalBase="/preferred/portal" initialStep={step === 'house' || step === 'survey' ? step : undefined} />
    </PortalShell>
  )
}
