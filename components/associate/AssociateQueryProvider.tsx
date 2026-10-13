'use client'

import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { useState } from 'react'
import { queryDefaults } from '@/lib/api/retry-policy'
import { createAuthExpiryHandler } from '@/lib/api/auth-expiry'

// Same shape as the staff dashboard's QueryProvider, but the session-expiry
// redirect goes to whichever of the two associate sign-in pages this tree
// belongs to — never /dashboard/sign-in, which is a different auth world.
export function AssociateQueryProvider({
  signInPath,
  children,
}: {
  signInPath: '/associates/sign-in' | '/preferred/sign-in'
  children: React.ReactNode
}) {
  const [queryClient] = useState(() => {
    const handleAuthExpiry = createAuthExpiryHandler({ signInPath })
    return new QueryClient({
      queryCache: new QueryCache({ onError: handleAuthExpiry }),
      mutationCache: new MutationCache({ onError: handleAuthExpiry }),
      defaultOptions: { queries: queryDefaults },
    })
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
