import * as React from 'react'
import { cn } from '@/lib/dashboard/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-lg border border-[#e4e8ee] bg-white px-3 py-1 text-base md:text-sm font-utility text-[#111827] shadow-sm transition-colors placeholder:text-[#111827]/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7a800] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
