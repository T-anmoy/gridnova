import { OnlineProposal } from './OnlineProposal'

// The link Grid Nova sends by email and WhatsApp: FRONTEND_BASE_URL + "/proposal/" + token.
// The proposal is fetched in the browser (see lib/studio/public-api.ts for why).
export default async function OnlineProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <OnlineProposal token={token} />
}
