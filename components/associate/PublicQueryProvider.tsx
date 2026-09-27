'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

// A plain query client for public, unauthenticated pages (e.g. /verify/[id])
// — no Clerk, no session-expiry redirect, since there's no session to expire.
export function PublicQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } }))
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
