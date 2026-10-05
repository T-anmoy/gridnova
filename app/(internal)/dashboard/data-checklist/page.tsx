'use client'

import { useState } from 'react'
import { ClipboardCopy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import NoAccess from '@/components/dashboard/NoAccess'
import ReasonDialog from '@/components/dashboard/ReasonDialog'
import { AREA_LABEL, BLOCKING_LABEL, BLOCKING_ORDER, buildGridNovaMessage, isManual } from '@/lib/dashboard/placeholders'
import { usePlaceholders, useResolvePlaceholder, type PlaceholderItem } from '@/lib/dashboard/placeholders-api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'
import { formatDatetime } from '@/lib/dashboard/utils'

const BLOCKING_VARIANT = { blocks_launch: 'red', blocks_feature: 'amber', tunable: 'blue' } as const

function resolveError(err: unknown): string {
  if (err instanceof ApiError) {
    const code = err.structuredDetail?.code
    if (code === 'not_manual') return 'This entry resolves itself when its value is edited — it can’t be marked resolved by hand.'
    if (code === 'already_resolved') return 'This entry is already resolved.'
    if (err.status === 422) return 'A note is required.'
    if (err.status === 404) return 'That entry no longer exists.'
    if (err.status === 403) return 'Only an Admin can resolve entries.'
  }
  return 'Something went wrong. Please try again.'
}

function ItemRow({ item, canResolve, onResolve }: { item: PlaceholderItem; canResolve: boolean; onResolve: () => void }) {
  return (
    <li className="space-y-1 border-b border-gray-100 py-3 last:border-0" data-testid="checklist-item">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{item.id}</Badge>
        <Badge variant={BLOCKING_VARIANT[item.blocking] ?? 'gray'}>{BLOCKING_LABEL[item.blocking] ?? item.blocking}</Badge>
        {item.resolved ? <Badge variant="green">Resolved</Badge> : <Badge variant="orange" data-testid="dummy-chip">Dummy / pending Grid Nova</Badge>}
        {canResolve && !item.resolved && isManual(item) && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={onResolve}>Mark resolved</Button>
        )}
      </div>
      <p className="text-sm text-gray-800">{item.description}</p>
      <p className="font-mono text-[11px] text-gray-400">{item.location}</p>
      <p className="text-xs text-gray-500">Current value: <code className="break-all rounded bg-gray-100 px-1 py-0.5">{item.dummy_value}</code></p>
      <p className="text-sm text-[#0e2a63]"><span className="font-semibold">Needed from Grid Nova:</span> {item.needed_from_grid_nova}</p>
      {item.probe_error && <p className="text-xs text-red-600">Check failed: {item.probe_error}</p>}
      {item.resolution && (
        <p className="text-xs text-gray-500">Resolved by {item.resolution.resolved_by} on {formatDatetime(item.resolution.resolved_at)} — {item.resolution.note}</p>
      )}
    </li>
  )
}

function Checklist({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading, error, refetch } = usePlaceholders()
  const resolve = useResolvePlaceholder()
  const [unresolvedOnly, setUnresolvedOnly] = useState(true)
  const [resolving, setResolving] = useState<PlaceholderItem | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function copyMessage() {
    if (!data) return
    const text = buildGridNovaMessage(data)
    try {
      await navigator.clipboard.writeText(text)
      setCopied('Copied — paste it into your message to Grid Nova.')
    } catch {
      setCopied('Copying isn’t available in this browser — select and copy the text below instead.')
    }
  }

  if (isLoading) return <div className="space-y-3 p-6 md:p-8"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full" /></div>
  if (error) return <div className="p-6 md:p-8"><DashboardError error={error} onRetry={() => void refetch()} /></div>
  if (!data) return null

  const areas = data.areas
    .map((a) => ({ ...a, items: unresolvedOnly ? a.items.filter((i) => !i.resolved) : a.items }))
    .filter((a) => a.items.length > 0)

  return (
    <div className="max-w-4xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-[#091c3c]">Data checklist</h1>
        <p className="mt-1 text-sm text-gray-500">Everything running on dummy or placeholder values until Grid Nova provides the real data.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" data-testid="blocking-summary">
        {BLOCKING_ORDER.map((b) => {
          const c = data.summary.by_blocking[b]
          return (
            <Card key={b}>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500">{BLOCKING_LABEL[b]}</p>
                <p className="text-2xl font-bold">{c?.unresolved ?? 0}<span className="text-sm font-normal text-gray-400"> of {c?.total ?? 0} open</span></p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant={unresolvedOnly ? 'default' : 'outline'} size="sm" aria-pressed={unresolvedOnly} onClick={() => setUnresolvedOnly((v) => !v)}>
          Unresolved only
        </Button>
        <Button variant="outline" size="sm" onClick={() => void copyMessage()}>
          <ClipboardCopy className="mr-1 h-3 w-3" /> Copy as message to Grid Nova
        </Button>
        <span className="text-xs text-gray-400">{data.summary.unresolved} of {data.summary.total} unresolved</span>
      </div>
      {copied && <p role="status" className="text-sm text-gray-700">{copied}</p>}

      {areas.length === 0 && <p className="py-8 text-center text-sm text-gray-500">Nothing to show — every item is resolved.</p>}
      {areas.map((a) => (
        <Card key={a.area} data-testid="checklist-area">
          <CardHeader><CardTitle className="text-base">{AREA_LABEL(a.area)} <span className="text-xs font-normal text-gray-400">({a.items.length})</span></CardTitle></CardHeader>
          <CardContent>
            <ul>
              {a.items.map((item) => <ItemRow key={item.id} item={item} canResolve={isAdmin} onResolve={() => setResolving(item)} />)}
            </ul>
          </CardContent>
        </Card>
      ))}

      <ReasonDialog
        open={!!resolving}
        onOpenChange={(o) => !o && setResolving(null)}
        title={resolving ? `Mark ${resolving.id} resolved` : 'Mark resolved'}
        description="Use this only once Grid Nova has confirmed the real value and it has been put in place."
        label="Note"
        required
        confirmLabel="Mark resolved"
        describeError={resolveError}
        onConfirm={(note) => resolve.mutateAsync({ id: resolving!.id, note })}
      />
    </div>
  )
}

export default function DataChecklistPage() {
  const { role, isLoaded } = useStaffRole()
  if (!isLoaded) return <div className="p-8"><Skeleton className="h-8 w-48" /></div>
  if (role !== 'admin' && role !== 'management') return <NoAccess what="The data checklist" />
  return <Checklist isAdmin={role === 'admin'} />
}
