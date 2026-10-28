'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, Loader2, Search, UserPlus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/dashboard/utils'
import { useDebouncedValue } from '@/lib/dashboard/use-debounced-value'
import { studioApi, studioKeys, useLibrary, useStudioCustomers, useStudioOptions, useStudioToken } from '@/lib/studio/api'
import { PROJECT_TYPE_HINT, studioError } from '@/lib/studio/logic'
import type { DuplicateCustomer, StudioCustomer } from '@/lib/studio/types'
import { CustomerForm, DuplicateWarning, emptyCustomer } from './CustomerForm'
import { INPUT, Notice, Panel } from './ui'

// Starting a proposal: pick (or add) the customer, pick the kind of project, and the Studio
// creates the draft with everything it can fill in already — then the wizard opens.

export default function NewProposal() {
  const router = useRouter()
  const sp = useSearchParams()
  const templateId = Number(sp.get('template')) || null
  const qc = useQueryClient()
  const token = useStudioToken()
  const options = useStudioOptions()
  const templates = useLibrary('template')
  const template = templateId ? templates.data?.items.find((t) => t.id === templateId) : undefined

  const [q, setQ] = useState('')
  const debounced = useDebouncedValue(q.trim(), 300)
  const search = useStudioCustomers(debounced, { enabled: debounced.length >= 2 })
  const [customer, setCustomer] = useState<StudioCustomer | null>(null)
  const [adding, setAdding] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateCustomer[]>([])
  const [projectType, setProjectType] = useState<string>(template?.project_type ?? '')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosenType = projectType || template?.project_type || ''

  async function pickExisting(id: number) {
    const res = await studioApi.getCustomer(token, id).catch(() => null)
    if (res) {
      setCustomer(res.customer)
      setDuplicates([])
    }
  }

  async function start() {
    if (!customer || !chosenType) return
    setStarting(true)
    setError(null)
    try {
      const view = await studioApi.createProposal(token, { customer_id: customer.id, project_type: chosenType, template_id: templateId })
      qc.setQueryData(studioKeys.proposal(view.proposal.id), view)
      void qc.invalidateQueries({ queryKey: ['studio', 'proposals'] })
      void qc.invalidateQueries({ queryKey: ['studio', 'summary'] })
      router.push(`/dashboard/studio/proposals/${view.proposal.id}?step=project`)
    } catch (e) {
      setError(studioError(e).message)
      setStarting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">New proposal</h1>
        <p className="mt-1 font-utility text-sm text-[#111827]/65">Two quick choices, then fill in the details. Everything saves as you type.</p>
        {template && (
          <Notice tone="info" className="mt-3" testId="from-template">
            Starting from the template “{template.name}”. Its materials, terms and notes are copied in.
          </Notice>
        )}
      </div>

      <Panel title="1. Customer" description="Search by name, mobile number or GSTIN — or add a new customer.">
        {customer ? (
          <div className="space-y-3" data-testid="chosen-customer">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3">
              <Check className="h-5 w-5 text-green-700" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-utility text-sm font-semibold text-[#091c3c]">
                  {customer.title ? `${customer.title} ` : ''}
                  {customer.name}
                </p>
                <p className="font-utility text-xs text-[#111827]/65">
                  {customer.mobile}
                  {customer.email ? ` · ${customer.email}` : ''}
                  {customer.address_lines.length ? ` · ${customer.address_lines.join(', ')}` : ''}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => { setCustomer(null); setDuplicates([]) }}>
                Change
              </Button>
            </div>
            <DuplicateWarning duplicates={duplicates} onUse={(id) => void pickExisting(id)} />
          </div>
        ) : adding ? (
          options.data ? (
            <CustomerForm
              initial={{ ...emptyCustomer(), name: /\d/.test(q) ? '' : q, mobile: /^\+?\d[\d\s-]*$/.test(q.trim()) ? q.trim() : '' }}
              titles={options.data.titles}
              submitLabel="Save customer"
              onCancel={() => setAdding(false)}
              onSubmit={async (value) => {
                const res = await studioApi.createCustomer(token, value)
                setCustomer(res.customer)
                setDuplicates(res.duplicates)
                setAdding(false)
                void qc.invalidateQueries({ queryKey: ['studio', 'customers'] })
              }}
            />
          ) : (
            <Skeleton className="h-64 w-full" />
          )
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#111827]/45" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search customers by name, mobile or GSTIN"
                placeholder="Name, mobile or GSTIN"
                className={cn(INPUT, 'pl-9')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="customer-search"
                autoFocus
              />
            </div>
            {debounced.length >= 2 && (
              <div aria-live="polite">
                {search.isLoading ? (
                  <Skeleton className="h-14 w-full" />
                ) : (search.data?.items ?? []).length === 0 ? (
                  <p className="font-utility text-sm text-[#111827]/65">No customer matches “{debounced}”.</p>
                ) : (
                  <ul className="divide-y divide-[#eef1f5] rounded-xl border border-[#e4e8ee]" data-testid="customer-results">
                    {search.data!.items.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setCustomer(c)}
                          className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#f7f9fc] focus-visible:outline-2 focus-visible:outline-[#f7a800]"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-utility text-sm font-medium text-[#091c3c]">{c.name}</span>
                            <span className="block truncate font-utility text-xs text-[#111827]/60">
                              {c.mobile}
                              {c.gstin ? ` · GSTIN ${c.gstin}` : ''}
                              {c.address_lines[0] ? ` · ${c.address_lines[0]}` : ''}
                            </span>
                          </span>
                          <span className="font-utility text-xs font-medium text-[#0e2a63]">Choose</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setAdding(true)} data-testid="add-customer">
              <UserPlus className="mr-1.5 h-4 w-4" /> Add a new customer
            </Button>
          </div>
        )}
      </Panel>

      <Panel title="2. Kind of project" description="This decides the layout of the proposal and which details are asked for.">
        {!options.data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div role="radiogroup" aria-label="Kind of project" className="grid gap-3 sm:grid-cols-2" data-testid="project-types">
            {options.data.project_types.map((t) => {
              const on = chosenType === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setProjectType(t.id)}
                  data-testid={`type-${t.id}`}
                  className={cn(
                    'flex min-h-20 flex-col items-start rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#f7a800]',
                    on ? 'border-[#0e2a63] bg-[#0e2a63]/[0.05] ring-1 ring-[#0e2a63]' : 'border-[#e4e8ee] bg-white hover:border-[#2f5daa]/50',
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="font-utility text-base font-semibold text-[#091c3c]">{t.label}</span>
                    {on && <Check className="h-4 w-4 text-[#0e2a63]" aria-hidden="true" />}
                  </span>
                  <span className="mt-1 font-utility text-xs text-[#111827]/65">{PROJECT_TYPE_HINT[t.id] ?? ''}</span>
                </button>
              )
            })}
          </div>
        )}
      </Panel>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex justify-end">
        <Button type="button" onClick={() => void start()} disabled={!customer || !chosenType || starting} className="min-h-12 px-6 text-base" data-testid="start-proposal">
          {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Start the proposal <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      {!customer || !chosenType ? (
        <p className="text-right font-utility text-xs text-[#111827]/55">{!customer ? 'Choose or add the customer first.' : 'Choose the kind of project.'}</p>
      ) : null}
    </div>
  )
}
