'use client'

import { useId } from 'react'

/** A labelled native select: real <label>, 16px text on phones, 44px tall touch target. */
export default function SelectField({
  label,
  value,
  onChange,
  options,
  className = '',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs text-gray-500">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-[#e4e8ee] bg-white px-3 text-base font-utility text-[#111827] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7a800] md:h-9 md:text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
