import type { Metadata } from 'next'
import VerifyProposalCard from '@/components/studio-public/VerifyProposalCard'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

// The page a Studio proposal's QR opens: /verify/p/<code> (English, unprefixed) and its
// /hi and /bn versions. Never indexed (the verify layout, robots.ts and here).
export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const m = await messagesFor(await resolveLocale(params))
  return { title: m.proposalVerify.metaTitle, robots: { index: false, follow: false, nocache: true } }
}

export default async function VerifyProposalPage({ params }: LangParams & { params: Promise<{ lang: string; code: string }> }) {
  const { code } = await params
  const locale = await resolveLocale(params)
  const m = await messagesFor(locale)
  return (
    <main id="main-content" className="min-h-screen bg-[#f7f9fc] px-4 pb-24 pt-[calc(var(--header-h)+2rem)] sm:px-6">
      <VerifyProposalCard code={decodeURIComponent(code).trim().toUpperCase()} copy={m.proposalVerify} locale={locale} />
    </main>
  )
}
