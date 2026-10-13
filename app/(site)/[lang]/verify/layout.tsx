import type { Metadata } from 'next'

// Per-person verification landing pages (reached from an ID-card QR code): not for search results.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
