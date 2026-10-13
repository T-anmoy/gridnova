'use client'

import { AlertCircle } from 'lucide-react'

export interface CatalogueItem {
  id: number
  brand: string
  model_name: string
  is_dcr_compliant: boolean
  is_placeholder?: boolean
}

// Where a picker gets its models from. The staff implementation reads
// GET /api/v1/equipment/ (see useStaffCatalogue); an associate implementation —
// a price-free catalogue — can be added later without touching this component.
export interface CatalogueSource {
  items: CatalogueItem[] | undefined
  isLoading: boolean
  error?: unknown
  refetch: () => void
}

/**
 * Pick a module / inverter model. Shows loading, an error with Retry, and an
 * empty state — never a silently empty select. Dummy catalogue rows are marked
 * so they can't be mistaken for real stock.
 */
export default function CataloguePicker({
  id,
  label,
  value,
  onChange,
  source,
  placeholder = 'Select a model…',
  emptyText = 'No models are in the catalogue yet.',
  errorText = 'We couldn’t load the catalogue.',
  retryLabel = 'Retry',
}: {
  id: string
  label: string
  value: number | null
  onChange: (item: CatalogueItem | null) => void
  source: CatalogueSource
  placeholder?: string
  emptyText?: string
  errorText?: string
  retryLabel?: string
}) {
  const field = 'w-full min-h-[44px] rounded-xl border border-[#e4e8ee] bg-white px-3 py-2 text-sm outline-none focus-visible:border-[#2f5daa] focus-visible:ring-2 focus-visible:ring-[#2f5daa]/25'
  let body: React.ReactNode
  if (source.isLoading) {
    body = <div role="status" aria-busy="true" className="h-[46px] animate-pulse rounded-xl border border-[#e4e8ee] bg-[#eef1f6]" />
  } else if (source.error) {
    body = (
      <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e4e8ee] px-3 py-2 text-sm text-red-700">
        <AlertCircle className="h-4 w-4" /> {errorText}
        <button type="button" onClick={source.refetch} className="min-h-[44px] font-semibold underline">{retryLabel}</button>
      </div>
    )
  } else if (!source.items || source.items.length === 0) {
    body = <p role="status" className="rounded-xl border border-[#e4e8ee] px-3 py-3 text-sm text-gray-500">{emptyText}</p>
  } else {
    const items = source.items
    body = (
      <select
        id={id}
        className={field}
        value={value ?? ''}
        onChange={(e) => onChange(items.find((i) => String(i.id) === e.target.value) ?? null)}
      >
        <option value="">{placeholder}</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.brand} {i.model_name}
            {i.is_placeholder ? ' — Dummy / pending Grid Nova' : ''}
          </option>
        ))}
      </select>
    )
  }
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs uppercase tracking-[0.1em] text-gray-500">{label}</label>
      {body}
    </div>
  )
}
