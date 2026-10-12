'use client'

import { useRouter } from 'next/navigation'

// The server re-fetches the proposal on refresh; nothing is cached.
export function RetryButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="mt-6 inline-flex items-center rounded-full bg-[#091c3c] text-white font-utility text-sm font-semibold px-5 py-2.5 min-h-11 hover:bg-[#0e2a63] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7a800]"
    >
      Try again
    </button>
  )
}
