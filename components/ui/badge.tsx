import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/dashboard/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold font-utility transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#091c3c] text-white',
        secondary: 'border-transparent bg-[#f7f9fc] text-[#111827]',
        gold: 'border-transparent bg-[#f7a800] text-[#091c3c]',
        amber: 'border-transparent bg-amber-100 text-amber-800',
        blue: 'border-transparent bg-blue-100 text-blue-800',
        green: 'border-transparent bg-green-100 text-green-800',
        orange: 'border-transparent bg-orange-100 text-orange-800',
        red: 'border-transparent bg-red-100 text-red-800',
        gray: 'border-transparent bg-gray-100 text-gray-700',
        navy: 'border-transparent bg-[#091c3c] text-white',
        outline: 'border-[#e4e8ee] text-[#111827]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
