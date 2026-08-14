'use client'

import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { classifyApiError, isRetryableError, backoffDelay } from '@/lib/dashboard/api-error'

// Session-expiry (401) is cross-cutting: whichever query/mutation hits it first
// signs the user out and sends them to Clerk sign-in with a clear reason. Guard
// so we only redirect once even if several requests fail together.
let redirectingForAuth = false
function handleAuthExpiry(error: unknown) {
  if (typeof window === 'undefined') return
  if (classifyApiError(error).kind !== 'auth') return
  if (redirectingForAuth) return
  redirectingForAuth = true
  toast.error('Your session expired — please sign in again')
  const returnTo = encodeURIComponent(window.location.pathname)
  window.location.href = `/dashboard/sign-in?redirect_url=${returnTo}`
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleAuthExpiry }),
        mutationCache: new MutationCache({ onError: handleAuthExpiry }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Retry only transient failures (429 / 5xx / network) with backoff;
            // never retry auth/permission/other 4xx — they won't self-resolve.
            retry: (failureCount, error) => isRetryableError(error) && failureCount < 3,
            retryDelay: (attemptIndex) => backoffDelay(attemptIndex),
          },
        },
      })
  )
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
