'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, Search } from 'lucide-react'
import { useAssociateCatalogue } from '@/lib/associate/register-api-client'
import type { CatalogueItem } from '@/components/execution/CataloguePicker'
import type { UnitCategory } from '@/lib/associate/register-types'
import type { Messages } from '@/lib/i18n/types'

type EntryCopy = Messages['associates']['portal']['execution']['register']['entry']

const field = 'w-full min-h-[44px] rounded-xl border border-[#e4e8ee] bg-white px-3 py-2 text-sm outline-none focus:border-[#2f5daa]'
const SEARCH_DELAY_MS = 350

/**
 * The associate implementation of the catalogue picker: search by brand or
 * model within one category (the unit's type chips choose the category). The
 * catalogue is price-free and rate limited, so typing is debounced. Loading,
 * error-with-Retry (a 429 gets its own sentence) and empty are always shown —
 * never a silently empty list. The "my model is not listed" path is offered by
 * the caller, so it is available in every one of those states.
 */
export default function AssociateCataloguePicker({
  id,
  category,
  value,
  onChange,
  copy,
}: {
  id: string
  category: Exclude<UnitCategory, 'other'>
  value: CatalogueItem | null
  onChange: (item: CatalogueItem | null) => void
  copy: EntryCopy
}) {
  const [text, setText] = useState('')
  const [term, setTerm] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setTerm(text), SEARCH_DELAY_MS)
    return () => clearTimeout(t)
  }, [text])
  const source = useAssociateCatalogue(category, term)

  let body: React.ReactNode
  if (source.isLoading) {
    body = <div role="status" aria-busy="true" aria-label={copy.loading} className="h-[46px] animate-pulse rounded-xl border border-[#e4e8ee] bg-[#eef1f6]" />
  } else if (source.error) {
    body = (
      <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e4e8ee] px-3 py-2 text-sm text-red-700">
        <AlertCircle className="h-4 w-4 shrink-0" /> {source.rateLimited ? copy.rateLimited : copy.loadError}
        <button type="button" onClick={source.refetch} className="min-h-[44px] font-semibold underline">{copy.retry}</button>
      </div>
    )
  } else if (!source.items || source.items.length === 0) {
    body = <p role="status" className="rounded-xl border border-[#e4e8ee] px-3 py-3 text-sm text-[#111827]/60">{term.trim() ? copy.emptyList : copy.emptyCatalogue}</p>
  } else {
    body = (
      <ul className="max-h-56 divide-y divide-[#e4e8ee] overflow-y-auto rounded-xl border border-[#e4e8ee]" aria-label={copy.modelLabel}>
        {source.items.map((i) => {
          const selected = value?.id === i.id
          return (
            <li key={i.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(selected ? null : i)}
                className={`flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${selected ? 'bg-[#eef3fb] font-semibold text-[#0e2a63]' : 'hover:bg-[#f7f9fc]'}`}
              >
                <span>{i.brand} {i.model_name}</span>
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs uppercase tracking-[0.1em] text-[#111827]/55">{copy.searchLabel}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#111827]/40" />
        <input id={id} type="search" className={`${field} pl-9`} value={text} placeholder={copy.searchPlaceholder} maxLength={100} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      </div>
      {value && <p className="text-xs font-semibold text-[#0e2a63]" data-testid="picked-model">{copy.selected.replace('{model}', `${value.brand} ${value.model_name}`)}</p>}
      {body}
    </div>
  )
}
