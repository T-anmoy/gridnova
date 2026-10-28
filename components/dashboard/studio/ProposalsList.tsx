'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, FilePlus2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import DateField from '@/components/forms/DateField'
import { cn, formatDate } from '@/lib/dashboard/utils'
import { useDebouncedValue } from '@/lib/dashboard/use-debounced-value'
import { useUrlParams } from '@/lib/dashboard/use-url-params'
import { usePermissions } from '@/lib/access/use-permissions'
import { useStudioCustomer, useStudioCustomers, useStudioOptions, useStudioPendingApprovals, useStudioProposals } from '@/lib/studio/api'
import { STATUS_LABEL, STUDIO_STATUSES_FOR_FILTER, compareDecimalStrings, ownerText, saveText, statusLabel, toCsv } from '@/lib/studio/logic'
import type { StudioProposalSummary } from '@/lib/studio/types'
import { ProposalLine } from './StudioHome'
import { INPUT, Money, Panel, StatusChip } from './ui'

const PAGE_SIZE = 25

type SortKey = 'reference' | 'customer' | 'capacity' | 'total' | 'status' | 'issued' | 'valid' | 'owner'

/** BE-19's `capacity_kwp` ("3", "52.50" → "52.5"); before it, the size at the start of the title. */
export function capacityOf(p: StudioProposalSummary): string {
  if (p.capacity_kwp != null && p.capacity_kwp !== '') {
    const c = p.capacity_kwp.trim()
    return c.includes('.') ? c.replace(/0+$/, '').replace(/\.$/, '') : c
  }
  if (p.capacity_kwp === null) return ''
  return /^(\d+(?:\.\d+)?)\s*kWp/i.exec(p.title)?.[1] ?? ''
}

export function sortRows(rows: StudioProposalSummary[], key: SortKey, dir: 'asc' | 'desc', me?: string): StudioProposalSummary[] {
  const text = (a: string | null | undefined, b: string | null | undefined) => (a ?? '').localeCompare(b ?? '')
  const cmp: Record<SortKey, (a: StudioProposalSummary, b: StudioProposalSummary) => number> = {
    reference: (a, b) => text(a.document_reference ?? a.code, b.document_reference ?? b.code),
    customer: (a, b) => text(a.customer?.name, b.customer?.name),
    capacity: (a, b) => compareDecimalStrings(capacityOf(a), capacityOf(b)),
    total: (a, b) => compareDecimalStrings(a.total, b.total),
    status: (a, b) => text(statusLabel(a.status), statusLabel(b.status)),
    issued: (a, b) => text(a.issued_at, b.issued_at),
    valid: (a, b) => text(a.valid_until, b.valid_until),
    owner: (a, b) => text(ownerText(a.owner_id, me, a.owner_name), ownerText(b.owner_id, me, b.owner_name)),
  }
  const out = [...rows].sort(cmp[key])
  return dir === 'desc' ? out.reverse() : out
}

export function rowsCsv(rows: StudioProposalSummary[], typeLabel: (id: string) => string, me?: string): string {
  return toCsv(
    ['Reference', 'Code', 'Customer', 'Mobile', 'Title', 'Type', 'Capacity (kWp)', 'Total incl. GST', 'Status', 'Issued', 'Valid until', 'Owner'],
    rows.map((p) => [
      p.document_reference ?? '',
      p.code,
      p.customer?.name ?? '',
      p.customer?.mobile ?? '',
      p.title,
      typeLabel(p.project_type),
      capacityOf(p),
      p.total ?? '',
      statusLabel(p.status),
      p.issued_at ? p.issued_at.slice(0, 10) : '',
      p.valid_until ?? '',
      ownerText(p.owner_id, me, p.owner_name),
    ]),
  )
}

