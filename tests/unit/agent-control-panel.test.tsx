import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AgentsPage from '@/app/(internal)/dashboard/agents/page'
import type { GovernanceAgentsResponse, AgentAuditResponse } from '@/lib/dashboard/types'

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

const mockUseUser = vi.fn()
vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
}))

const mockUseGovernanceAgents = vi.fn()
const mockUseAgentAudit = vi.fn()
const mockToggleMutate = vi.fn()
const mockToggleMutateAsync = vi.fn()

vi.mock('@/lib/dashboard/api-client', () => ({
  useGovernanceAgents: () => mockUseGovernanceAgents(),
  useAgentAudit: (agentId: string) => mockUseAgentAudit(agentId),
  useToggleAgent: () => ({ mutate: mockToggleMutate, mutateAsync: mockToggleMutateAsync, isPending: false }),
}))

const AGENTS_RESPONSE: GovernanceAgentsResponse = {
  agents: [
    { id: 'sales_agent', name: 'Nova (Sales Agent)', enabled: true, override_source: 'env_var', daily_action_limit_per_lead: 60 },
    { id: 'proposal_agent', name: 'Proposal Agent', enabled: true, override_source: 'env_var', daily_action_limit_per_lead: 60 },
    { id: 'memory_agent', name: 'Memory Agent', enabled: false, override_source: 'database', daily_action_limit_per_lead: 60 },
  ],
  action_budget: { replies_per_lead_per_24h: 60, scope: 'reply_to_customer' },
}

const EMPTY_AUDIT: AgentAuditResponse = { agent_id: 'x', items: [] }

beforeEach(() => {
  vi.clearAllMocks()
  mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
  mockUseGovernanceAgents.mockReturnValue({ data: AGENTS_RESPONSE, isLoading: false, error: null, refetch: vi.fn() })
  mockUseAgentAudit.mockImplementation((agentId: string) => ({
    data: { agent_id: agentId, items: [] } as AgentAuditResponse,
    isLoading: false,
    error: null,
  }))
})

describe('AgentsPage — Agent Control Panel', () => {
  it('renders one card per agent with its status and action budget', () => {
    render(<AgentsPage />)
    expect(screen.getByText('Nova (Sales Agent)')).toBeInTheDocument()
    expect(screen.getByText('Proposal Agent')).toBeInTheDocument()
    expect(screen.getByText('Memory Agent')).toBeInTheDocument()
    expect(screen.getAllByText('Active')).toHaveLength(2)
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.getAllByText('60 replies / lead / 24h')).toHaveLength(3)
  })

  it('shows recent activity pulled from the per-agent audit endpoint', () => {
    mockUseAgentAudit.mockImplementation((agentId: string) => ({
      data:
        agentId === 'sales_agent'
          ? {
              agent_id: 'sales_agent',
              items: [
                { action: 'kill_switch_toggled', performed_by: 'emp-admin-1', before_value: null, after_value: null, created_at: '2026-09-01T00:00:00Z' },
              ],
            }
          : EMPTY_AUDIT,
      isLoading: false,
      error: null,
    }))
    render(<AgentsPage />)
    expect(screen.getByText(/kill switch toggled/i)).toBeInTheDocument()
    expect(screen.getByText(/emp-admin-1/)).toBeInTheDocument()
  })

  it('warns before disabling an active agent, and does not toggle until confirmed', async () => {
    const user = userEvent.setup()
    render(<AgentsPage />)

    const switches = screen.getAllByRole('switch')
    // sales_agent is the first card and is currently enabled.
    await user.click(switches[0])

    expect(mockToggleMutateAsync).not.toHaveBeenCalled()
    expect(screen.getByText(/stops real customer conversations/i)).toBeInTheDocument()

    mockToggleMutateAsync.mockResolvedValue({ agent_id: 'sales_agent', enabled: false, updated_by: 'emp-admin-1' })
    await user.click(screen.getByRole('button', { name: /^disable$/i }))

    await waitFor(() =>
      expect(mockToggleMutateAsync).toHaveBeenCalledWith({ agentId: 'sales_agent', enabled: false })
    )
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('Nova (Sales Agent)'))
  })

  it('re-enables a disabled agent directly, with no warning dialog', async () => {
    const user = userEvent.setup()
    render(<AgentsPage />)

    const switches = screen.getAllByRole('switch')
    // memory_agent is the third card and is currently disabled.
    await user.click(switches[2])

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockToggleMutate).toHaveBeenCalledWith(
      { agentId: 'memory_agent', enabled: true },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    )
  })

  it('hides the page from non-admin roles', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'sales' } } })
    render(<AgentsPage />)

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Nova (Sales Agent)')).not.toBeInTheDocument()
  })
})
