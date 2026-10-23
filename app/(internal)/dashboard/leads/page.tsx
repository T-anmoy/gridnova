'use client'

import { Suspense, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Search, Download, Plus } from 'lucide-react'
import { useLeads, useCreateLead, downloadLeadsCsv, defaultLeadListParams, LEADS_PAGE_SIZE } from '@/lib/dashboard/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { useDebouncedValue } from '@/lib/dashboard/use-debounced-value'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ClickableRow } from '@/components/dashboard/ClickableRow'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatDate } from '@/lib/dashboard/utils'
import NoAccess from '@/components/dashboard/NoAccess'
import { LeadFilterPanel } from '@/components/dashboard/LeadFilterPanel'
import { fmt, useStaffLeadsCopy } from '@/lib/dashboard/staff-leads-copy'
import { canExportLeads, canSeeLeads, mapExportError } from '@/lib/dashboard/staff-leads-logic'
import { filterApiError, filtersFromParams, filtersToParams, hasActiveFilters, sendableFilters } from '@/lib/dashboard/lead-filters'
import type { LeadFilters } from '@/lib/dashboard/staff-leads-types'
import type { CreateLeadInput, LeadAssignmentFilter, LeadListParams, LeadSource, LeadSummary, ManualProjectType, PipelineStage, LeadScore, Role } from '@/lib/dashboard/types'

function stageBadgeVariant(stage: PipelineStage) {
  const map: Record<PipelineStage, string> = {
    new: 'blue',
    qualifying: 'amber',
    qualified: 'green',
    proposal_draft: 'navy',
    proposal_sent: 'navy',
    negotiation: 'orange',
    won: 'green',
    lost: 'gray',
  }
  return (map[stage] ?? 'gray') as 'blue' | 'amber' | 'green' | 'navy' | 'orange' | 'gray'
}

function scoreVariant(score: LeadScore) {
  if (score === 'high') return 'gold'
  if (score === 'medium') return 'blue'
  return 'gray'
}

// Matches the backend's LeadSource enum (app/memory/models.py) — chat,
// estimate-form, and booking-originated leads each get a distinct color so
// they read apart from each other at a glance, not lumped together.
const SOURCE_LABEL: Record<string, string> = {
  website_chat: 'Chat',
  website_estimate_form: 'Estimate Form',
  website_booking: 'Booking',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  cold_call: 'Cold Call',
  referral: 'Referral',
  other: 'Other',
}

function sourceBadgeVariant(source: string) {
  const map: Record<string, string> = {
    website_chat: 'blue',
    website_estimate_form: 'navy',
    website_booking: 'gold',
    whatsapp: 'green',
    instagram: 'orange',
    cold_call: 'gray',
    referral: 'secondary',
  }
  return (map[source] ?? 'outline') as 'blue' | 'navy' | 'gold' | 'green' | 'orange' | 'gray' | 'secondary' | 'outline'
}

const LEAD_SOURCES = Object.keys(SOURCE_LABEL)

// Staff-entered enquiry sources for the "Add lead" dialog — distinct from
// SOURCE_LABEL above, which covers every source the backend can report
// (including AI-channel-originated ones no staff member types in by hand).
const MANUAL_LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'cold_call', label: 'Phone call' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
]

const MANUAL_PROJECT_TYPES: { value: ManualProjectType; label: string }[] = [
  { value: 'rooftop', label: 'Rooftop' },
  { value: 'ground_mounted', label: 'Ground-mounted' },
  { value: 'solar_pump', label: 'Solar pump' },
]

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.detail || err.message
  if (err instanceof Error) return err.message
  return fallback
}

