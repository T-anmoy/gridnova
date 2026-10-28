'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { FilePlus2, Pencil, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { cn } from '@/lib/dashboard/utils'
import { useDebouncedValue } from '@/lib/dashboard/use-debounced-value'
import { usePermissions } from '@/lib/access/use-permissions'
import { studioApi, studioKeys, useStudioCustomer, useStudioCustomers, useStudioOptions, useStudioProposals, useStudioToken } from '@/lib/studio/api'
import { CustomerForm, DuplicateWarning, customerInput, emptyCustomer } from './CustomerForm'
import { ProposalLine } from './StudioHome'
import { INPUT, Panel } from './ui'

export function CustomersList() {
  const { can } = usePermissions()
  const qc = useQueryClient()
  const token = useStudioToken()
  const options = useStudioOptions()
  const [q, setQ] = useState('')
  const debounced = useDebouncedValue(q.trim(), 300)
  const list = useStudioCustomers(debounced, { limit: 100 })
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">Studio customers</h1>
          <p className="mt-1 font-utility text-sm text-[#111827]/65">People and organisations you send Studio proposals to.</p>
        </div>
        {can('studio.edit') && !adding && (
          <Button type="button" className="min-h-11" onClick={() => setAdding(true)} data-testid="customers-add">Add a customer</Button>
        )}
      </div>
      {adding && options.data && (
        <Panel title="New customer">
          <CustomerForm
            initial={emptyCustomer()}
            titles={options.data.titles}
            submitLabel="Save customer"
            onCancel={() => setAdding(false)}
            onSubmit={async (value) => {
              const res = await studioApi.createCustomer(token, value)
              setAdding(false)
              void qc.invalidateQueries({ queryKey: ['studio', 'customers'] })
              toast.success(res.duplicates.length ? 'Saved — but it may be a customer you already have (same mobile or GSTIN).' : 'Customer saved.')
            }}
          />
        </Panel>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#111827]/45" aria-hidden="true" />
        <input type="search" aria-label="Search customers" placeholder="Name, mobile or GSTIN" className={cn(INPUT, 'pl-9')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.error ? (
        <DashboardError error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <Skeleton className="h-48 w-full" />
      ) : list.data.items.length === 0 ? (
        <p className="rounded-xl border border-[#e4e8ee] bg-white p-6 text-center font-utility text-sm text-[#111827]/65">No customers{debounced ? ` match “${debounced}”` : ' yet'}.</p>
      ) : (
        <ul className="divide-y divide-[#eef1f5] rounded-xl border border-[#e4e8ee] bg-white" data-testid="customers-list">
          {list.data.items.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/studio/customers/${c.id}`} className="flex min-h-14 flex-wrap items-center gap-x-3 px-4 py-2.5 hover:bg-[#f7f9fc]">
                <span className="min-w-0 flex-1">
                  <span className="block font-utility text-sm font-medium text-[#091c3c]">{c.name}</span>
                  <span className="block truncate font-utility text-xs text-[#111827]/60">{c.address_lines.join(', ')}</span>
                </span>
                <span className="font-utility text-sm text-[#111827]/75">{c.mobile}</span>
                {c.gstin && <span className="font-mono text-xs text-[#111827]/60">{c.gstin}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CustomerDetail() {
  const { id: raw } = useParams<{ id: string }>()
  const id = Number(raw)
  const { can } = usePermissions()
  const qc = useQueryClient()
  const token = useStudioToken()
  const options = useStudioOptions()
  const customer = useStudioCustomer(Number.isFinite(id) ? id : null)
  const c = customer.data?.customer
  // BE-19: the list filters by customer.
  const proposals = useStudioProposals({ customer_id: id, page_size: 100 }, { enabled: !!c })
  const mine = proposals.data?.items ?? []
  const [editing, setEditing] = useState(false)

  if (customer.error) return <DashboardError error={customer.error} onRetry={() => void customer.refetch()} />
  if (!c) return <Skeleton className="h-64 w-full" />

  return (
    <div className="space-y-5">
      <div>
        <p className="font-utility text-xs text-[#111827]/60"><Link href="/dashboard/studio/customers" className="hover:underline">Studio customers</Link></p>
        <h1 className="mt-0.5 font-display text-2xl font-bold text-[#091c3c]">{c.title ? `${c.title} ` : ''}{c.name}</h1>
      </div>
      <DuplicateWarning duplicates={customer.data!.duplicates} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Contact" actions={can('studio.edit') && !editing ? <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button> : undefined}>
          {editing && options.data ? (
            <CustomerForm
              initial={customerInput(c)}
              titles={options.data.titles}
              submitLabel="Save changes"
              onCancel={() => setEditing(false)}
              onSubmit={async (value) => {
                const res = await studioApi.updateCustomer(token, id, value)
                qc.setQueryData(studioKeys.customer(id), res)
                void qc.invalidateQueries({ queryKey: ['studio', 'customers'] })
                setEditing(false)
                toast.success('Saved. Proposals already made keep the name and address they print — change those in each proposal.')
              }}
            />
          ) : (
            <dl className="space-y-2 font-utility text-sm" data-testid="customer-contact">
              <div><dt className="text-xs text-[#111827]/60">Mobile</dt><dd>{c.mobile}</dd></div>
              <div><dt className="text-xs text-[#111827]/60">Email</dt><dd>{c.email ?? '—'}</dd></div>
              {c.attention && <div><dt className="text-xs text-[#111827]/60">Contact person</dt><dd>{c.attention}</dd></div>}
              <div><dt className="text-xs text-[#111827]/60">Address</dt><dd>{c.address_lines.join(', ') || '—'}</dd></div>
              {c.gstin && <div><dt className="text-xs text-[#111827]/60">GSTIN</dt><dd className="font-mono">{c.gstin}</dd></div>}
            </dl>
          )}
        </Panel>
        <Panel title="Proposals for this customer" className="p-3 md:p-4" actions={can('studio.edit') ? <Link href="/dashboard/studio/new" className="inline-flex min-h-11 items-center gap-1 font-utility text-sm text-[#0e2a63] hover:underline"><FilePlus2 className="h-4 w-4" /> New proposal</Link> : undefined}>
          {proposals.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : mine.length === 0 ? (
            <p className="px-3 font-utility text-sm text-[#111827]/60">None yet.</p>
          ) : (
            <ul className="divide-y divide-[#eef1f5]" data-testid="customer-proposals">
              {mine.map((p) => <ProposalLine key={p.id} p={p} />)}
            </ul>
          )}
          {(proposals.data?.total ?? 0) > mine.length && (
            <p className="mt-2 px-3 font-utility text-sm">
              <Link href={`/dashboard/studio/proposals?customer=${id}`} className="text-[#0e2a63] underline" data-testid="customer-all-proposals">See all {proposals.data!.total}</Link>
            </p>
          )}
        </Panel>
      </div>
    </div>
  )
}
