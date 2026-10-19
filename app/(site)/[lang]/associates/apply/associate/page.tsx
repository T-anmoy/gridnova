import AssociateApplyForm from '@/components/associate/AssociateApplyForm'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function ApplyAssociatePage({ params }: LangParams) {
  const m = (await messagesFor(await resolveLocale(params)))
  return (
    <main id="main-content" className="pt-[calc(var(--header-h)+3rem)] pb-24 px-6 md:px-10 bg-[#f7f9fc] min-h-screen">
      <AssociateApplyForm kind="associate" t={m.associates} />
    </main>
  )
}
