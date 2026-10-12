'use client'

import { useRouter } from 'next/navigation'
import { TableRow } from '@/components/ui/table'
import { cn } from '@/lib/dashboard/utils'

/**
 * A table row that navigates. A row alone is not a link to a keyboard or
 * screen-reader user, so it carries role="link", is focusable, and answers
 * Enter/Space. Put a real <Link> on the primary cell as well so "open in new
 * tab" and middle-click work.
 */
export function ClickableRow({ href, className, children, ...rest }: { href: string; className?: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof TableRow>, 'onClick' | 'onKeyDown' | 'href'>) {
  const router = useRouter()
  return (
    <TableRow
      {...rest}
      role="link"
      tabIndex={0}
      onClick={(e) => {
        // Let real links/buttons inside the row do their own thing.
        if ((e.target as HTMLElement).closest('a,button')) return
        router.push(href)
      }}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest('a,button')) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(href)
        }
      }}
      className={cn('cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#2f5daa]', className)}
    >
      {children}
    </TableRow>
  )
}
