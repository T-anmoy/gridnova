import { FileX2, Clock } from 'lucide-react'
import { Card, Shell } from '@/app/(internal)/proposal/accept/[token]/AcceptShell'
import { loadPublicHandover, loadPublicRequests } from '@/lib/handover/public'
import HandoverView from './HandoverView'

// Fetched on the server, never cached: a revoked or replaced link must stop working at once.
export const dynamic = 'force-dynamic'

const MESSAGES = {
  notfound: { title: 'This link is not valid', body: 'This handover link is invalid, has been replaced by a newer one, or is no longer active. Please contact our team and we will send you a new link.', icon: FileX2 },
  ratelimited: { title: 'Please try again in a minute', body: 'This page has been opened too many times in a short while. Wait a minute and refresh.', icon: Clock },
  error: { title: 'We could not load this page', body: 'We had trouble loading your handover details. Please refresh the page, or try again shortly.', icon: FileX2 },
} as const

export default async function HandoverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [{ screen, view }, requests] = await Promise.all([loadPublicHandover(token), loadPublicRequests(token)])

  if (screen !== 'ready' || !view) {
    const m = MESSAGES[screen === 'ready' ? 'error' : screen]
    const Icon = m.icon
    return (
      <Shell>
        <Card>
          <Icon className="h-10 w-10 text-[#111827]/65" aria-hidden="true" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-[#091c3c]">{m.title}</h1>
          <p className="mt-2 font-utility text-sm leading-relaxed text-[#111827]/60">{m.body}</p>
          <p className="mt-6 font-utility text-xs text-[#111827]/65">
            Questions? Email{' '}
            <a href="mailto:info@gridnova.in" className="inline-flex min-h-11 items-center font-medium text-[#0e2a63] hover:underline focus-visible:outline-2 focus-visible:outline-[#f7a800]">
              info@gridnova.in
            </a>
          </p>
        </Card>
      </Shell>
    )
  }
  return (
    <Shell>
      <HandoverView token={token} view={view} initialRequests={requests} />
    </Shell>
  )
}