function AddLeadDialog() {
  const router = useRouter()
  const createLead = useCreateLead()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState<LeadSource>('whatsapp')
  const [projectType, setProjectType] = useState<ManualProjectType | ''>('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  function reset() {
    setName('')
    setPhone('')
    setEmail('')
    setSource('whatsapp')
    setProjectType('')
    setNotes('')
    setFormError(null)
  }

  async function handleSubmit() {
    setFormError(null)
    if (!name.trim()) {
      setFormError('Name is required')
      return
    }
    if (!phone.trim() && !email.trim()) {
      setFormError('At least one of phone or email is required')
      return
    }
    if (notes.length > 2000) {
      setFormError('Notes must be 2000 characters or fewer')
      return
    }
    const input: CreateLeadInput = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      source,
      project_type: projectType || undefined,
      notes: notes.trim() || undefined,
    }
    try {
      const result = await createLead.mutateAsync(input)
      const qualificationNote = result.is_qualified
        ? ''
        : result.missing_fields.length > 0
          ? ` — missing: ${result.missing_fields.join(', ')}`
          : ''
      toast.success(`Lead #${result.lead_id} created${qualificationNote}`)
      setOpen(false)
      reset()
      router.push(`/dashboard/leads/${result.lead_id}`)
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to create lead'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add Lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Lead</DialogTitle>
          <DialogDescription>Record a staff-entered enquiry (WhatsApp, phone call, referral, etc.).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Name *</Label>
            <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
            </div>
          </div>
          <p className="font-utility text-xs text-[#111827]/65">At least one of phone or email is required.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MANUAL_LEAD_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project type</Label>
              <Select value={projectType} onValueChange={(v) => setProjectType(v as ManualProjectType)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {MANUAL_PROJECT_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea id="lead-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} placeholder="Optional context…" />
          </div>
          {formError && <p className="font-utility text-sm text-red-600">{formError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void handleSubmit()} disabled={createLead.isPending}>
            {createLead.isPending ? 'Creating…' : 'Create Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const isAssignment = (v: string | null): v is LeadAssignmentFilter => v === 'me' || v === 'unassigned' || v === 'any'

const countFormat = new Intl.NumberFormat('en-IN')

export default function LeadsPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <LeadsContent />
    </Suspense>
  )
}

function LeadsContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { getToken } = useAuth()
  const copy = useStaffLeadsCopy()
  const role = user?.publicMetadata?.role as Role | undefined

  // Filters and the page live in the URL so a reload, a back-navigation or a
  // shared link restores the exact view. The stage / score / date filters are
  // the server's own (staff_contracts.md §3) and use its parameter names.
  const filters = filtersFromParams(searchParams)
  const sendable = sendableFilters(filters)
  const sourceFilter = LEAD_SOURCES.includes(searchParams.get('source') ?? '') ? (searchParams.get('source') as string) : ''
  const assignedParam = searchParams.get('assigned')
  const assignedFilter: LeadAssignmentFilter | '' = isAssignment(assignedParam) ? assignedParam : ''
  const urlQuery = searchParams.get('q') ?? ''
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)

  function setParams(updates: Record<string, string | undefined>, { keepPage = false } = {}) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!keepPage) next.delete('page')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Changing any filter returns to page 1 (filtersToParams drops `page`).
  function setFilters(next: LeadFilters) {
    const qs = filtersToParams(next, searchParams).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // The search box keeps its own text; the URL (and so the request) follows
  // after a 300 ms pause, and a new search always starts at page 1.
  const [searchText, setSearchText] = useState(urlQuery)
  const debouncedSearch = useDebouncedValue(searchText.trim(), 300)
  useEffect(() => {
    if (debouncedSearch !== urlQuery) setParams({ q: debouncedSearch || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const [exporting, setExporting] = useState(false)
  const isSales = role === 'sales'
  const isAdmin = role === 'admin'
  const isManagement = role === 'management'
  // Admin and management assign new website/chat leads too, so the filter
  // isn't Sales-only — but only Sales gets a default scope (own + unassigned)
  // applied automatically; admin/management see everything until they
  // explicitly filter, matching their existing "see all" default.
  const canFilterByAssignment = isAdmin || isManagement || isSales
  const effectiveAssignedFilter = assignedFilter || (isSales ? 'any' : '')

  const defaults = defaultLeadListParams(role)
  const listParams: LeadListParams = {
    ...defaults,
    page,
    ...(sendable.stages.length ? { stage: sendable.stages } : {}),
    ...(sendable.minScore ? { min_score: sendable.minScore } : {}),
    ...(sendable.maxScore ? { max_score: sendable.maxScore } : {}),
    ...(sendable.createdFrom ? { created_from: sendable.createdFrom } : {}),
    ...(sendable.createdTo ? { created_to: sendable.createdTo } : {}),
    ...(sendable.referredBy ? { referred_by_associate_id: sendable.referredBy } : {}),
    ...(sourceFilter ? { source: sourceFilter } : {}),
    ...(urlQuery ? { q: urlQuery } : {}),
    ...(canFilterByAssignment && effectiveAssignedFilter ? { assigned: effectiveAssignedFilter } : {}),
  }
  const { data, isLoading, error, refetch, isPlaceholderData } = useLeads(listParams)
  const leads = data?.items ?? []
  // `total` is the server's filtered count, so the pager is exact.
  const total = data?.total ?? 0
  const pageSize = data?.page_size ?? LEADS_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const serverFilterError = filterApiError(error)

  const canExport = canExportLeads(role)
  const canAddLead = role === 'admin' || role === 'sales' || role === 'management'
  const isEngineer = role === 'engineer'

  const anyFilter = hasActiveFilters(filters) || !!(sourceFilter || urlQuery || assignedFilter)
  // The export has no search or assignment parameter, so say so when those are set.
  const exportIgnoresSomething = !!(urlQuery || assignedFilter)

  async function handleExport() {
    setExporting(true)
    try {
      const token = await getToken()
      if (!token) return
      await downloadLeadsCsv(
        { ...(sendable.stages.length ? { stage: sendable.stages } : {}),
          ...(sendable.minScore ? { min_score: sendable.minScore } : {}),
          ...(sendable.maxScore ? { max_score: sendable.maxScore } : {}),
          ...(sendable.createdFrom ? { created_from: sendable.createdFrom } : {}),
          ...(sendable.createdTo ? { created_to: sendable.createdTo } : {}),
          ...(sendable.referredBy ? { referred_by_associate_id: sendable.referredBy } : {}),
          source: sourceFilter || undefined },
        token,
      )
    } catch (err) {
      toast.error(copy.export[mapExportError(err).key])
    } finally {
      setExporting(false)
    }
  }

  if (role && !canSeeLeads(role)) return <NoAccess what="Leads" />

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">Leads</h1>
          <p className="font-utility text-sm text-[#111827]/65 mt-1" aria-live="polite">
            {isLoading
              ? copy.common.loading
              : fmt(anyFilter ? copy.list.matchingCount : copy.list.totalCount, { count: countFormat.format(total) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAddLead && <AddLeadDialog />}
          {canExport && (
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="min-h-11 gap-2"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {exporting ? copy.export.busy : copy.export.button}
            </Button>
          )}
        </div>
      </div>
      {canExport && exportIgnoresSomething && (
        <p className="mb-3 font-utility text-xs text-[#111827]/65" role="note">
          {copy.export.scopeNote}
        </p>
      )}

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          {canFilterByAssignment && (
            <Select
              value={effectiveAssignedFilter || 'all'}
              onValueChange={(v) => setParams({ assigned: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="min-h-11 w-full sm:w-44" aria-label="Assignment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isSales ? (
                  <SelectItem value="any">Mine + unassigned</SelectItem>
                ) : (
                  <SelectItem value="all">All leads</SelectItem>
                )}
                <SelectItem value="me">Assigned to me</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-3.5 h-4 w-4 text-[#111827]/65" aria-hidden="true" />
            <Input
              type="search"
              aria-label={isEngineer ? 'Search by lead ID' : 'Search by name, email, phone or lead ID'}
              placeholder={isEngineer ? 'Search by lead ID' : 'Name, email, phone or ID'}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value.slice(0, 100))}
              className="min-h-11 pl-8"
              autoComplete="off"
            />
          </div>
          <Select value={sourceFilter} onValueChange={(v) => setParams({ source: v || undefined })}>
            <SelectTrigger className="min-h-11 w-full sm:w-40" aria-label="Source">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All sources</SelectItem>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <LeadFilterPanel
          filters={filters}
          onChange={setFilters}
          showClear={anyFilter}
          onClear={() => {
            setSearchText('')
            router.replace(pathname, { scroll: false })
          }}
          serverError={serverFilterError}
          copy={copy}
        />
      </div>

      {error && !serverFilterError ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Pipeline Stage</TableHead>
                {!isEngineer && <TableHead>Lead Score</TableHead>}
                {isEngineer && <TableHead>Stage Details</TableHead>}
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
                {!isEngineer && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-7 w-28" /></TableCell>
                    </TableRow>
                  ))
                : leads.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={isEngineer ? 6 : 7} className="text-center py-12 font-utility text-[#111827]/65">
                        {anyFilter ? copy.list.noMatch : 'No leads found'}
                      </TableCell>
                    </TableRow>
                  )
                : leads.map((lead: LeadSummary) => (
                    <ClickableRow
                      key={lead.id}
                      className="hover:bg-[#f7f9fc] transition-colors"
                      href={`/dashboard/leads/${lead.id}`}
                    >
                      <TableCell className="font-utility font-medium text-[#091c3c]">
                        <Link href={`/dashboard/leads/${lead.id}`} className="inline-flex min-h-11 items-center hover:underline">
                          #{lead.id}</Link>
                      </TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">
                        {lead.project_reference_id ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={stageBadgeVariant(lead.pipeline_stage)}>
                          {lead.pipeline_stage.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      {!isEngineer && (
                        <TableCell>
                          {lead.lead_score ? (
                            <Badge variant={scoreVariant(lead.lead_score)}>{lead.lead_score}</Badge>
                          ) : (
                            <span className="font-utility text-sm text-[#111827]/60">—</span>
                          )}
                        </TableCell>
                      )}
                      {isEngineer && <TableCell className="font-utility text-sm text-[#111827]/60">—</TableCell>}
                      <TableCell>
                        <Badge variant={sourceBadgeVariant(lead.source)}>
                          {SOURCE_LABEL[lead.source] ?? lead.source}
                        </Badge>
                        {lead.referred_by && (
                          <p className="mt-1 font-utility text-xs text-[#111827]/65" data-testid="lead-referred-by">
                            {fmt(copy.list.referredBy, { name: `${lead.referred_by.full_name} (${lead.referred_by.associate_id})` })}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">{formatDate(lead.created_at)}</TableCell>
                      {!isEngineer && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {lead.pipeline_stage === 'qualified' && (
                            <Button
                              size="sm"
                              className="min-h-11"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/dashboard/leads/${lead.id}`)
                              }}
                            >
                              Generate Draft
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </ClickableRow>
                  ))}
            </TableBody>
          </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4e8ee] px-4 py-3">
            <p className="font-utility text-sm text-[#111827]/60" aria-live="polite">
              {serverFilterError
                ? copy.list.filterRejected
                : total === 0
                  ? copy.list.noResults
                  : fmt(copy.list.pageStatus, {
                      page: countFormat.format(page),
                      pages: countFormat.format(totalPages),
                      count: countFormat.format(total),
                    })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 min-w-11"
                disabled={page <= 1 || isPlaceholderData}
                onClick={() => setParams({ page: String(page - 1) }, { keepPage: true })}
              >
                {copy.list.previous}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 min-w-11"
                disabled={page >= totalPages || isPlaceholderData}
                onClick={() => setParams({ page: String(page + 1) }, { keepPage: true })}
              >
                {copy.list.next}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
