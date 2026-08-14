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
              colorPrimary: '#f7a800',
              colorBackground: '#0e2a63',
              fontFamily: 'IBM Plex Sans, sans-serif',
              borderRadius: '0.5rem',
            },
            elements: {
              card: 'shadow-2xl border border-white/10',
              headerTitle: 'text-white font-display',
              headerSubtitle: 'text-white/60 font-utility',
              formButtonPrimary: 'bg-[#f7a800] hover:bg-[#ffd27a] text-[#091c3c] font-utility font-semibold',
              footerAction: 'hidden',
            },
          }}
        />
      </div>
    </div>
  )
}
