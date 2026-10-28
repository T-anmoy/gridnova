'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import {
  isNotSeededError,
  lookupDebugHint,
  useTerritoryCascade,
  type TerritoryDepth,
  type TerritoryValue,
} from '@/lib/associate/territory'
import { placeName } from '@/lib/associate/place-names'
import type { Messages } from '@/lib/i18n/types'

export type TerritoryCopy = Messages['associates']['territory']

type Level = 'state' | 'district' | 'block'

interface FieldArgs {
  id: string
  label: string
  why?: string
  error?: string
  children: ReactNode
}

interface Option {
  lgd_code: number
  name: string
}

interface LookupView {
  data?: Option[]
  isLoading?: boolean
  isError?: boolean
  error?: unknown
  refetch?: () => unknown
}

/**
 * State → district → block selects for every territory picker. Controlled by
 * `value`; `onChange` always receives the whole cascade with downstream levels
 * already reset. Each lookup shows its loading, error (+ Retry), "not open
 * yet" and empty states instead of an empty dropdown.
 */
export default function TerritorySelect({
  idPrefix,
  copy,
  value,
  onChange,
  depth = 'block',
  labels,
  whys,
  errors,
  inputClass,
  renderField,
}: {
  idPrefix: string
  copy: TerritoryCopy
  value: TerritoryValue
  onChange: (next: TerritoryValue) => void
  depth?: TerritoryDepth
  labels: Record<Level, string>
  whys?: Partial<Record<Level, string>>
  errors?: Partial<Record<Level, string>>
  inputClass: (hasError: boolean) => string
  renderField: (args: FieldArgs) => ReactNode
}) {
  const { states, districts, blocks, selectedDistrict } = useTerritoryCascade(value, depth)

  // Auto-select a level that has exactly one option. The ref keeps the effect
  // from acting on a value the parent has already moved past.
  const latest = useRef({ value, onChange })
  useEffect(() => {
    latest.current = { value, onChange }
  })
  const onlyState = states.data?.length === 1 ? String(states.data[0].lgd_code) : ''
  const onlyDistrict = districts.data?.length === 1 ? String(districts.data[0].lgd_code) : ''
  const onlyBlock = blocks.data?.length === 1 ? String(blocks.data[0].lgd_code) : ''
  useEffect(() => {
    const { value: v, onChange: emit } = latest.current
    if (onlyState && !v.state) emit({ state: onlyState, district: '', block: '' })
  }, [onlyState])
  useEffect(() => {
    const { value: v, onChange: emit } = latest.current
    if (onlyDistrict && v.state && !v.district) emit({ ...v, district: onlyDistrict, block: '' })
  }, [onlyDistrict, value.state])
  useEffect(() => {
    const { value: v, onChange: emit } = latest.current
    if (onlyBlock && v.district && !v.block) emit({ ...v, block: onlyBlock })
  }, [onlyBlock, value.district])

  function control(level: Level, lookup: LookupView, blockedReason: string | null, current: string, pick: (code: string) => void) {
    const id = `${idPrefix}-${level}`
    const hasError = !!errors?.[level]
    const base = `${inputClass(hasError)} min-h-[44px]`
    let body: ReactNode
    if (blockedReason) {
      body = (
        <>
          <select id={id} className={base} disabled value="" aria-describedby={`${id}-note`}>
            <option value="">{copy.selectPlaceholder}</option>
          </select>
          <p id={`${id}-note`} className="mt-1.5 text-xs text-[#111827]/65">{blockedReason}</p>
        </>
      )
    } else if (lookup.isLoading) {
      body = (
        <div role="status" aria-busy="true" className="h-[46px] animate-pulse rounded-xl border border-[#e4e8ee] bg-[#eef1f6]">
          <span className="sr-only">{copy.loading}</span>
        </div>
      )
    } else if (lookup.isError) {
      const notOpen = isNotSeededError(lookup.error)
      const hint = lookupDebugHint(lookup.error)
      body = (
        <div role="alert" className="rounded-xl border border-[#e4e8ee] bg-white px-4 py-3 text-sm text-[#111827]/70">
          <p>{notOpen ? copy.notOpen : copy.loadError}</p>
          {hint && <p data-testid="territory-debug-hint" className="mt-1 text-[11px] text-[#111827]/65">{hint}</p>}
          <button
            type="button"
            onClick={() => void lookup.refetch?.()}
            className="mt-2 min-h-[44px] rounded-lg border border-[#2f5daa] px-4 text-sm font-medium text-[#2f5daa]"
          >
            {copy.retry}
          </button>
        </div>
      )
    } else if (lookup.data && lookup.data.length === 0) {
      body = (
        <p role="status" className="rounded-xl border border-[#e4e8ee] bg-white px-4 py-3 text-sm text-[#111827]/70">
          {level === 'state' ? copy.notOpen : copy.noOptions}
        </p>
      )
    } else {
      body = (
        <select id={id} className={base} value={current} aria-invalid={hasError || undefined} onChange={(e) => pick(e.target.value)}>
          <option value="">{copy.selectPlaceholder}</option>
          {(lookup.data ?? []).map((o) => (
            <option key={o.lgd_code} value={o.lgd_code}>{placeName(o.name)}</option>
          ))}
        </select>
      )
    }
    return renderField({ id, label: labels[level], why: whys?.[level], error: errors?.[level], children: body })
  }

  const showBlock = depth === 'block' && selectedDistrict?.has_blocks !== false

  return (
    <>
      {control('state', states, null, value.state, (code) => onChange({ state: code, district: '', block: '' }))}
      {depth !== 'state' &&
        control('district', districts, value.state ? null : copy.chooseStateFirst, value.district, (code) =>
          onChange({ ...value, district: code, block: '' })
        )}
      {showBlock &&
        control('block', blocks, value.district ? null : copy.chooseDistrictFirst, value.block, (code) =>
          onChange({ ...value, block: code })
        )}
    </>
  )
}
