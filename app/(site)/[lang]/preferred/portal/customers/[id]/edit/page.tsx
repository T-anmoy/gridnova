import PortalShell from '@/components/associate/PortalShell'
import EditOnboardingWizard from '@/components/associate/EditOnboardingWizard'
import { asDeepStep } from '@/lib/associate/survey-review'
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
  const m = (await messagesFor(await resolveLocale(params))).associates
  return (
    <PortalShell base="/preferred/portal" active="customers" showTerritory labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <EditOnboardingWizard onboardingId={Number(resolved.id)} copy={m.portal.wizard} territory={m.territory} portalBase="/preferred/portal" initialStep={asDeepStep(step)} />
    </PortalShell>
  )
}
