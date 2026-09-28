'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Info, Loader2 } from 'lucide-react'
import Link from '@/components/i18n/Link'
import { useTerritoryMembers } from '@/lib/associate/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { DashboardError } from '@/components/dashboard/DashboardError'
import type { ApplicationType, AssociateStatus, TerritoryMember } from '@/lib/associate/types'
import { fmt, type Messages } from '@/lib/i18n/types'

type TerritoryCopy = Messages['associates']['portal']['preferred']['territory']

const PAGE_SIZE = 25

const STATUS_CLASS: Record<AssociateStatus, string> = {
  active: 'bg-[#2f5daa]/10 text-[#0e2a63]',
  suspended: 'bg-amber-100 text-amber-800',
  deactivated: 'bg-[#111827]/10 text-[#111827]/60',
}

// capability/level: the contract guarantees exactly one is non-null, so the
// role line never needs a "both" or "neither" case.
function roleLabel(m: TerritoryMember, copy: TerritoryCopy): string {
  const detail = m.level ? copy.level[m.level] : m.capability ? copy.capability[m.capability] : null
  return detail ? `${copy.type[m.associate_type]} · ${detail}` : copy.type[m.associate_type]
}

function MemberCard({ member, copy }: { member: TerritoryMember; copy: TerritoryCopy }) {
  return (
    <li
      className={`rounded-2xl border border-[#e4e8ee] bg-white p-5 ${member.status === 'active' ? '' : 'opacity-75'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-[#0e2a63] truncate">{member.full_name}</p>
          <p className="mt-0.5 text-xs text-[#111827]/50 font-utility">{member.associate_id}</p>
          <p className="mt-1 text-xs text-[#111827]/65 font-utility">{roleLabel(member, copy)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold font-utility ${STATUS_CLASS[member.status]}`}>
          {copy.status[member.status]}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#e4e8ee] pt-3">
        <div>
          <dt className="font-utility text-[11px] uppercase tracking-wide text-[#111827]/40">{copy.customers}</dt>
          <dd className="font-display text-xl font-semibold text-[#091c3c]">{member.customer_count}</dd>
        </div>
        <div>
          <dt className="font-utility text-[11px] uppercase tracking-wide text-[#111827]/40">{copy.verified}</dt>
          <dd className="font-display text-xl font-semibold text-[#091c3c]">{member.verified_customer_count}</dd>
        </div>
      </dl>
    </li>
  )
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T | ''
  onChange: (v: T | '') => void
  options: { value: T | ''; label: string }[]
}) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="font-utility text-[11px] uppercase tracking-wide text-[#111827]/40">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | '')}
        className="rounded-lg border border-[#e4e8ee] bg-white px-3 py-2.5 text-sm font-utility text-[#091c3c]"
      >
        {options.map((o) => (
          <option key={o.value || 'all'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function PortalTerritory({ copy }: { copy: TerritoryCopy }) {
  const [status, setStatus] = useState<AssociateStatus | ''>('')
  const [type, setType] = useState<ApplicationType | ''>('')
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useTerritoryMembers({
    page,
    page_size: PAGE_SIZE,
    status: status || undefined,
    associate_type: type || undefined,
  })

  const filtered = status !== '' || type !== ''
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>
      <p className="mt-1 text-sm text-[#111827]/55">{copy.subtitle}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <FilterSelect<AssociateStatus>
          label={copy.filters.status}
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
          options={[
            { value: '', label: copy.filters.all },
            { value: 'active', label: copy.status.active },
            { value: 'suspended', label: copy.status.suspended },
            { value: 'deactivated', label: copy.status.deactivated },
          ]}
        />
        <FilterSelect<ApplicationType>
          label={copy.filters.type}
          value={type}
          onChange={(v) => {
            setType(v)
            setPage(1)
          }}
          options={[
            { value: '', label: copy.filters.all },
            { value: 'associate', label: copy.filters.typeAssociate },
            { value: 'preferred_associate', label: copy.filters.typePreferred },
          ]}
        />
      </div>

      <div className="mt-4 flex gap-2.5 rounded-xl bg-[#2f5daa]/5 p-3.5 text-xs text-[#111827]/65 leading-relaxed">
        <Info className="h-4 w-4 shrink-0 text-[#2f5daa] mt-0.5" />
        <p>
          {copy.countsNote}{' '}
          <Link href="/preferred/portal/customers" className="font-semibold text-[#2f5daa] underline underline-offset-2">
            {copy.customersLink}
          </Link>
        </p>
      </div>

      {error instanceof ApiError && error.status === 403 && error.detail === 'Only Preferred Associates have a territory roster.' ? (
        <p className="mt-6 rounded-2xl border border-dashed border-[#e4e8ee] bg-white p-6 text-center text-sm text-[#111827]/60">
          {copy.notPreferred}
        </p>
      ) : (
        error && <DashboardError error={error} onRetry={() => void refetch()} />
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#111827]/30" />
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-[#e4e8ee] bg-white p-8 text-center">
          <p className="font-display text-lg font-semibold text-[#0e2a63]">
            {filtered ? copy.emptyFiltered.title : copy.empty.title}
          </p>
          <p className="mt-2 text-sm text-[#111827]/55 leading-relaxed max-w-md mx-auto">
            {filtered ? copy.emptyFiltered.body : copy.empty.body}
          </p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <p className="mt-6 text-xs font-utility text-[#111827]/50">{fmt(copy.total, { total: data.total })}</p>
          <ul className="mt-2 space-y-3">
            {data.items.map((m) => (
              <MemberCard key={m.associate_id} member={m} copy={copy} />
            ))}
          </ul>
          {pages > 1 && (
            <nav className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border border-[#e4e8ee] bg-white px-3 py-2 text-sm font-utility text-[#0e2a63] disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> {copy.previous}
              </button>
              <span className="text-xs font-utility text-[#111827]/55">{fmt(copy.pageOf, { page, pages })}</span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pages}
                className="flex items-center gap-1 rounded-lg border border-[#e4e8ee] bg-white px-3 py-2 text-sm font-utility text-[#0e2a63] disabled:opacity-40"
              >
                {copy.next} <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
