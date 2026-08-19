import type { Metadata } from 'next'

// A page-specific title (this previously inherited the root layout's
// homepage title) and an explicit noindex — this URL can carry customer
// PII (name, email, project details) tied to a bearer token, so it should
// never be indexed, same protection the /dashboard route gets.
export const metadata: Metadata = {
  // The root layout's title.template appends " | Grid Nova Energy" —
  // passing just the page-specific part here, not the full suffixed string.
  title: 'Your Solar Proposal',
  description: 'Review and accept your Grid Nova Energy solar proposal.',
  robots: { index: false, follow: false },
}

export default function ProposalAcceptLayout({ children }: { children: React.ReactNode }) {
  return children
}
