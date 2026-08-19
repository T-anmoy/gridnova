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
} from 'lucide-react'
import { useLeadSearch, useProposalSearch } from '@/lib/dashboard/api-client'
import { useDebouncedValue } from '@/lib/dashboard/use-debounced-value'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [leadIdSearch, setLeadIdSearch] = useState('')
  const [proposalIdSearch, setProposalIdSearch] = useState('')
  const router = useRouter()

  const debouncedQuery = useDebouncedValue(query, 300)

  // Non-numeric query with at least 2 chars triggers name search
  const isNameSearch = debouncedQuery.length > 1 && !/^\d+$/.test(debouncedQuery.trim())

  const { data: leadResults, isFetching: leadsFetching } = useLeadSearch(isNameSearch ? debouncedQuery : '')
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

        {/* Navigation — cmdk's built-in filter hides these when typing names */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate('/dashboard')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Overview
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/leads')}>
            <Users className="mr-2 h-4 w-4" />
            Leads
          </CommandItem>
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
            <CommandSeparator />
            <CommandGroup heading="Leads">
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
                    <span className="ml-2 shrink-0 text-xs text-[#111827]/40">
                      #{lead.id} · {lead.pipeline_stage.replace(/_/g, ' ')}
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
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
                    <span className="ml-2 shrink-0 text-xs text-[#111827]/40">
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
            <CommandSeparator />
            <CommandGroup heading="Search Leads by ID">
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
                  className="w-full rounded border border-[#e4e8ee] px-2 py-1 text-xs font-utility outline-none focus:ring-1 focus:ring-[#f7a800]"
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
            </CommandGroup>
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
                  className="w-full rounded border border-[#e4e8ee] px-2 py-1 text-xs font-utility outline-none focus:ring-1 focus:ring-[#f7a800]"
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
