import * as React from 'react'
import { cn } from '@/lib/dashboard/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-lg border border-[#e4e8ee] bg-white px-3 py-2 text-base md:text-sm font-utility text-[#111827] shadow-sm placeholder:text-[#111827]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7a800] disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
