import { redirect } from 'next/navigation'
import { InvitationSignUp, OpenSignUp } from '@/components/auth/InvitationSignUp'
import PortalHomeLink from '@/components/associate/PortalHomeLink'
import { invitationEntry, signInWithTicket } from '@/lib/auth/invitation'
import { localizeHref } from '@/lib/i18n/config'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

// ASSOCIATE_INVITE_REDIRECT_URL points here: an approved associate's invitation link opens
// the invitation sign-up. BE-21: without a link the page is an ordinary sign-up, for an
// approved associate whose invitation email never arrived — they sign up with the address
// on their application and link the account in the portal (POST /associate/me/claim). The
// backend is the gate: anyone else is refused there.
type Props = LangParams & { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function AssociateSignUpPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params)
  const m = (await messagesFor(locale)).associates.signUp
  const signIn = localizeHref('/associates/sign-in', locale)
  const entry = invitationEntry(await searchParams)
  if (entry.kind === 'sign_in') redirect(signInWithTicket(signIn, entry.ticket))
  const open = entry.kind === 'no_ticket'
  const portal = localizeHref('/associates/portal', locale)

  return (
    <main id="main-content" className="pt-[calc(env(safe-area-inset-top)+1rem)] pb-24 min-h-screen bg-[#091c3c] flex flex-col items-center px-4 sm:px-6">
      <div className="w-full max-w-md">
        <PortalHomeLink tone="dark" />
      </div>
      <div className="mt-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold text-white">{open ? m.openTitle : m.title}</h1>
          <p className="mt-1 font-utility text-sm text-white/50">{open ? m.openSubtitle : m.subtitle}</p>
        </div>
        {open ? (
          <OpenSignUp path={localizeHref('/associates/sign-up', locale)} signInPath={signIn} afterUrl={portal} />
        ) : (
          <InvitationSignUp
            ticket={entry.ticket}
            path={localizeHref('/associates/sign-up', locale)}
            signInPath={signIn}
            afterUrl={portal}
            copy={{ checking: m.checking, expiredTitle: m.expiredTitle, expiredBody: m.expiredBody, signInInstead: m.signInInstead }}
          />
        )}
      </div>
    </main>
  )
}
