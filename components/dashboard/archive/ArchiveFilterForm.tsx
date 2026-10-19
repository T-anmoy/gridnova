'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SelectField from '@/components/dashboard/SelectField'
import {
  EMPTY_ARCHIVE_FILTERS,
  SCHEMES,
  archiveFilterErrorText,
  schemeLabel,
  validateArchiveDraft,
  type ArchiveFilters,
} from '@/lib/archive/logic'

const FIELD_OF: Record<string, keyof ArchiveFilters> = {
  capacity_min: 'capacityMin', capacity_max: 'capacityMax', commissioned_from: 'commissionedFrom', commissioned_to: 'commissionedTo',
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-gray-500">{label}</label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

/**
 * The archive filters. Editing only changes the draft; "Apply" validates it and writes it to the
 * URL (so the view can be reloaded, shared and reached with the back button). The parent keys this
 * on the URL, so back-navigation resets the draft to what the URL says.
 */
export function ArchiveFilterForm({
  applied,
  onApply,
  serverError,
}: {
  applied: ArchiveFilters
  onApply: (next: ArchiveFilters) => void
  serverError: { code: string; field?: string } | null
}) {
  const [draft, setDraft] = useState<ArchiveFilters>(applied)
  const [errors, setErrors] = useState<ReturnType<typeof validateArchiveDraft>>([])
  const set = (k: keyof ArchiveFilters) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }))
  const errorFor = (f: string) => {
    const local = errors.find((e) => e.field === f)
    if (local) return archiveFilterErrorText(local.code)
    return serverError && serverError.field === f ? archiveFilterErrorText(serverError.code) : undefined
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const problems = validateArchiveDraft(draft)
    setErrors(problems)
    if (problems.length === 0) onApply({ ...draft, q: draft.q.trim(), state: draft.state.trim(), district: draft.district.trim(), moduleMake: draft.moduleMake.trim(), inverterMake: draft.inverterMake.trim() })
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-[#e4e8ee] bg-white p-3 md:p-4" aria-label="Archive filters">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="af-q" label="Search (reference, customer, place)">
          <Input id="af-q" className="min-h-11 md:min-h-9" value={draft.q} onChange={set('q')} maxLength={200} />
        </Field>
        <Field id="af-state" label="State">
          <Input id="af-state" className="min-h-11 md:min-h-9" value={draft.state} onChange={set('state')} maxLength={100} />
        </Field>
        <Field id="af-district" label="District">
          <Input id="af-district" className="min-h-11 md:min-h-9" value={draft.district} onChange={set('district')} maxLength={100} />
        </Field>
        <SelectField
          label="Scheme"
          value={draft.scheme}
          onChange={(v) => setDraft((d) => ({ ...d, scheme: v }))}
          options={[{ value: '', label: 'All schemes' }, ...SCHEMES.map((s) => ({ value: s, label: schemeLabel(s) }))]}
        />
        <Field id="af-cmin" label="Capacity from (kW)" error={errorFor('capacity_min')}>
          <Input id="af-cmin" inputMode="decimal" className="min-h-11 md:min-h-9" value={draft.capacityMin} onChange={set('capacityMin')} aria-invalid={!!errorFor('capacity_min')} />
        </Field>
        <Field id="af-cmax" label="Capacity to (kW)" error={errorFor('capacity_max')}>
          <Input id="af-cmax" inputMode="decimal" className="min-h-11 md:min-h-9" value={draft.capacityMax} onChange={set('capacityMax')} aria-invalid={!!errorFor('capacity_max')} />
        </Field>
        <Field id="af-from" label="Commissioned from" error={errorFor('commissioned_from')}>
          <Input id="af-from" type="date" className="min-h-11 md:min-h-9" value={draft.commissionedFrom} onChange={set('commissionedFrom')} aria-invalid={!!errorFor('commissioned_from')} />
        </Field>
        <Field id="af-to" label="Commissioned to" error={errorFor('commissioned_to')}>
          <Input id="af-to" type="date" className="min-h-11 md:min-h-9" value={draft.commissionedTo} onChange={set('commissionedTo')} aria-invalid={!!errorFor('commissioned_to')} />
        </Field>
        <Field id="af-module" label="Module make contains">
          <Input id="af-module" className="min-h-11 md:min-h-9" value={draft.moduleMake} onChange={set('moduleMake')} maxLength={100} />
        </Field>
        <Field id="af-inverter" label="Inverter make contains">
          <Input id="af-inverter" className="min-h-11 md:min-h-9" value={draft.inverterMake} onChange={set('inverterMake')} maxLength={100} />
        </Field>
        {serverError && !Object.keys(FIELD_OF).includes(serverError.field ?? '') && (
          <p role="alert" className="self-end text-xs text-red-600">{archiveFilterErrorText(serverError.code)}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-[44px]">Apply filters</Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          onClick={() => {
            setDraft(EMPTY_ARCHIVE_FILTERS)
            setErrors([])
            onApply(EMPTY_ARCHIVE_FILTERS)
          }}
        >
          Clear
        </Button>
      </div>
    </form>
  )
}
