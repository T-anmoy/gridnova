'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { useAdminAssociate, useAdminAssociates, useAssociateCustomers, useReassignCustomers } from '@/lib/associate/api-client'
import { humanize } from '@/lib/associate/execution-labels'
import { onboardingIdsOf, staffAssociateError } from '@/lib/associate/staff-associates'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { RequirePermission } from '@/components/dashboard/RequirePermission'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import type { AdminAssociate, ReassignCustomersResult } from '@/lib/associate/types'

// associate_journeys.md §4: a suspended or deactivated associate's open customers go to an
// active associate in the reviewer's regions. The list route answers only the reviewer's
// regions, so every associate offered here is one the move will accept on that count.
// BE-20 §10 lists the associate's open customers, so the reviewer ticks which ones move. With
// every one ticked, onboarding_ids is omitted (the server moves every open customer); the
// answer names the customers moved.
const PAGE_SIZE = 100

export default function MoveCustomersPage() {
  return (
    <RequirePermission rule="associates.applications.review" what="Moving customers">
      <MoveCustomers />
    </RequirePermission>
  )
}

function typeLabel(a: Pick<AdminAssociate, 'associate_type' | 'capability' | 'level'>): string {
  if (a.associate_type === 'preferred_associate') return `Preferred Associate${a.level ? ` · ${a.level.replace(/_/g, ' ')}` : ''}`
  return `Associate${a.capability ? ` · ${a.capability}` : ''}`
}

