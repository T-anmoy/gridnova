'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart2,
  UserCog,
  ClipboardList,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { useLeadSearch, useProposalSearch } from '@/lib/dashboard/api-client'
import { useDebouncedValue } from '@/lib/dashboard/use-debounced-value'
import { canSeeLeads } from '@/lib/dashboard/staff-leads-logic'
import { useNovaShell } from '@/lib/nova/page-context'
import { NOVA_QUESTION_MAX, canUseNova } from '@/lib/nova/logic'
import { usePermissions } from '@/lib/access/use-permissions'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [leadIdSearch, setLeadIdSearch] = useState('')
  const [proposalIdSearch, setProposalIdSearch] = useState('')
  const router = useRouter()
  // Operations and Accounts see no leads, so the palette offers them none.
  const { can } = usePermissions()
  const leadsAllowed = canSeeLeads(can)
  const { openPanel } = useNovaShell()
  const novaAllowed = canUseNova(can)

  const debouncedQuery = useDebouncedValue(query, 300)

  // Non-numeric query with at least 2 chars triggers name search
  const isNameSearch = debouncedQuery.length > 1 && !/^\d+$/.test(debouncedQuery.trim())

  const { data: leadResults, isFetching: leadsFetching } = useLeadSearch(isNameSearch && leadsAllowed ? debouncedQuery : '')
  const { data: proposalResults, isFetching: proposalsFetching } = useProposalSearch(isNameSearch ? debouncedQuery : '')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery('')
      setLeadIdSearch('')
      setProposalIdSearch('')
    }
    setOpen(next)
  }

  function navigate(href: string) {
    handleOpenChange(false)
    router.push(href)
  }

  // Hand the typed text to the Ask Nova panel; it lands in the question box, it is not sent.
  function askNova(question?: string) {
    handleOpenChange(false)
    openPanel(question)
  }
  const typedQuestion = query.trim()

  const leadItems = leadResults ?? []
  const proposalItems = proposalResults?.items ?? []

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="Search by name or command…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {novaAllowed && (
          <CommandGroup heading="Nova Records">
            <CommandItem value="ask nova open assistant" onSelect={() => askNova()}>
              <Sparkles className="mr-2 h-4 w-4" />
              Ask Nova
            </CommandItem>
            {typedQuestion.length > 1 && typedQuestion.length <= NOVA_QUESTION_MAX && (
              <CommandItem value={`ask nova ${typedQuestion}`} onSelect={() => askNova(typedQuestion)}>
                <Sparkles className="mr-2 h-4 w-4" />
                <span className="min-w-0 flex-1 truncate">Ask Nova: “{typedQuestion}”</span>
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {/* Navigation — cmdk's built-in filter hides these when typing names */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate('/dashboard')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Overview
          </CommandItem>
          {leadsAllowed && (
            <CommandItem onSelect={() => navigate('/dashboard/leads')}>
              <Users className="mr-2 h-4 w-4" />
              Leads
            </CommandItem>
          )}
          <CommandItem onSelect={() => navigate('/dashboard/proposals')}>
            <FileText className="mr-2 h-4 w-4" />
            Proposals
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/analytics')}>
            <BarChart2 className="mr-2 h-4 w-4" />
            Analytics
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/employees')}>
            <UserCog className="mr-2 h-4 w-4" />
            Employees
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/audit-log')}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Audit Log
          </CommandItem>
        </CommandGroup>

        {isNameSearch ? (
          // ── Name-based search results ──────────────────────────────────────
          <>
            {leadsAllowed && <CommandSeparator />}
            {leadsAllowed && <CommandGroup heading="Leads">
              {leadsFetching ? (
                <CommandItem disabled value="loading-leads">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching leads…
                </CommandItem>
              ) : leadItems.length === 0 ? (
                <CommandItem disabled value="no-leads">No leads found</CommandItem>
              ) : (
                leadItems.map((lead) => (
                  <CommandItem
                    key={lead.id}
                    // Include customer name in value so cmdk's filter passes this item through
                    value={`${lead.customer_name ?? ''} lead ${lead.id} ${lead.pipeline_stage}`}
                    onSelect={() => navigate(`/dashboard/leads/${lead.id}`)}
                  >
                    <Users className="mr-2 h-4 w-4 shrink-0" />
                    <span className="flex-1 min-w-0 truncate">
                      {lead.customer_name ?? `Lead #${lead.id}`}
                    </span>
                    <span className="ml-2 shrink-0 text-xs text-[#111827]/65">
                      #{lead.id} · {lead.pipeline_stage.replace(/_/g, ' ')}
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>}
            <CommandSeparator />
            <CommandGroup heading="Proposals">
              {proposalsFetching ? (
                <CommandItem disabled value="loading-proposals">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching proposals…
                </CommandItem>
              ) : proposalItems.length === 0 ? (
                <CommandItem disabled value="no-proposals">No proposals found</CommandItem>
              ) : (
                proposalItems.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.customer?.name ?? ''} proposal ${p.id} ${p.status}`}
                    onSelect={() => navigate(`/dashboard/proposals/${p.id}`)}
                  >
                    <FileText className="mr-2 h-4 w-4 shrink-0" />
                    <span className="flex-1 min-w-0 truncate">
                      {p.customer?.name ?? `Proposal #${p.id}`}
                    </span>
                    <span className="ml-2 shrink-0 text-xs text-[#111827]/65">
                      #{p.id} · {p.status.replace(/_/g, ' ')}
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </>
        ) : (
          // ── Numeric ID navigation ──────────────────────────────────────────
          <>
            {leadsAllowed && <CommandSeparator />}
            {leadsAllowed && <CommandGroup heading="Search Leads by ID">
              <CommandItem
                onSelect={() => {
                  if (leadIdSearch.trim()) navigate(`/dashboard/leads/${leadIdSearch.trim()}`)
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                Go to Lead #{leadIdSearch || '…'}
              </CommandItem>
              <div className="px-2 py-1">
                <input
                  className="w-full rounded border border-[#e4e8ee] px-2 py-1 text-xs font-utility outline-none focus-visible:ring-2 focus-visible:ring-[#f7a800]"
                  placeholder="Enter lead ID"
                  value={leadIdSearch}
                  onChange={(e) => setLeadIdSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && leadIdSearch.trim()) {
                      navigate(`/dashboard/leads/${leadIdSearch.trim()}`)
                    }
                  }}
                />
              </div>
            </CommandGroup>}
            <CommandSeparator />
            <CommandGroup heading="Search Proposals by ID">
              <CommandItem
                onSelect={() => {
                  if (proposalIdSearch.trim()) navigate(`/dashboard/proposals/${proposalIdSearch.trim()}`)
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                Go to Proposal #{proposalIdSearch || '…'}
              </CommandItem>
              <div className="px-2 py-1">
                <input
                  className="w-full rounded border border-[#e4e8ee] px-2 py-1 text-xs font-utility outline-none focus-visible:ring-2 focus-visible:ring-[#f7a800]"
                  placeholder="Enter proposal ID"
                  value={proposalIdSearch}
                  onChange={(e) => setProposalIdSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && proposalIdSearch.trim()) {
                      navigate(`/dashboard/proposals/${proposalIdSearch.trim()}`)
                    }
                  }}
                />
              </div>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
