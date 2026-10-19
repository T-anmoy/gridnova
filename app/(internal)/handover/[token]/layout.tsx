import type { Metadata } from 'next'

// The page is reached only through a private link that grants the customer's warranty and service
// details: never indexed (robots.txt disallows /handover/ too, and the API sends X-Robots-Tag).
export const metadata: Metadata = {
  title: 'Your Solar System',
  description: 'Your Grid Nova Energy handover pack, warranty and service requests.',
  robots: { index: false, follow: false },
}

export default function HandoverLayout({ children }: { children: React.ReactNode }) {
  return children
}
