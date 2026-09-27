'use client'

import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { classifyApiError, isRetryableError, backoffDelay } from '@/lib/dashboard/api-error'

// Same shape as the staff dashboard's QueryProvider, but the session-expiry
// redirect goes to whichever of the two associate sign-in pages this tree
// belongs to — never /dashboard/sign-in, which is a different auth world.
let redirectingForAuth = false

export function AssociateQueryProvider({
  signInPath,
  children,
}: {
  signInPath: '/associates/sign-in' | '/preferred/sign-in'
  children: React.ReactNode
}) {
  const [queryClient] = useState(() => {
    function handleAuthExpiry(error: unknown) {
      if (typeof window === 'undefined') return
      if (classifyApiError(error).kind !== 'auth') return
      if (redirectingForAuth) return
      redirectingForAuth = true
      toast.error('Your session expired — please sign in again')
      const returnTo = encodeURIComponent(window.location.pathname)
      window.location.href = `${signInPath}?redirect_url=${returnTo}`
    }
    return new QueryClient({
      queryCache: new QueryCache({ onError: handleAuthExpiry }),
      mutationCache: new MutationCache({ onError: handleAuthExpiry }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: (failureCount, error) => isRetryableError(error) && failureCount < 3,
          retryDelay: (attemptIndex) => backoffDelay(attemptIndex),
        },
      },
    })
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