/** BE-19 `customer_id`: pick a Studio customer by name or mobile; the chosen one shows as a chip. */
function CustomerFilter({ customerId, onChange }: { customerId?: number; onChange: (id: number | null) => void }) {
  const [q, setQ] = useState('')
  const debounced = useDebouncedValue(q.trim(), 300)
  const chosen = useStudioCustomer(customerId ?? null)
  const found = useStudioCustomers(debounced, { enabled: !customerId && debounced.length >= 2, limit: 8 })
  if (customerId) {
    return (
      <div className="block" data-testid="filter-customer">
        <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Customer</span>
        <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#d5dbe4] bg-[#f7f9fc] px-3 font-utility text-sm">
          {chosen.data?.customer.name ?? `#${customerId}`}
          <button type="button" className="text-[#0e2a63] underline" onClick={() => onChange(null)} aria-label="Show every customer">Clear</button>
        </span>
      </div>
    )
  }
  return (
    <div className="relative block" data-testid="filter-customer">
      <label className="mb-0.5 block font-utility text-xs text-[#111827]/65" htmlFor="filter-customer-q">Customer</label>
      <input id="filter-customer-q" className={INPUT} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or mobile" autoComplete="off" />
      {debounced.length >= 2 && (found.data?.items.length ?? 0) > 0 && (
        <ul className="absolute z-10 mt-1 w-full min-w-[14rem] rounded-md border border-[#e4e8ee] bg-white shadow-sm">
          {found.data!.items.map((c) => (
            <li key={c.id}>
              <button type="button" className="block min-h-11 w-full px-3 py-1.5 text-left font-utility text-sm hover:bg-[#f7f9fc]" onClick={() => { setQ(''); onChange(c.id) }}>
                {c.name} <span className="text-xs text-[#111827]/60">{c.mobile}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ProposalsList() {
  const url = useUrlParams()
  const { can, employeeId } = usePermissions()
  const options = useStudioOptions()
  const [q, setQ] = useState(url.get('q'))
  const debounced = useDebouncedValue(q.trim(), 350)
  const status = url.get('status')
  const type = url.get('type')
  const owner = url.get('owner') // '' everyone, 'me'
  const customerId = Number(url.get('customer')) || undefined
  const from = url.get('from')
  const to = url.get('to')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null)

  const params = {
    status: status || undefined,
    project_type: type || undefined,
    owner_id: owner === 'me' ? employeeId : undefined,
    customer_id: customerId,
    date_from: from || undefined,
    date_to: to || undefined,
    q: debounced || undefined,
    page: url.page,
    page_size: PAGE_SIZE,
  }
  const list = useStudioProposals(params)
  const showPending = can('studio.approve') && !status
  const pending = useStudioPendingApprovals({ enabled: showPending, pageSize: 10 })

  const rows = useMemo(() => {
    const items = list.data?.items ?? []
    return sort ? sortRows(items, sort.key, sort.dir, employeeId) : items
  }, [list.data, sort, employeeId])
  // The number of matching proposals (a count, not money).
  const count = list.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const typeLabel = (id: string) => options.data?.project_types.find((t) => t.id === id)?.label ?? id

  const header = (key: SortKey, label: string, className?: string) => {
    const on = sort?.key === key
    return (
      <th scope="col" className={cn('px-3 py-2 text-left font-utility text-xs font-medium text-[#111827]/65', className)} aria-sort={on ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" className="inline-flex min-h-8 items-center gap-1 hover:text-[#091c3c]" onClick={() => setSort(on && sort!.dir === 'asc' ? { key, dir: 'desc' } : { key, dir: 'asc' })}>
          {label}
          {on && (sort!.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </button>
      </th>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">Studio proposals</h1>
          <p className="mt-1 font-utility text-sm text-[#111827]/65">{list.data ? `${count} proposal${count === 1 ? '' : 's'}` : ' '}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11" disabled={!rows.length} onClick={() => saveText(rowsCsv(rows, typeLabel, employeeId), `studio-proposals-${new Date().toISOString().slice(0, 10)}.csv`)} data-testid="export-csv">
            <Download className="mr-1.5 h-4 w-4" /> Export these rows (CSV)
          </Button>
          {can('studio.edit') && (
            <Link href="/dashboard/studio/new" className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-[#f7a800] px-4 font-utility text-sm font-semibold text-[#091c3c]">
              <FilePlus2 className="h-4 w-4" /> New proposal
            </Link>
          )}
        </div>
      </div>

      {showPending && (pending.data?.items.length ?? 0) > 0 && (
        <Panel title="Awaiting approval" className="p-3 md:p-4">
          <ul className="divide-y divide-[#eef1f5]" data-testid="list-awaiting-approval">
            {pending.data!.items.map((p) => (
              <ProposalLine key={p.id} p={{ ...p }} note="Review" />
            ))}
          </ul>
        </Panel>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[#e4e8ee] bg-white p-3" data-testid="list-filters">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#111827]/45" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search by customer, mobile, reference or code"
            placeholder="Customer, mobile, reference…"
            className={cn(INPUT, 'pl-9')}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              url.set({ q: e.target.value.trim() || undefined })
            }}
            data-testid="list-search"
          />
        </div>
        <label className="block">
          <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Status</span>
          <select className={INPUT} value={status} onChange={(e) => url.set({ status: e.target.value || undefined })} data-testid="filter-status">
            <option value="">All</option>
            {STUDIO_STATUSES_FOR_FILTER.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Type</span>
          <select className={INPUT} value={type} onChange={(e) => url.set({ type: e.target.value || undefined })} data-testid="filter-type">
            <option value="">All</option>
            {(options.data?.project_types ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        {can('studio.view_all') && (
          <label className="block">
            <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Owner</span>
            <select className={INPUT} value={owner} onChange={(e) => url.set({ owner: e.target.value || undefined })} data-testid="filter-owner">
              <option value="">Everyone</option>
              <option value="me">Mine</option>
            </select>
          </label>
        )}
        <CustomerFilter customerId={customerId} onChange={(v) => url.set({ customer: v ? String(v) : undefined })} />
        <DateField variant="dashboard" label="Created from" value={from} onChange={(v) => url.set({ from: v || undefined })} />
        <DateField variant="dashboard" label="Created to" value={to} onChange={(v) => url.set({ to: v || undefined })} />
      </div>

      {list.error ? (
        <DashboardError error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-[#e4e8ee] bg-white p-6 text-center font-utility text-sm text-[#111827]/65" data-testid="list-empty">No proposals match these filters.</p>
      ) : (
        <>
          {/* Phones: cards. Wider: a sortable table. */}
          <ul className="space-y-2 md:hidden" data-testid="list-cards">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/studio/proposals/${p.id}`} className="block rounded-xl border border-[#e4e8ee] bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-utility text-sm font-semibold text-[#091c3c]">{p.customer?.name ?? '—'}</span>
                    <StatusChip status={p.status} />
                  </div>
                  <p className="mt-0.5 font-utility text-xs text-[#111827]/60">{p.document_reference ?? p.code} · {p.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 font-utility text-sm">
                    <Money value={p.total} />
                    {capacityOf(p) && <span className="text-xs text-[#111827]/60">{capacityOf(p)} kWp</span>}
                    <span className="text-xs text-[#111827]/60">{ownerText(p.owner_id, employeeId, p.owner_name)}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-xl border border-[#e4e8ee] bg-white md:block">
            <table className="w-full" data-testid="list-table">
              <thead className="border-b border-[#e4e8ee] bg-[#f7f9fc]">
                <tr>
                  {header('reference', 'Reference')}
                  {header('customer', 'Customer')}
                  {header('capacity', 'kWp', 'text-right')}
                  {header('total', 'Total', 'text-right')}
                  {header('status', 'Status')}
                  {header('issued', 'Issued')}
                  {header('valid', 'Valid until')}
                  {header('owner', 'Owner')}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-[#eef1f5] last:border-0 hover:bg-[#f7f9fc]" data-testid="list-row">
                    <td className="px-3 py-2 font-utility text-sm">
                      <Link href={`/dashboard/studio/proposals/${p.id}`} className="font-medium text-[#0e2a63] hover:underline">{p.document_reference ?? p.code}</Link>
                    </td>
                    <td className="px-3 py-2 font-utility text-sm">
                      {p.customer?.name ?? '—'}
                      <span className="block text-xs text-[#111827]/55">{typeLabel(p.project_type)}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-utility text-sm tabular-nums">{capacityOf(p) || '—'}</td>
                    <td className="px-3 py-2 text-right font-utility text-sm"><Money value={p.total} /></td>
                    <td className="px-3 py-2"><StatusChip status={p.status} /></td>
                    <td className="px-3 py-2 font-utility text-sm">{p.issued_at ? formatDate(p.issued_at) : '—'}</td>
                    <td className="px-3 py-2 font-utility text-sm">{p.valid_until ? formatDate(p.valid_until) : '—'}</td>
                    <td className="px-3 py-2 font-utility text-sm">{ownerText(p.owner_id, employeeId, p.owner_name)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" disabled={url.page <= 1} onClick={() => url.setPage(url.page - 1)}><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button>
              <span className="font-utility text-sm text-[#111827]/65">Page {url.page} of {pages}</span>
              <Button type="button" variant="outline" disabled={url.page >= pages} onClick={() => url.setPage(url.page + 1)}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
