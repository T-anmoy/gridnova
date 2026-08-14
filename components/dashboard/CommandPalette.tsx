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
} from 'lucide-react'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [leadSearch, setLeadSearch] = useState('')
  const [proposalSearch, setProposalSearch] = useState('')
  const router = useRouter()

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

  function navigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
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
        <CommandSeparator />
        <CommandGroup heading="Search Leads by ID">
          <CommandItem
            onSelect={() => {
              if (leadSearch.trim()) navigate(`/dashboard/leads/${leadSearch.trim()}`)
            }}
          >
            <Users className="mr-2 h-4 w-4" />
            Go to Lead #{leadSearch || '...'}
          </CommandItem>
          <div className="px-2 py-1">
            <input
              className="w-full rounded border border-[#e4e8ee] px-2 py-1 text-xs font-utility outline-none focus:ring-1 focus:ring-[#f7a800]"
              placeholder="Enter lead ID"
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && leadSearch.trim()) {
                  navigate(`/dashboard/leads/${leadSearch.trim()}`)
                }
              }}
            />
          </div>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Search Proposals by ID">
          <CommandItem
            onSelect={() => {
              if (proposalSearch.trim()) navigate(`/dashboard/proposals/${proposalSearch.trim()}`)
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            Go to Proposal #{proposalSearch || '...'}
          </CommandItem>
          <div className="px-2 py-1">
            <input
              className="w-full rounded border border-[#e4e8ee] px-2 py-1 text-xs font-utility outline-none focus:ring-1 focus:ring-[#f7a800]"
              placeholder="Enter proposal ID"
              value={proposalSearch}
              onChange={(e) => setProposalSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && proposalSearch.trim()) {
                  navigate(`/dashboard/proposals/${proposalSearch.trim()}`)
                }
              }}
            />
          </div>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
