import { PublicQueryProvider } from '@/components/associate/PublicQueryProvider'
import VerifyAssociateCard from '@/components/associate/VerifyAssociateCard'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function VerifyAssociatePage({
  params,
}: LangParams & { params: Promise<{ lang: string; id: string }> }) {
  const { id } = await params
  const m = (await messagesFor(await resolveLocale(params)))

  return (
    <main id="main-content" className="pt-[calc(var(--header-h)+3rem)] pb-24 px-6 min-h-screen bg-[#f7f9fc]">
      <PublicQueryProvider>
        <VerifyAssociateCard associateId={id} copy={m.associates.verify} />
      </PublicQueryProvider>
    </main>
  )
}
