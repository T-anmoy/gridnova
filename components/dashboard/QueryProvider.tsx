'use client'

import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { useState } from 'react'
import { queryDefaults } from '@/lib/api/retry-policy'
import { createAuthExpiryHandler } from '@/lib/api/auth-expiry'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const handleAuthExpiry = createAuthExpiryHandler({ signInPath: '/dashboard/sign-in' })
    return new QueryClient({
      queryCache: new QueryCache({ onError: handleAuthExpiry }),
      mutationCache: new MutationCache({ onError: handleAuthExpiry }),
      defaultOptions: { queries: queryDefaults },
    })
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
