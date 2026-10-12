import Link from '@/components/i18n/Link'

// The portals and their sign-in pages have no marketing header (SiteChrome
// leaves it out), so this small wordmark is their way back to the website.
export default function PortalHomeLink({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <Link
      href="/"
      className={`inline-flex min-h-[44px] items-center font-display text-lg font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7a800] ${
        tone === 'dark' ? 'text-white' : 'text-[#091c3c]'
      }`}
    >
      Grid <span className="ml-1 text-[#f7a800]">Nova</span>
    </Link>
  )
}
