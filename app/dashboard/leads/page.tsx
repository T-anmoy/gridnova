'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useAuth } from '@clerk/nextjs'
import { Search, Filter, Download } from 'lucide-react'
import { useLeads, downloadLeadsCsv } from '@/lib/dashboard/api-client'
import { useDebouncedValue } from '@/lib/dashboard/use-debounced-value'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/dashboard/utils'
import type { LeadSummary, PipelineStage, LeadScore, Role } from '@/lib/dashboard/types'

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

const PIPELINE_STAGES: PipelineStage[] = [
  'new', 'qualifying', 'qualified', 'proposal_draft', 'proposal_sent', 'negotiation', 'won', 'lost',
]

const LEAD_SCORES: LeadScore[] = ['high', 'medium', 'low']

export default function LeadsPage() {
  const router = useRouter()
  const { user } = useUser()
  const { getToken } = useAuth()
  const role = user?.publicMetadata?.role as Role | undefined

  const [stageFilter, setStageFilter] = useState<PipelineStage | ''>('')
  const [scoreFilter, setScoreFilter] = useState<LeadScore | ''>('')
  const [idSearch, setIdSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)

  const { data: leads, isLoading, error, refetch } = useLeads()

  const canExport = role === 'admin' || role === 'management'

  async function handleExport() {
    setExporting(true)
    try {
      const token = await getToken()
      if (!token) return
      await downloadLeadsCsv(
        {
          pipeline_stage: stageFilter || undefined,
          lead_score: scoreFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
        token
      )
    } finally {
      setExporting(false)
    }
  }

  // Debounce the ID search so typing stays responsive and filtering only runs
  // once the user pauses (300ms) — matters more once search hits the backend.
  const debouncedIdSearch = useDebouncedValue(idSearch, 300)

  const filtered = (leads ?? []).filter((l: LeadSummary) => {
    if (stageFilter && l.pipeline_stage !== stageFilter) return false
    if (scoreFilter && l.lead_score !== scoreFilter) return false
    if (debouncedIdSearch && !String(l.id).includes(debouncedIdSearch)) return false
    if (dateFrom && l.created_at < dateFrom) return false
    if (dateTo && l.created_at > dateTo + 'T23:59:59') return false
    return true
  })

  const isEngineer = role === 'engineer'

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">Leads</h1>
          <p className="font-utility text-sm text-[#111827]/50 mt-1">
            {leads?.length ?? 0} total leads
          </p>
        </div>
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

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#111827]/40" />
              <span className="font-utility text-sm text-[#111827]/60">Filters</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-[#111827]/40" />
              <Input
                placeholder="Search by ID"
                value={idSearch}
                onChange={(e) => setIdSearch(e.target.value)}
                className="pl-8 w-36"
              />
            </div>
            <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as PipelineStage | '')}>
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
              <Select value={scoreFilter} onValueChange={(v) => setScoreFilter(v as LeadScore | '')}>
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
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" title="From date" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" title="To date" />
            {(stageFilter || scoreFilter || idSearch || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStageFilter('')
                  setScoreFilter('')
                  setIdSearch('')
                  setDateFrom('')
                  setDateTo('')
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
                <TableHead>Pipeline Stage</TableHead>
                {!isEngineer && <TableHead>Lead Score</TableHead>}
                {isEngineer && <TableHead>Stage Details</TableHead>}
                <TableHead>Created</TableHead>
                {!isEngineer && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-7 w-28" /></TableCell>
                    </TableRow>
                  ))
                : filtered.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={isEngineer ? 4 : 5} className="text-center py-12 font-utility text-[#111827]/40">
                        No leads found
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
        </Card>
      )}
    </div>
  )
}
