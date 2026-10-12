'use client'

import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { useState } from 'react'
import { isRetryableError, backoffDelay } from '@/lib/dashboard/api-error'
import { createAuthExpiryHandler } from '@/lib/api/auth-expiry'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const handleAuthExpiry = createAuthExpiryHandler({ signInPath: '/dashboard/sign-in' })
    return new QueryClient({
      queryCache: new QueryCache({ onError: handleAuthExpiry }),
      mutationCache: new MutationCache({ onError: handleAuthExpiry }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          // Off globally; work queues and the activity feed opt back in.
          refetchOnWindowFocus: false,
          // Retry only transient failures (429 / 5xx / network) with backoff;
          // never retry auth/permission/other 4xx — they won't self-resolve.
          retry: (failureCount, error) => isRetryableError(error) && failureCount < 3,
          retryDelay: (attemptIndex) => backoffDelay(attemptIndex),
        },
      },
    })
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
