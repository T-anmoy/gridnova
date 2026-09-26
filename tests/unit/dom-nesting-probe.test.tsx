import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import AgentsPage from '@/app/(internal)/dashboard/agents/page'
import type { GovernanceAgentsResponse } from '@/lib/dashboard/types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@clerk/nextjs', () => ({ useUser: () => ({ user: { publicMetadata: { role: 'admin' } } }) }))

const AGENTS_RESPONSE: GovernanceAgentsResponse = {
  agents: [
    { id: 'sales_agent', name: 'Nova (Sales Agent)', enabled: true, override_source: 'env_var', daily_action_limit_per_lead: 60 },
  ],
  action_budget: { replies_per_lead_per_24h: 60, scope: 'reply_to_customer' },
}

vi.mock('@/lib/dashboard/api-client', () => ({
  useGovernanceAgents: () => ({ data: AGENTS_RESPONSE, isLoading: false, error: null, refetch: vi.fn() }),
  useAgentAudit: () => ({ data: { agent_id: 'x', items: [] }, isLoading: false, error: null }),
  useToggleAgent: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}))

describe('DOM nesting probe', () => {
  it('does not warn about invalid <div>-in-<p> nesting', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<AgentsPage />)
    const nestingWarnings = spy.mock.calls.filter((args) =>
      String(args[0]).includes('cannot be a descendant of')
    )
    spy.mockRestore()
    expect(nestingWarnings).toEqual([])
  })
})
