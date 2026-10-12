import { SignIn } from '@clerk/nextjs'
import PortalHomeLink from '@/components/associate/PortalHomeLink'
import { messagesFor, resolveLocale, type LangParams } from '@/lib/i18n/messages'

export default async function AssociateSignInPage({ params }: LangParams) {
  const m = messagesFor(await resolveLocale(params)).associates.signIn

  return (
    <main className="pt-[calc(env(safe-area-inset-top)+1rem)] pb-24 min-h-screen bg-[#091c3c] flex flex-col items-center px-4 sm:px-6">
      <div className="w-full max-w-md">
        <PortalHomeLink tone="dark" />
      </div>
      <div className="mt-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold text-white">{m.title}</h1>
          <p className="mt-1 font-utility text-sm text-white/50">{m.subtitle}</p>
        </div>
        <SignIn
          routing="path"
          path="/associates/sign-in"
          forceRedirectUrl="/associates/portal"
          appearance={{
            variables: {
              colorPrimary: '#f7a800',
              colorPrimaryForeground: '#091c3c',
              colorBackground: '#0e2a63',
              colorForeground: '#ffffff',
              colorMutedForeground: 'rgba(255,255,255,0.55)',
              colorInput: 'rgba(255,255,255,0.07)',
              colorInputForeground: '#ffffff',
              colorNeutral: '#ffffff',
              fontFamily: 'IBM Plex Sans, sans-serif',
              borderRadius: '0.5rem',
            },
            elements: {
              card: 'shadow-2xl border border-white/10 bg-[#0e2a63]',
              headerTitle: 'text-white font-display',
              headerSubtitle: 'text-white/55 font-utility',
              formFieldLabel: 'text-white/75 font-utility text-sm',
              formFieldInput:
                'bg-white/[0.07] border-white/20 text-white placeholder:text-white/30 focus:border-[#f7a800] focus:ring-1 focus:ring-[#f7a800]/30',
              formFieldInputShowPasswordButton: 'text-white/40 hover:text-white/80',
              formFieldAction: 'text-[#f7a800] hover:text-[#ffd27a] font-utility',
              formButtonPrimary:
                'bg-[#f7a800] hover:bg-[#ffd27a] text-[#091c3c] font-utility font-semibold shadow-none',
              socialButtonsBlockButton:
                'border border-white/20 bg-white/[0.04] text-white/85 hover:bg-white/10 hover:border-white/35 transition-colors',
              socialButtonsBlockButtonText: 'font-utility text-white/85',
              socialButtonsBlockButtonArrow: 'text-white/50',
              dividerLine: 'bg-white/15',
              dividerText: 'text-white/35 font-utility',
              footerActionText: 'text-white/40 font-utility',
              footerActionLink: 'text-[#f7a800] hover:text-[#ffd27a] font-utility',
              footer: 'opacity-40',
              formFieldErrorText: 'text-red-400 font-utility',
              alertText: 'text-white/80 font-utility',
            },
          }}
        />
      </div>
    </main>
  )
}
