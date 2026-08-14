import { cn } from '@/lib/dashboard/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-[#e4e8ee]', className)}
      {...props}
    />
  )
}

export { Skeleton }
