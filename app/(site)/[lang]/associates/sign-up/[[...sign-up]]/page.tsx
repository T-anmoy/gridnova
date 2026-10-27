import { redirect } from 'next/navigation'
import { InvitationSignUp } from '@/components/auth/InvitationSignUp'
import PortalHomeLink from '@/components/associate/PortalHomeLink'
import { invitationEntry, signInWithTicket } from '@/lib/auth/invitation'
import { localizeHref } from '@/lib/i18n/config'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

// ASSOCIATE_INVITE_REDIRECT_URL points here: an approved associate's invitation link. Only
// the link opens the sign-up; anyone else is sent to the associate sign-in page.
type Props = LangParams & { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function AssociateSignUpPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params)
  const m = (await messagesFor(locale)).associates.signUp
  const signIn = localizeHref('/associates/sign-in', locale)
  const entry = invitationEntry(await searchParams)
  if (entry.kind === 'no_ticket') redirect(signIn)
  if (entry.kind === 'sign_in') redirect(signInWithTicket(signIn, entry.ticket))

  return (
    <main id="main-content" className="pt-[calc(env(safe-area-inset-top)+1rem)] pb-24 min-h-screen bg-[#091c3c] flex flex-col items-center px-4 sm:px-6">
      <div className="w-full max-w-md">
        <PortalHomeLink tone="dark" />
      </div>
      <div className="mt-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold text-white">{m.title}</h1>
          <p className="mt-1 font-utility text-sm text-white/50">{m.subtitle}</p>
        </div>
        <InvitationSignUp
          ticket={entry.ticket}
          path={localizeHref('/associates/sign-up', locale)}
          signInPath={signIn}
          afterUrl={localizeHref('/associates/portal', locale)}
          copy={{ checking: m.checking, expiredTitle: m.expiredTitle, expiredBody: m.expiredBody, signInInstead: m.signInInstead }}
        />
      </div>
    </main>
  )
}
