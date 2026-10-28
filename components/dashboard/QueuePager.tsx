'use client'

import { Button } from '@/components/ui/button'
import { pageCount } from '@/lib/dashboard/utils'

/** Previous / Next for a server-paginated list. The page itself lives in the URL. */
export function QueuePager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = pageCount(total, pageSize)
  if (total <= pageSize) return null
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4">
      <p className="text-sm text-gray-500" aria-live="polite">Page {page} of {pages} · {total} total</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </nav>
  )
}
