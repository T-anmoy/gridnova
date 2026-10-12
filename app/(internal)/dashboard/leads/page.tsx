'use client'

import { Suspense, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Search, Filter, Download, Plus } from 'lucide-react'
import { useLeads, useCreateLead, downloadLeadsCsv, defaultLeadListParams, LEADS_PAGE_SIZE } from '@/lib/dashboard/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { useDebouncedValue } from '@/lib/dashboard/use-debounced-value'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatDate, istDateKey } from '@/lib/dashboard/utils'
import type { CreateLeadInput, LeadAssignmentFilter, LeadSource, LeadSummary, ManualProjectType, PipelineStage, LeadScore, Role } from '@/lib/dashboard/types'

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

const PIPELINE_STAGES: PipelineStage[] = [
  'new', 'qualifying', 'qualified', 'proposal_draft', 'proposal_sent', 'negotiation', 'won', 'lost',
]

const LEAD_SCORES: LeadScore[] = ['high', 'medium', 'low']

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
          <p className="font-utility text-xs text-[#111827]/40">At least one of phone or email is required.</p>
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

const isPipelineStage = (v: string | null): v is PipelineStage => !!v && (PIPELINE_STAGES as string[]).includes(v)
const isLeadScore = (v: string | null): v is LeadScore => !!v && (LEAD_SCORES as string[]).includes(v)
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
  const role = user?.publicMetadata?.role as Role | undefined

  // Filters and the page live in the URL so a reload, a back-navigation or a
  // shared link restores the exact view.
  const stageParam = searchParams.get('stage')
  const scoreParam = searchParams.get('score')
  const stageFilter: PipelineStage | '' = isPipelineStage(stageParam) ? stageParam : ''
  const scoreFilter: LeadScore | '' = isLeadScore(scoreParam) ? scoreParam : ''
  const sourceFilter = LEAD_SOURCES.includes(searchParams.get('source') ?? '') ? (searchParams.get('source') as string) : ''
  const assignedParam = searchParams.get('assigned')
  const assignedFilter: LeadAssignmentFilter | '' = isAssignment(assignedParam) ? assignedParam : ''
  const urlQuery = searchParams.get('q') ?? ''
  const dateFrom = searchParams.get('from') ?? ''
  const dateTo = searchParams.get('to') ?? ''
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
  const { data, isLoading, error, refetch, isPlaceholderData } = useLeads({
    ...defaults,
    page,
    ...(sourceFilter ? { source: sourceFilter } : {}),
    ...(urlQuery ? { q: urlQuery } : {}),
    ...(canFilterByAssignment && effectiveAssignedFilter ? { assigned: effectiveAssignedFilter } : {}),
  })
  const leads = data?.items
  const total = data?.total ?? 0
  const pageSize = data?.page_size ?? LEADS_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const canExport = role === 'admin' || role === 'management'
  const canAddLead = role === 'admin' || role === 'sales' || role === 'management'

  // The export endpoint filters by source only (BE-1 / openapi); search, stage,
  // score and date are not accepted, so they are not sent — the notice below
  // tells the user the file is wider than the table in that case.
  const exportIsWiderThanView = !!(urlQuery || stageFilter || scoreFilter || dateFrom || dateTo || assignedFilter)

  async function handleExport() {
    setExporting(true)
    try {
      const token = await getToken()
      if (!token) return
      await downloadLeadsCsv({ source: sourceFilter || undefined }, token)
    } catch (err) {
      toast.error(errorMessage(err, 'Export failed'))
    } finally {
      setExporting(false)
    }
  }

  // Stage, score and date are not server-side filters yet, so they refine only
  // the page that is loaded. The date comparison uses IST calendar days (a
  // lead created 00:30 IST is "that day" in IST, not the previous UTC day).
  const filtered = (leads ?? []).filter((l: LeadSummary) => {
    if (stageFilter && l.pipeline_stage !== stageFilter) return false
    if (scoreFilter && l.lead_score !== scoreFilter) return false
    if (dateFrom || dateTo) {
      const day = istDateKey(l.created_at)
      if (dateFrom && day < dateFrom) return false
      if (dateTo && day > dateTo) return false
    }
    return true
  })
  const pageLocalFilterActive = !!(stageFilter || scoreFilter || dateFrom || dateTo)

  const isEngineer = role === 'engineer'

  // Compact per-stage counts for the page that is loaded — the backend has no
  // stage-count endpoint, so this is explicitly "this page", never a total.
  const stageCounts = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: (leads ?? []).filter((l) => l.pipeline_stage === stage).length,
  })).filter((s) => s.count > 0)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">Leads</h1>
          <p className="font-utility text-sm text-[#111827]/50 mt-1" aria-live="polite">
            {isLoading ? 'Loading…' : `${countFormat.format(total)} ${urlQuery || sourceFilter || effectiveAssignedFilter ? 'matching' : 'total'} leads`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAddLead && <AddLeadDialog />}
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          )}
        </div>
      </div>
      {canExport && exportIsWiderThanView && (
        <p className="mb-3 font-utility text-xs text-[#111827]/50" role="note">
          Export CSV includes every lead for the selected source. The server does not yet filter exports by search, stage, score, date or assignment.
        </p>
      )}

      {/* Stage summary strip */}
      {stageCounts.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="font-utility text-xs text-[#111827]/40">On this page:</span>
          {stageCounts.map(({ stage, count }) => (
            <button
              key={stage}
              type="button"
              onClick={() => setParams({ stage: stageFilter === stage ? undefined : stage }, { keepPage: true })}
              aria-pressed={stageFilter === stage}
              className={`rounded-full border px-3 py-2 min-h-11 font-utility text-xs transition-colors focus-visible:outline-2 focus-visible:outline-[#f7a800] ${
                stageFilter === stage
                  ? 'border-[#f7a800] bg-[#f7a800]/10 text-[#091c3c] font-semibold'
                  : 'border-[#e4e8ee] bg-white text-[#111827]/60 hover:bg-[#f7f9fc]'
              }`}
            >
              {stage.replace(/_/g, ' ')} <span className="font-semibold">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#111827]/40" />
              <span className="font-utility text-sm text-[#111827]/60">Filters</span>
            </div>
            {canFilterByAssignment && (
              <Select
                value={effectiveAssignedFilter || 'all'}
                onValueChange={(v) => setParams({ assigned: v === 'all' ? undefined : v })}
              >
                <SelectTrigger className="w-44">
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
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-[#111827]/40" />
              <Input
                type="search"
                aria-label={isEngineer ? 'Search by lead ID' : 'Search by name, email, phone or lead ID'}
                placeholder={isEngineer ? 'Search by lead ID' : 'Name, email, phone or ID'}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value.slice(0, 100))}
                className="pl-8 w-full sm:w-60"
                autoComplete="off"
              />
            </div>
            <Select value={stageFilter} onValueChange={(v) => setParams({ stage: v || undefined }, { keepPage: true })}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Pipeline stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All stages</SelectItem>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isEngineer && (
              <Select value={scoreFilter} onValueChange={(v) => setParams({ score: v || undefined }, { keepPage: true })}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Lead score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All scores</SelectItem>
                  {LEAD_SCORES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input type="date" value={dateFrom} onChange={(e) => setParams({ from: e.target.value || undefined }, { keepPage: true })} className="w-36" aria-label="From date" title="From date" />
            <Input type="date" value={dateTo} onChange={(e) => setParams({ to: e.target.value || undefined }, { keepPage: true })} className="w-36" aria-label="To date" title="To date" />
            <Select value={sourceFilter} onValueChange={(v) => setParams({ source: v || undefined })}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All sources</SelectItem>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(stageFilter || scoreFilter || sourceFilter || searchText || dateFrom || dateTo || assignedFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchText('')
                  router.replace(pathname, { scroll: false })
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : (
        <Card>
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
                : filtered.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={isEngineer ? 6 : 7} className="text-center py-12 font-utility text-[#111827]/40">
                        {pageLocalFilterActive && (leads?.length ?? 0) > 0
                          ? 'No leads on this page match the stage, score or date filter — try another page.'
                          : 'No leads found'}
                      </TableCell>
                    </TableRow>
                  )
                : filtered.map((lead: LeadSummary) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-[#f7f9fc] transition-colors"
                      onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                    >
                      <TableCell className="font-utility font-medium text-[#091c3c]">#{lead.id}</TableCell>
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
                          <Badge variant={scoreVariant(lead.lead_score)}>
                            {lead.lead_score}
                          </Badge>
                        </TableCell>
                      )}
                      {isEngineer && <TableCell className="font-utility text-sm text-[#111827]/60">—</TableCell>}
                      <TableCell>
                        <Badge variant={sourceBadgeVariant(lead.source)}>
                          {SOURCE_LABEL[lead.source] ?? lead.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">{formatDate(lead.created_at)}</TableCell>
                      {!isEngineer && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {lead.pipeline_stage === 'qualified' && (
                            <Button
                              size="sm"
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
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4e8ee] px-4 py-3">
            <p className="font-utility text-sm text-[#111827]/60" aria-live="polite">
              {total === 0
                ? 'No results'
                : `Page ${countFormat.format(page)} of ${countFormat.format(totalPages)} · ${countFormat.format(total)} leads`}
              {pageLocalFilterActive && ' · stage, score and date filters apply to this page only'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 min-w-11"
                disabled={page <= 1 || isPlaceholderData}
                onClick={() => setParams({ page: String(page - 1) }, { keepPage: true })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 min-w-11"
                disabled={page >= totalPages || isPlaceholderData}
                onClick={() => setParams({ page: String(page + 1) }, { keepPage: true })}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
