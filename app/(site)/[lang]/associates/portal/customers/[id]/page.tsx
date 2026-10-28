import PortalShell from '@/components/associate/PortalShell'
import OnboardingDetail from '@/components/associate/OnboardingDetail'
import { messagesFor, resolveLocale } from '@/lib/i18n/messages'

export default async function AssociatePortalCustomerDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const resolved = await params
  const m = (await messagesFor(await resolveLocale(params))).associates
  return (
    <PortalShell base="/associates/portal" active="customers" showTerritory={false} labels={m.portal.nav} signOutLabel={m.portal.nav.signOut}>
      <OnboardingDetail
        onboardingId={Number(resolved.id)}
        portalBase="/associates/portal"
        sharedCopy={m.portal.shared}
        proposalCopy={m.portal.proposal}
        agreementCopy={m.portal.agreement}
        checklistCopy={m.portal.checklist}
        documentLabels={m.portal.wizard.documents.typeLabels}
        estimateCopy={m.portal.estimate}
        executionCopy={m.portal.execution}
        paymentsCopy={m.portal.payments}
        handoverOpen={m.portal.handover.open}
      />
    </PortalShell>
  )
}
