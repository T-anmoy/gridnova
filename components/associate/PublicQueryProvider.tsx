'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { queryDefaults } from '@/lib/api/retry-policy'

// A plain query client for public, unauthenticated pages (e.g. /verify/[id])
// — no Clerk, no session-expiry redirect, since there's no session to expire.
// Same retry policy as the signed-in providers (lib/api/retry-policy.ts).
export function PublicQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: queryDefaults } }))
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
