'use client'

// Error boundary scoped to the /dashboard route group. Because it renders
// inside the dashboard layout, the sidebar stays mounted and usable — a crash
// in one page never takes down the whole shell.

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/monitoring'

export default function DashboardRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Only the digest goes to the console (the message can echo customer data);
    // reportError is a no-op until a sink is registered (docs/monitoring.md).
    console.error('Dashboard page error:', error.digest ?? '')
    reportError(error, { area: 'dashboard', digest: error.digest })
  }, [error])

  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-full max-w-md rounded-xl border border-[#e4e8ee] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="font-display text-xl font-semibold text-[#091c3c]">
          Something went wrong on this page
        </h2>
        <p className="mt-2 font-utility text-sm text-[#111827]/65 leading-relaxed">
          The rest of the dashboard is still available in the sidebar. You can retry this page, and
          if it keeps happening, let the team know.
        </p>
        {error.digest && (
          <p className="mt-3 font-utility text-[11px] text-[#111827]/65">Ref: {error.digest}</p>
        )}
        <Button className="mt-6" onClick={() => reset()}>Retry</Button>
      </div>
    </div>
  )
}
