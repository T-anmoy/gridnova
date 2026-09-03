'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { ShieldOff, Bot } from 'lucide-react'
import { useGovernanceAgents, useToggleAgent, useAgentAudit } from '@/lib/dashboard/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatTimeAgo } from '@/lib/dashboard/utils'
import type { AgentId, GovernedAgent, Role } from '@/lib/dashboard/types'

// ApiError.message is a generic "API error 4xx" string — the backend's real
// detail lives in `.detail` and should be shown instead.
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.detail || err.message
  if (err instanceof Error) return err.message
  return fallback
}

function AgentActivity({ agentId }: { agentId: AgentId }) {
  const { data, isLoading, error } = useAgentAudit(agentId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="font-utility text-xs text-[#111827]/40">Couldn&apos;t load recent activity.</p>
  }

  const items = data?.items.slice(0, 5) ?? []

  if (items.length === 0) {
    return <p className="font-utility text-xs text-[#111827]/40">No recent activity.</p>
  }

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start justify-between gap-3 font-utility text-xs">
          <span className="text-[#111827]/70">
            {item.action.replace(/_/g, ' ')}
            {item.performed_by && <span className="text-[#111827]/40"> · {item.performed_by}</span>}
          </span>
          <span className="shrink-0 text-[#111827]/40">{formatTimeAgo(item.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}

function AgentCard({
  agent,
  onToggle,
}: {
  agent: GovernedAgent
  onToggle: (agent: GovernedAgent, enabled: boolean) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#2f5daa]" />
            <CardTitle className="font-display text-base">{agent.name}</CardTitle>
          </div>
          <Switch
            checked={agent.enabled}
            onCheckedChange={(checked) => onToggle(agent, checked)}
            aria-label={`Toggle ${agent.name}`}
          />
        </div>
        <CardDescription>
          <Badge variant={agent.enabled ? 'green' : 'gray'} className="text-xs">
            {agent.enabled ? 'Active' : 'Disabled'}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-utility text-xs font-semibold text-[#111827]/50 uppercase tracking-wider mb-1">
            Action budget
          </p>
          <p className="font-utility text-sm text-[#091c3c]">
            {agent.daily_action_limit_per_lead} replies / lead / 24h
          </p>
        </div>

        <Separator />

        <div>
          <p className="font-utility text-xs font-semibold text-[#111827]/50 uppercase tracking-wider mb-2">
            Recent activity
          </p>
          <AgentActivity agentId={agent.id} />
        </div>
      </CardContent>
    </Card>
  )
}

export default function AgentsPage() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined

  const [pendingDisable, setPendingDisable] = useState<GovernedAgent | null>(null)

  const { data, isLoading, error, refetch } = useGovernanceAgents()
  const toggleAgent = useToggleAgent()

  // Admin-only, same conditional-render pattern used on the Employees page.
  if (role && role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ShieldOff className="h-12 w-12 text-[#111827]/20 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold text-[#091c3c]">Access Denied</p>
          <p className="font-utility text-sm text-[#111827]/50 mt-1">Only administrators can manage AI agents.</p>
        </div>
      </div>
    )
  }

  function handleToggle(agent: GovernedAgent, enabled: boolean) {
    if (!enabled) {
      setPendingDisable(agent)
      return
    }
    toggleAgent.mutate(
      { agentId: agent.id, enabled: true },
      {
        onSuccess: () => toast.success(`${agent.name} is now active`),
        onError: (err) => toast.error(errorMessage(err, 'Failed to enable agent')),
      }
    )
  }

  async function confirmDisable() {
    if (!pendingDisable) return
    try {
      await toggleAgent.mutateAsync({ agentId: pendingDisable.id, enabled: false })
      toast.success(`${pendingDisable.name} has been disabled`)
      setPendingDisable(null)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to disable agent'))
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">Agent Control Panel</h1>
        <p className="font-utility text-sm text-[#111827]/50 mt-1">
          Kill switches and action budgets for every AI agent in the system.
        </p>
      </div>

      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-4">
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(data?.agents ?? []).map((agent) => (
            <AgentCard key={agent.id} agent={agent} onToggle={handleToggle} />
          ))}
        </div>
      )}

      {/* Confirm disable dialog */}
      <Dialog open={!!pendingDisable} onOpenChange={(open) => { if (!open) setPendingDisable(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable {pendingDisable?.name}?</DialogTitle>
            <DialogDescription>
              This stops real customer conversations handled by this agent immediately. Any customer
              currently talking to it will be handed off without a response until it&apos;s re-enabled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDisable(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmDisable()} disabled={toggleAgent.isPending}>
              {toggleAgent.isPending ? 'Disabling...' : 'Disable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
