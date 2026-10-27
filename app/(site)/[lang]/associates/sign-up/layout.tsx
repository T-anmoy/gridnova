import type { Metadata } from 'next'

// Invitation-only sign-up: keep it out of search results (robots.txt also disallows it).
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
