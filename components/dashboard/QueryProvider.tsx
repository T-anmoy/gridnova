'use client'

import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { queryDefaults } from '@/lib/api/retry-policy'
import { createAuthExpiryHandler } from '@/lib/api/auth-expiry'
import { toast } from 'sonner'
import { isTwoFactorRequired } from '@/lib/access/errors'

/**
 * BE-17 §7: a sensitive action without two-step verification is refused with 403
 * `two_factor_required`, wherever it happens. One toast leads to the guided setup page.
 */
export function handleTwoFactorRequired(error: unknown, navigate: (href: string) => void) {
  if (typeof window === 'undefined' || !isTwoFactorRequired(error)) return
  toast.error('This needs two-step verification.', {
    id: 'two-factor-required',
    description: 'Turn it on in your account security settings, then try again.',
    action: { label: 'Set it up', onClick: () => navigate('/dashboard/two-step') },
  })
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // The App Router's router object is stable, so the once-created client can keep it.
  const router = useRouter()
  const [queryClient] = useState(() => {
    const handleAuthExpiry = createAuthExpiryHandler({ signInPath: '/dashboard/sign-in' })
    const onError = (e: unknown) => {
      handleAuthExpiry(e)
      handleTwoFactorRequired(e, (href) => router.push(href))
    }
    return new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: { queries: queryDefaults },
    })
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
