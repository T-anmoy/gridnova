import type { Metadata } from 'next'

// The customer's online Studio proposal (BE-18): a bearer link carrying the customer's name
// and prices — never indexed, never followed, never cached by search engines.
export const metadata: Metadata = {
  title: 'Your Solar Proposal',
  description: 'Read, download and accept your Grid Nova Energy solar proposal.',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  referrer: 'no-referrer',
}

export default function OnlineProposalLayout({ children }: { children: React.ReactNode }) {
  return children
}
