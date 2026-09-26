import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#091c3c] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold text-white">Grid Nova AI</h1>
          <p className="mt-1 font-utility text-sm text-white/50">Internal Operations Platform</p>
        </div>
        <SignIn
          routing="path"
          path="/dashboard/sign-in"
          forceRedirectUrl="/dashboard"
          appearance={{
            variables: {
              // Core palette
              colorPrimary: '#f7a800',
              colorPrimaryForeground: '#091c3c',
              colorBackground: '#0e2a63',
              // Text — without these Clerk defaults to dark text on a dark card
              colorForeground: '#ffffff',
              colorMutedForeground: 'rgba(255,255,255,0.55)',
              // Inputs
              colorInput: 'rgba(255,255,255,0.07)',
              colorInputForeground: '#ffffff',
              // Borders / neutral chrome — light value keeps dark-theme contrast correct
              colorNeutral: '#ffffff',
              // Typography
              fontFamily: 'IBM Plex Sans, sans-serif',
              borderRadius: '0.5rem',
            },
            elements: {
              // Card surface
              card: 'shadow-2xl border border-white/10 bg-[#0e2a63]',
              // Header
              headerTitle: 'text-white font-display',
              headerSubtitle: 'text-white/55 font-utility',
              // Form labels & inputs
              formFieldLabel: 'text-white/75 font-utility text-sm',
              formFieldInput:
                'bg-white/[0.07] border-white/20 text-white placeholder:text-white/30 focus:border-[#f7a800] focus:ring-1 focus:ring-[#f7a800]/30',
              formFieldInputShowPasswordButton: 'text-white/40 hover:text-white/80',
              formFieldAction: 'text-[#f7a800] hover:text-[#ffd27a] font-utility',
              // Primary CTA
              formButtonPrimary:
                'bg-[#f7a800] hover:bg-[#ffd27a] text-[#091c3c] font-utility font-semibold shadow-none',
              // Social ("Continue with Google") button
              socialButtonsBlockButton:
                'border border-white/20 bg-white/[0.04] text-white/85 hover:bg-white/10 hover:border-white/35 transition-colors',
              socialButtonsBlockButtonText: 'font-utility text-white/85',
              socialButtonsBlockButtonArrow: 'text-white/50',
              // "or" divider
              dividerLine: 'bg-white/15',
              dividerText: 'text-white/35 font-utility',
              // Footer links ("Sign up", "Development mode")
              footerActionText: 'text-white/40 font-utility',
              footerActionLink: 'text-[#f7a800] hover:text-[#ffd27a] font-utility',
              // "Secured by Clerk" badge
              footer: 'opacity-40',
              // Error / alert text
              formFieldErrorText: 'text-red-400 font-utility',
              alertText: 'text-white/80 font-utility',
            },
          }}
        />
      </div>
    </div>
  )
}
