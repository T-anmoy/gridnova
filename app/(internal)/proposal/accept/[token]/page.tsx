import { loadProposal } from '@/lib/proposal-accept-load'
import type { AcceptView } from '@/lib/proposal-accept'
import { AcceptPanel } from './AcceptPanel'
import { AcceptedBody, MessageScreen, Shell, isMessageScreen } from './AcceptShell'

// The summary is fetched here, on the server, with no caching: the customer
// gets the proposal in the first HTML instead of a JS → hydrate → fetch
// spinner chain, and a superseded/expired link is never served from a cache.
export const dynamic = 'force-dynamic'

export default async function ProposalAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { screen, view } = await loadProposal(token)

  if (isMessageScreen(screen)) return <MessageScreen screen={screen} />
  if (screen === 'accepted') {
    return (
      <Shell>
        <AcceptedBody view={view} token={token} />
      </Shell>
    )
  }
  return <AcceptPanel token={token} view={view as AcceptView} />
}