function MoveCustomers() {
  const params = useParams<{ id: string }>()
  const associateId = params.id
  const from = useAdminAssociate(associateId)
  const [page, setPage] = useState(1)
  const candidates = useAdminAssociates({ status: 'active', page, page_size: PAGE_SIZE })
  const move = useReassignCustomers()
  const customers = useAssociateCustomers(associateId)
  const openCustomers = useMemo(() => (customers.data?.items ?? []).filter((c) => c.open), [customers.data])
  // null = nothing changed yet: every open customer is ticked.
  const [picked, setPicked] = useState<Set<number> | null>(null)
  const selected = picked ?? new Set(openCustomers.map((c) => c.onboarding_id))
  const allSelected = openCustomers.length > 0 && openCustomers.every((c) => selected.has(c.onboarding_id))
  const toggle = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  const [query, setQuery] = useState('')
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<{ text: string; ids: number[] } | null>(null)
  const [done, setDone] = useState<ReassignCustomersResult | null>(null)

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (candidates.data?.items ?? [])
      .filter((a) => a.associate_id !== associateId)
      .filter((a) => !q || a.full_name.toLowerCase().includes(q) || a.associate_id.toLowerCase().includes(q) || (a.territory ?? '').toLowerCase().includes(q))
  }, [candidates.data, query, associateId])
  const target = options.find((a) => a.associate_id === targetId) ?? candidates.data?.items.find((a) => a.associate_id === targetId)
  const pages = candidates.data ? Math.max(1, Math.ceil(candidates.data.total / PAGE_SIZE)) : 1

  if (from.error) return <DashboardError error={from.error} onRetry={() => void from.refetch()} />
  if (from.isLoading || !from.data) return <Skeleton className="h-48 w-full max-w-3xl" />
  const source = from.data
  const back = `/dashboard/associate-network/associates/${encodeURIComponent(associateId)}`

  async function submit() {
    setError(null)
    if (!targetId) return setError({ text: 'Choose the associate who will take the customers.', ids: [] })
    if (selected.size === 0) return setError({ text: 'Tick at least one customer to move.', ids: [] })
    if (!reason.trim()) return setError({ text: 'Please give a reason. It is recorded with each customer.', ids: [] })
    const ids = openCustomers.filter((c) => selected.has(c.onboarding_id)).map((c) => c.onboarding_id)
    try {
      setDone(await move.mutateAsync({ associateId, input: { to_associate_id: targetId, reason: reason.trim(), ...(allSelected ? {} : { onboarding_ids: ids }) } }))
    } catch (err) {
      setError({ text: staffAssociateError(err, 'The customers could not be moved.'), ids: onboardingIdsOf(err) })
    }
  }

  if (done) {
    return (
      <div className="max-w-3xl space-y-4">
        <Card className="p-6 border-green-200 bg-green-50" role="status" data-testid="move-done">
          <p className="flex items-center gap-2 font-utility font-semibold text-green-900">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> {done.moved} customer{done.moved === 1 ? '' : 's'} moved to {target?.full_name ?? done.to_associate_id}
          </p>
          <p className="mt-2 font-utility text-sm text-green-900">
            They see and work these customers in their portal now, and have been emailed the list. Commission already recorded stays with {source.full_name}; payments verified from now on earn the new owner.
          </p>
          {done.onboarding_ids.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Customers moved">
              {done.onboarding_ids.map((id) => (
                <li key={id}>
                  <Link className="font-utility text-sm text-[#0e2a63] underline" href={`/dashboard/onboardings/${id}`}>Customer #{id}</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Link href={back} className="font-utility text-sm text-[#0e2a63]">← Back to {source.full_name}</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <Link href={back} className="font-utility text-sm text-[#0e2a63]">← Back to {source.full_name}</Link>
      <h1 className="mt-4 font-display text-2xl font-bold text-[#091c3c]">Move customers</h1>
      <p className="mt-1 font-utility text-sm text-[#111827]/65">
        From {source.full_name} ({source.associate_id}, {source.status}) to an active associate. Tick the open customers to move; closed ones stay.
      </p>

      {source.status === 'active' ? (
        <Card className="mt-6 p-5 border-amber-200 bg-amber-50" data-testid="move-active">
          <p className="font-utility text-sm text-amber-900">
            {source.full_name} is active. An active associate’s customers are never moved (Associate Network Terms A7). Suspend or deactivate them first if they can no longer serve their customers.
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-5">
          <Card className="p-5 space-y-3" data-testid="move-customer-list">
            <p className="font-utility text-sm font-medium text-[#091c3c]">Customers to move</p>
            {customers.error ? (
              <DashboardError error={customers.error} onRetry={() => void customers.refetch()} />
            ) : customers.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : openCustomers.length === 0 ? (
              <p className="font-utility text-sm text-[#111827]/65" data-testid="no-open-customers">{source.full_name} has no open customers.</p>
            ) : (
              <fieldset>
                <legend className="sr-only">Choose the customers to move</legend>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 font-utility text-sm font-medium text-[#091c3c]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#0e2a63]"
                    checked={allSelected}
                    onChange={() => setPicked(allSelected ? new Set() : new Set(openCustomers.map((c) => c.onboarding_id)))}
                  />
                  Select all ({selected.size} of {openCustomers.length} ticked)
                </label>
                <ul className="max-h-80 divide-y divide-[#e4e8ee] overflow-y-auto rounded-lg border border-[#e4e8ee]">
                  {openCustomers.map((c) => (
                    <li key={c.onboarding_id}>
                      <label className="flex min-h-[48px] cursor-pointer items-center gap-3 px-3 py-2">
                        <input type="checkbox" className="h-4 w-4 accent-[#0e2a63]" checked={selected.has(c.onboarding_id)} onChange={() => toggle(c.onboarding_id)} />
                        <span className="min-w-0">
                          <span className="block font-utility text-sm font-medium text-[#091c3c]">
                            {c.customer_name ?? `Customer #${c.onboarding_id}`}
                            {c.client_code && <span className="text-[#111827]/60"> · {c.client_code}</span>}
                          </span>
                          <span className="block font-utility text-xs text-[#111827]/65">
                            {humanize(c.status)}{c.project_stage ? ` · stage: ${humanize(c.project_stage)}` : ''}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <Label htmlFor="target-search">New associate</Label>
            <Input id="target-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, ID or territory" />
            {candidates.error ? (
              <DashboardError error={candidates.error} onRetry={() => void candidates.refetch()} />
            ) : candidates.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : options.length === 0 ? (
              <p className="font-utility text-sm text-[#111827]/65" data-testid="no-candidates">No active associate in your regions matches.</p>
            ) : (
              <fieldset>
                <legend className="sr-only">Choose the new associate</legend>
                <ul className="max-h-80 divide-y divide-[#e4e8ee] overflow-y-auto rounded-lg border border-[#e4e8ee]">
                  {options.map((a) => (
                    <li key={a.associate_id}>
                      <label className={`flex min-h-[48px] cursor-pointer items-center gap-3 px-3 py-2 ${targetId === a.associate_id ? 'bg-[#f7a800]/10' : ''}`}>
                        <input type="radio" name="target" value={a.associate_id} checked={targetId === a.associate_id} onChange={() => setTargetId(a.associate_id)} className="h-4 w-4 accent-[#0e2a63]" />
                        <span className="min-w-0">
                          <span className="block font-utility text-sm font-medium text-[#091c3c]">{a.full_name} <span className="text-[#111827]/60">· {a.associate_id}</span></span>
                          <span className="block font-utility text-xs text-[#111827]/65">{typeLabel(a)}{a.territory ? ` · ${a.territory}` : ''}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
            {pages > 1 && (
              <div className="flex items-center justify-between font-utility text-xs text-[#111827]/65">
                <span>Page {page} of {pages}</span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
                </span>
              </div>
            )}
            <p className="font-utility text-xs text-[#111827]/65">
              A project whose execution {source.full_name} runs can only go to a Preferred Associate or an associate with execution capability.
            </p>
          </Card>

          <Card className="p-5 space-y-2">
            <Label htmlFor="move-reason">Reason (required)</Label>
            <Textarea id="move-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={2000} placeholder="Why the customers are moving…" />
            <p className="font-utility text-xs text-[#111827]/65">Recorded on each customer’s history and on the associate.</p>
          </Card>

          {error && (
            <div role="alert" data-testid="move-error" className="rounded-lg border border-red-100 bg-red-50 p-4 font-utility text-sm text-red-800">
              <p>{error.text}</p>
              {error.ids.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Customers concerned">
                  {error.ids.map((id) => (
                    <li key={id}>
                      <Link className="underline" href={`/dashboard/onboardings/${id}`}>Customer #{id}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void submit()} disabled={move.isPending} className="min-h-[44px] md:min-h-0">
              {move.isPending
                ? 'Moving…'
                : `${allSelected ? 'Move every open customer' : `Move ${selected.size} customer${selected.size === 1 ? '' : 's'}`}${target ? ` to ${target.full_name}` : ''}`}
            </Button>
            <Link href={back}>
              <Button variant="outline" className="min-h-[44px] md:min-h-0">Cancel</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

