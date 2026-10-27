'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { FileUp } from 'lucide-react'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { ClickableRow } from '@/components/dashboard/ClickableRow'
import { QueuePager } from '@/components/dashboard/QueuePager'
import { ArchiveFilterForm } from '@/components/dashboard/archive/ArchiveFilterForm'
import { ArchiveStatsStrip } from '@/components/dashboard/archive/ArchiveStatsStrip'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ARCHIVE_PAGE_SIZE, activeArchiveFilterCount, archiveFilterApiError, archiveFiltersFromParams, archiveFiltersToParams, archiveFiltersToQuery, formatFieldValue, type ArchiveFilters } from '@/lib/archive/logic'
import { useArchiveProjects, useArchiveStats } from '@/lib/archive/api-client'
import type { ProjectCard } from '@/lib/archive/schemas'
import { usePermissions } from '@/lib/access/use-permissions'

const COLUMNS: { key: string; label: string }[] = [
  { key: 'scheme_or_segment', label: 'Scheme' },
  { key: 'size', label: 'Size' },
  { key: 'state', label: 'State' },
  { key: 'district', label: 'District' },
  { key: 'block', label: 'Block' },
  { key: 'commissioning_date', label: 'Commissioned' },
  { key: 'module_make', label: 'Modules' },
  { key: 'inverter_make', label: 'Inverter' },
  { key: 'customer_name', label: 'Customer' },
]

function has(card: ProjectCard, key: string): boolean {
  return key === 'size' ? ['capacity_kw', 'pump_hp', 'street_lamp_count'].some((k) => k in card.fields) : key in card.fields
}

/** Capacity, pump rating or lamp count — whichever the project has. */
function sizeText(card: ProjectCard): string {
  for (const k of ['capacity_kw', 'pump_hp']) {
    const v = card.fields[k]?.value
    if (v != null && v !== '') return formatFieldValue(k, v)
  }
  const lamps = card.fields.street_lamp_count?.value
  return lamps != null && lamps !== '' ? `${String(lamps)} lamps` : '—'
}

function cellText(card: ProjectCard, key: string): string {
  return key === 'size' ? sizeText(card) : formatFieldValue(key, card.fields[key]?.value)
}

export default function ArchivePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ArchiveContent />
    </Suspense>
  )
}

function ArchiveContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { can } = usePermissions()
  const filters = archiveFiltersFromParams(searchParams)
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const query = archiveFiltersToQuery(filters)

  const list = useArchiveProjects({ ...query, page, page_size: ARCHIVE_PAGE_SIZE })
  const stats = useArchiveStats(query)
  const serverError = archiveFilterApiError(list.error) ?? archiveFilterApiError(stats.error)

  function go(next: URLSearchParams) {
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  function apply(next: ArchiveFilters) {
    go(archiveFiltersToParams(next, searchParams))
  }
  function setPage(p: number) {
    const next = new URLSearchParams(searchParams.toString())
    if (p > 1) next.set('page', String(p))
    else next.delete('page')
    go(next)
  }

  const items = list.data?.items ?? []
  const columns = COLUMNS.filter((c) => items.some((it) => has(it, c.key)))
  const active = activeArchiveFilterCount(filters)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[#091c3c] md:text-2xl">Project archive</h1>
          <p className="mt-1 text-sm text-gray-600">Grid Nova’s completed projects from before this system. Fields you don’t see are not part of your role’s access.</p>
        </div>
        {can('archive.manage') && (
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link href="/dashboard/archive/import"><FileUp className="h-4 w-4" aria-hidden="true" />Import</Link>
          </Button>
        )}
      </div>

      <ArchiveFilterForm key={searchParams.toString()} applied={filters} onApply={apply} serverError={serverError} />

      <ArchiveStatsStrip stats={stats.data} loading={stats.isLoading} failed={!!stats.error && !serverError} onRetry={() => void stats.refetch()} />

      {list.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : list.error && !serverError ? (
        <DashboardError error={list.error} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-[#e4e8ee] bg-white px-4 py-10 text-center text-sm text-gray-600" data-testid="archive-empty">
          {active > 0 ? 'No archived project matches these filters.' : 'No archived projects yet.'}
        </div>
      ) : (
        <div className="rounded-xl border border-[#e4e8ee] bg-white">
          <Table aria-label="Archived projects">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Reference</TableHead>
                {columns.map((c) => (
                  <TableHead key={c.key} scope="col" className="whitespace-nowrap">{c.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((card) => (
                <ClickableRow key={card.id} href={`/dashboard/archive/${card.id}`} data-testid="archive-row">
                  <TableCell className="whitespace-nowrap font-medium">
                    <Link href={`/dashboard/archive/${card.id}`} className="inline-flex min-h-[44px] items-center text-[#0e2a63] underline">{card.ref}</Link>
                  </TableCell>
                  {columns.map((c) => (
                    <TableCell key={c.key} className="whitespace-nowrap text-sm">{cellText(card, c.key)}</TableCell>
                  ))}
                </ClickableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {list.data && <QueuePager page={list.data.page} pageSize={list.data.page_size} total={list.data.total} onPage={setPage} />}
    </div>
  )
}
